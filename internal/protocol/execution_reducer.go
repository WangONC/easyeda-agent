package protocol

import (
	"encoding/json"
	"reflect"
	"strings"
)

// These are ephemeral facts for one projection, not persisted execution state.
type executionFacts struct {
	req                                                                                 *Request
	resp                                                                                *Response
	contract                                                                            ActionContract
	raw                                                                                 map[string]any
	prior                                                                               *Execution
	meta                                                                                *Execution
	invalid                                                                             any
	before, preview, mutation, effectful, observed, unsettled, priorUncertain, negative bool
	issue, basis                                                                        string
}

func emptyExecution(req *Request, c ActionContract) *Execution {
	e := &Execution{RequestID: req.ID, OperationID: req.OperationID, ParentOperationID: req.ParentOperationID, ContractVersion: c.Version, ContractHash: c.Hash, ExpectedTarget: req.ExpectedTarget, Verification: Evidence{State: "UNAVAILABLE", Coverage: "PARTIAL", Required: []string{}, Observed: []string{}, Missing: []string{}, EvidenceRefs: []string{}}, Recovery: map[string]any{"state": "NOT_REQUESTED"}, Persistence: map[string]any{"state": "NOT_REQUESTED"}}
	if e.OperationID == "" {
		e.OperationID, _ = req.Payload["client_transaction_id"].(string)
	}
	return e
}

// Validate does not infer success or overwrite contradictory evidence.
func validateExecution(req *Request, resp *Response, before bool) *executionFacts {
	if req == nil {
		req = &Request{}
	}
	c, _ := ContractFor(req.Action)
	f := &executionFacts{req: req, resp: resp, contract: c, before: before, preview: Preview(req), mutation: c.ContentMutation(), effectful: len(c.Effects) > 0, raw: map[string]any{}, meta: emptyExecution(req, c)}
	if resp != nil {
		f.raw = resp.Result
		f.prior = resp.Execution
		f.meta.ObservedTargetAfter = resp.Context
	}
	f.observed, f.unsettled = sideEffectEvidence(jsonValue(f.raw))
	if f.prior != nil {
		f.effectful = f.effectful || f.prior.PossibleEffect
		// A validated pre-dispatch conclusion carries its phase to later projections.
		p := f.prior
		if validExecutionShape(jsonValue(p)) && p.DecisionBasis == "REFUSED" && p.ContractVersion == c.Version && p.ContractHash == c.Hash && p.RequestID == req.ID && p.RequestID == requestResponseID(resp) && p.WriteAttempted != nil && !*p.WriteAttempted && !p.PossibleEffect && !p.RequestSatisfied && (p.MutationOutcome == NoWrite || !f.mutation && p.MutationOutcome == "") {
			f.before = true
		}
		evidence := f.prior.InvalidEvidence
		if evidence == nil {
			evidence = jsonValue(f.prior)
		}
		wrote, pending := sideEffectEvidence(evidence)
		f.observed = f.observed || wrote
		f.unsettled = f.unsettled || pending
		if f.prior.InvalidEvidence != nil || !validExecutionShape(evidence) {
			f.invalid = evidence
			f.issue = "INVALID"
			// A valid invalid-evidence envelope retains its attribution and metadata.
			if f.prior.InvalidEvidence != nil && validExecutionShape(jsonValue(f.prior)) {
				b, _ := json.Marshal(f.prior)
				var copy Execution
				_ = json.Unmarshal(b, &copy)
				f.meta = &copy
			}
		} else {
			// A validated deep copy preserves metadata; Derive replaces every conclusion.
			b, _ := json.Marshal(f.prior)
			var copy Execution
			_ = json.Unmarshal(b, &copy)
			f.meta = &copy
			f.priorUncertain = f.prior.MutationOutcome == Uncertain
			if f.prior.ContractVersion != c.Version || f.prior.ContractHash != c.Hash || f.prior.RequestID != requestResponseID(resp) || (req.ID != "" && req.ID != requestResponseID(resp)) {
				f.issue = "CONFLICT"
			}
			if !c.ContentMutation() && f.prior.MutationOutcome != "" {
				f.issue = "CONFLICT"
				f.effectful = true
			}
		}
	}
	if !validRawEvidence(f.raw, req.Action) {
		f.invalid = map[string]any{"result": jsonValue(f.raw)}
		f.issue = "INVALID"
	}
	if c.Version == "" || (req.ContractVersion != "" && req.ContractVersion != c.Version) || (req.ContractHash != "" && req.ContractHash != c.Hash) {
		if f.issue != "INVALID" {
			f.issue = "CONFLICT"
		}
	}
	if value, ok := req.Payload["dryRun"]; ok {
		if _, valid := value.(bool); !valid {
			f.issue = "INVALID"
			f.invalid = map[string]any{"payload": jsonValue(req.Payload)}
		}
	}
	if req.Payload["dryRun"] == true && c.DryRun != "preview" && !before {
		f.issue = "CONFLICT"
	}
	if f.observed || f.unsettled {
		f.effectful = true
	}
	f.negative = NegativeResult(f.raw)
	return f
}
func requestResponseID(resp *Response) string {
	if resp == nil {
		return ""
	}
	return resp.ID
}

// Reconcile has one evidence precedence: invalid/conflict/unresolved dominates intent
// and weaker status. Only the explicit delivery-pending state can acquire new evidence.
func reconcileExecution(f *executionFacts) *executionFacts {
	p, r := f.prior, f.raw
	if f.before && !f.observed && !f.unsettled && !f.priorUncertain {
		f.basis = "REFUSED"
		return f
	}
	if f.prior != nil && f.prior.DecisionBasis == "CONFLICT" && f.issue != "INVALID" {
		f.basis = "CONFLICT"
		return f
	}
	if f.issue != "" {
		f.basis = f.issue
		return f
	}
	if (f.preview || f.before) && (f.observed || f.unsettled) {
		f.basis = "CONFLICT"
		return f
	}
	if p != nil {
		v := p.Verification
		// Applicability and mutually exclusive claims are checked before status arbitration.
		persistence := p.Persistence["state"]
		save, delivery := f.contract.HasEffect("SAVE"), f.contract.HasEffect("ARTIFACT_DELIVERY")
		if (persistence != "NOT_REQUESTED" && persistence != "UNKNOWN" && !save && !delivery) ||
			(persistence == "SAVE_ACKNOWLEDGED" && !save) ||
			((persistence == "DELIVERED" || persistence == "PENDING_DELIVERY" || persistence == "DELIVERY_FAILED") && !delivery) ||
			(v.State == "UNAVAILABLE" && v.Coverage == "COMPLETE") ||
			(p.MutationOutcome == NoWrite && (p.PossibleEffect || p.WriteAttempted == nil || *p.WriteAttempted)) ||
			(p.MutationOutcome == Complete && (!p.RequestSatisfied || p.NativeSettled == nil || !*p.NativeSettled || p.WriteAttempted == nil || !*p.WriteAttempted)) ||
			(p.MutationOutcome == Partial && p.RequestSatisfied) {
			f.basis = "CONFLICT"
			return f
		}
		if p.Recovery["state"] != "NOT_REQUESTED" && f.req.Action != "route.apply_batch" {
			f.basis = "UNRESOLVED"
			return f
		}
		if persistence == "DELIVERY_FAILED" {
			f.basis = "DELIVERY_FAILED"
			return f
		}
		missing := len(v.Missing) > 0 || (len(v.Required) > 0 && (v.Coverage != "COMPLETE" || !containsAll(v.Observed, v.Required))) || (v.State == "AVAILABLE" && v.Coverage != "COMPLETE")
		if v.State == "INVALID" {
			f.basis = "INVALID"
			return f
		}
		if v.State == "UNSUPPORTED" || missing {
			f.basis = "UNRESOLVED"
			return f
		}
		if p.MutationOutcome == NoWrite && f.observed {
			f.basis = "CONFLICT"
			return f
		}
		if p.WriteAttempted != nil && !*p.WriteAttempted && f.observed {
			f.basis = "CONFLICT"
			return f
		}
		if f.req.Action == "route.apply_batch" {
			if (r["status"] == "complete" && p.Recovery["state"] != "NOT_REQUESTED") || (p.Recovery["state"] == "RESTORED" && (r["rollback_attempted"] != true || r["rollback_complete"] != true)) {
				f.basis = "CONFLICT"
				return f
			}
			if p.ItemResults != nil && !reflect.DeepEqual(jsonValue(p.ItemResults), jsonValue(r["item_results"])) {
				f.basis = "CONFLICT"
				return f
			}
		}
	}
	if f.unsettled || r["status"] == "uncertain" || r["duplicate"] == true {
		f.basis = "UNRESOLVED"
		return f
	}
	if f.priorUncertain {
		// A prior canonical unverified legacy result may retain its compatibility
		// diagnostics, but can never become completed or no-write from raw status.
		if (p.DecisionBasis == "UNVERIFIED" || p.DecisionBasis == "LEGACY_NEGATIVE") && f.req.Action != "route.apply_batch" && !f.preview {
			if f.negative {
				f.basis = "LEGACY_NEGATIVE"
			} else {
				f.basis = "UNVERIFIED"
			}
			return f
		}
		f.basis = "UNRESOLVED"
		return f
	}
	if p != nil && p.DecisionBasis == "REFUSED" && p.WriteAttempted != nil && !*p.WriteAttempted && !f.observed {
		f.basis = "REFUSED"
		return f
	}
	if f.preview {
		f.basis = "PREVIEW"
		return f
	}
	if p != nil && p.MutationOutcome == NoWrite && p.WriteAttempted != nil && !*p.WriteAttempted && !f.observed {
		f.basis = "NO_WRITE"
		if p.DecisionBasis == "REFUSED" {
			f.basis = "REFUSED"
		}
		return f
	}
	if f.mutation {
		if f.req.Action == "route.apply_batch" {
			switch r["status"] {
			case "stale", "partial":
				if r["mutation_started"] == false && fastNoWrite(r) {
					f.basis = "NO_WRITE"
					return f
				}
				if r["status"] == "partial" && fastSettled(r, f.req.Payload, false) {
					f.basis = "FAST_PARTIAL"
					return f
				}
			case "complete":
				if fastComplete(r, f.req.Payload) {
					f.basis = "FAST_COMPLETE"
					return f
				}
			}
			f.basis = "UNRESOLVED"
			return f
		}
		// Legacy fields remain diagnostic; no unmigrated handler is promoted complete.
		if f.negative {
			f.basis = "LEGACY_NEGATIVE"
		} else {
			f.basis = "UNVERIFIED"
		}
		return f
	}
	if f.observed && len(f.contract.Effects) == 0 {
		f.basis = "CONFLICT"
		return f
	}
	satisfied := f.resp != nil && f.resp.OK && !f.negative && r["ok"] != false && r["saved"] != false
	if p != nil && !p.RequestSatisfied && p.Persistence["state"] != "PENDING_DELIVERY" {
		satisfied = false
	}
	if f.contract.HasEffect("SAVE") {
		satisfied = satisfied && r["saved"] == true
	}
	if f.contract.HasEffect("ARTIFACT_DELIVERY") {
		delivered := satisfied && f.resp != nil && len(f.resp.Artifacts) > 0
		if f.resp != nil {
			for _, a := range f.resp.Artifacts {
				delivered = delivered && a.Path != "" && a.SHA256 != ""
			}
		}
		if delivered {
			f.basis = "DELIVERED"
		} else if satisfied && pendingArtifacts(f.resp) {
			f.basis = "PENDING_DELIVERY"
		} else {
			f.basis = "DELIVERY_FAILED"
		}
		return f
	}
	if satisfied {
		f.basis = "SATISFIED"
	} else {
		f.basis = "REJECTED"
	}
	return f
}

// Derive is the only writer of conclusion fields. No prior success flags survive.
func deriveExecution(f *executionFacts) *Execution {
	e := f.meta
	b := f.basis
	if b == "CONFLICT" && e.PriorEvidence == nil && f.prior != nil && f.prior.DecisionBasis != "CONFLICT" {
		e.PriorEvidence = jsonValue(f.prior)
	}
	e.DecisionBasis = b
	e.MutationOutcome = ""
	e.RequestSatisfied = false
	e.NextAction = "inspect"
	e.Reason = "request not satisfied"
	e.PossibleEffect = f.effectful || f.observed
	e.AutosaveEligible = false
	e.HealthEffect = "UNKNOWN"
	e.FreshnessRestored = false
	if f.mutation {
		e.MutationOutcome = Uncertain
	}
	if f.invalid != nil {
		e.InvalidEvidence = f.invalid
		e.Verification.State = "INVALID"
	}
	if f.unsettled {
		v := false
		e.NativeSettled = &v
	}
	if f.observed {
		v := true
		e.WriteAttempted = &v
	}
	if f.meta.ObservedTargetAfter == nil && f.resp != nil {
		e.ObservedTargetAfter = f.resp.Context
	}
	switch b {
	case "INVALID", "CONFLICT", "UNRESOLVED":
		e.NextAction = "reconcile_without_replay"
		e.Reason = "execution evidence is unresolved"
		if b == "INVALID" {
			e.Reason = "invalid execution evidence"
			e.Verification.State = "INVALID"
		}
		if b == "CONFLICT" {
			e.Reason = "conflicting execution evidence"
		}
	case "REFUSED", "NO_WRITE", "PREVIEW":
		e.PossibleEffect = false
		v := false
		e.WriteAttempted = &v
		if f.mutation {
			e.MutationOutcome = NoWrite
		}
		e.Reason = "no write established"
		if b == "REFUSED" {
			e.Reason = "refused before dispatch"
		}
		if b == "PREVIEW" {
			e.RequestSatisfied = f.resp != nil && f.resp.OK && !f.negative
			e.Reason = "declared no-write preview"
		}
	case "FAST_COMPLETE", "FAST_PARTIAL":
		e.PossibleEffect = true
		v := true
		e.NativeSettled = &v
		e.WriteAttempted = &v
		e.ItemResults = f.raw["item_results"]
		e.MutationOutcome = Partial
		e.HealthEffect = "NOT_LANDED"
		e.NextAction = "reconcile_without_replay"
		e.Reason = "Fast Path partial receipt"
		if b == "FAST_COMPLETE" {
			e.MutationOutcome = Complete
			e.RequestSatisfied = true
			e.HealthEffect = "LANDED"
			e.Reason = "Fast Path semantic readback"
			e.Verification.State = "AVAILABLE"
			e.Verification.Coverage = "COMPLETE"
			if e.Verification.Source == "" {
				e.Verification.Source = "FastPath.matchesOperation"
			}
			if len(e.Verification.EvidenceRefs) == 0 {
				e.Verification.EvidenceRefs = []string{"result"}
			}
		}
		if f.raw["rollback_complete"] == true {
			e.Recovery["state"] = "RESTORED"
			if _, ok := e.Recovery["evidence_refs"]; !ok {
				e.Recovery["evidence_refs"] = []string{"result"}
			}
		}
		e.AutosaveEligible = true
	case "UNVERIFIED", "LEGACY_NEGATIVE":
		e.NextAction = "reconcile_without_replay"
		e.Reason = "legacy evidence does not prove semantic completion"
		// This keeps the ordinary legacy safety net; an explicit pending/invalid state
		// never reaches here. Exact negative readback retains historical health diagnostics.
		e.AutosaveEligible = f.resp != nil && f.resp.OK
		if b == "LEGACY_NEGATIVE" && verifiedNegative(f.raw) {
			e.HealthEffect = "NOT_LANDED"
		}
	case "SATISFIED", "DELIVERED":
		e.RequestSatisfied = true
		e.Reason = "request satisfied"
	case "PENDING_DELIVERY":
		e.Reason = "artifact delivery evidence pending"
	}
	if f.contract.HasEffect("SAVE") && !f.mutation {
		e.Persistence["state"] = "UNKNOWN"
		if e.RequestSatisfied {
			e.Persistence["state"] = "SAVE_ACKNOWLEDGED"
		}
	}
	switch b {
	case "DELIVERED":
		e.Persistence["state"] = "DELIVERED"
	case "PENDING_DELIVERY":
		e.Persistence["state"] = "PENDING_DELIVERY"
	case "DELIVERY_FAILED":
		e.Persistence["state"] = "DELIVERY_FAILED"
		e.Reason = "artifact delivery failed"
	}
	if e.RequestSatisfied {
		e.NextAction = "continue"
	}
	if !f.mutation && f.req.Action == "pcb.pour.rebuild" && e.RequestSatisfied {
		e.AutosaveEligible = true
		e.FreshnessRestored = true
	}
	// Existing reload recognizer remains a legacy adapter, not a new save barrier.
	if f.req.Action == "debug.exec_js" && b == "UNVERIFIED" && f.resp != nil && f.resp.OK {
		code, _ := f.req.Payload["code"].(string)
		e.FreshnessRestored = strings.Contains(code, "closeDocument")
	}
	return e
}
func containsAll(observed, required []string) bool {
	for _, v := range required {
		found := false
		for _, o := range observed {
			if v == o {
				found = true
			}
		}
		if !found {
			return false
		}
	}
	return true
}
func verifiedNegative(r map[string]any) bool {
	return r["partial"] == true || r["deleted"] == false || r["disconnected"] == false || nonempty(r["notApplied"]) || nonempty(r["survived"]) || nonempty(r["survivedIds"]) || positiveNumber(r["survivedTotal"])
}
func positiveNumber(v any) bool { n, ok := jsonValue(v).(float64); return ok && n > 0 }
func sideEffectEvidence(v any) (bool, bool) {
	o, ok := v.(map[string]any)
	if !ok {
		return false, false
	}
	wrote := o["mutation_started"] == true || o["write_attempted"] == true || nonempty(o["created_ids"]) || nonempty(o["deleted_ids"])
	pending := o["native_settled"] == false
	if items, ok := o["item_results"].([]any); ok {
		for _, v := range items {
			if item, ok := v.(map[string]any); ok && item["status"] == "applied" {
				wrote = true
			}
		}
	}
	return wrote, pending
}
