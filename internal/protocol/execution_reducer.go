package protocol

import (
	"encoding/json"
)

// These are ephemeral facts for one projection, not persisted execution state.
type executionFacts struct {
	req                                                                                 *Request
	resp                                                                                *Response
	contract                                                                            ActionContract
	raw                                                                                 map[string]any
	receipt                                                                             receiptFacts
	possible, incomplete, absence                                                       bool
	prior                                                                               *Execution
	meta                                                                                *Execution
	invalid                                                                             any
	before, preview, mutation, effectful, observed, unsettled, priorUncertain, negative bool
	attributionMismatch                                                                 bool
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
	if resp != nil && req.ID != resp.ID {
		f.attributionMismatch = true
		f.issue = "CONFLICT"
		// Keep foreign evidence as evidence, never as current-request execution facts.
		if resp.Execution != nil {
			wire, _ := jsonValue(resp.Execution).(map[string]any)
			if wire["decision_basis"] == "CONFLICT" {
				f.meta.PriorEvidence = wire["prior_evidence"]
			} else {
				f.meta.PriorEvidence = jsonValue(resp.Execution)
			}
		}
		return f
	}
	if resp != nil {
		f.raw = resp.Result
		f.prior = resp.Execution
		f.meta.ObservedTargetAfter = resp.Context
	}
	f.receipt = normalizeReceipt(f)
	f.observed, f.unsettled = f.receipt.side["write"], f.receipt.side["unsettled"]
	f.possible, f.incomplete, f.absence = f.receipt.side["possible"], f.receipt.side["incomplete"], f.receipt.side["absence"]
	if f.prior != nil {
		f.effectful = f.effectful || f.prior.PossibleEffect
		// A validated pre-dispatch conclusion carries its phase to later projections.
		p := f.prior
		if validExecutionShape(jsonValue(p)) && validPriorTuple(p, c) && p.DecisionBasis == "REFUSED" && p.ContractVersion == c.Version && p.ContractHash == c.Hash && p.RequestID == req.ID && p.RequestID == requestResponseID(resp) && p.WriteAttempted != nil && !*p.WriteAttempted && !p.PossibleEffect && !p.RequestSatisfied && (p.MutationOutcome == NoWrite || !f.mutation && p.MutationOutcome == "") {
			f.before = true
		}
		evidence := f.prior.InvalidEvidence
		if evidence == nil {
			evidence = jsonValue(f.prior)
		}
		side := adaptEvidence(evidence)
		wrote, pending := side["write"], side["unsettled"]
		f.possible = f.possible || side["possible"]
		f.incomplete = f.incomplete || side["incomplete"]
		if validExecutionShape(jsonValue(p)) && validPriorTuple(p, c) && p.ContractVersion == c.Version && p.ContractHash == c.Hash && p.RequestID == req.ID {
			f.observed = f.observed || p.InvalidEvidence == nil && wrote || p.WriteAttempted != nil && *p.WriteAttempted
		}
		f.unsettled = f.unsettled || pending || adaptEvidence(jsonValue(p))["unsettled"]
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
			if !validPriorTuple(f.prior, c) {
				f.issue = "CONFLICT"
			}
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
	if f.observed || f.unsettled || f.possible || f.incomplete {
		f.effectful = true
	}
	f.negative = f.receipt.side["negative"]
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
	p, n := f.prior, f.receipt
	if f.attributionMismatch {
		f.basis = "CONFLICT"
		return f
	}
	risk := f.observed || f.possible || f.incomplete || f.unsettled
	if f.before && !risk && !f.priorUncertain {
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
	if ((f.preview || f.before) && risk) || (f.absence && risk) {
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
		if p.MutationOutcome == NoWrite && risk {
			f.basis = "CONFLICT"
			return f
		}
		if p.WriteAttempted != nil && !*p.WriteAttempted && risk {
			f.basis = "CONFLICT"
			return f
		}
		if f.req.Action == "route.apply_batch" {
			if n.recoveryConflict {
				f.basis = "CONFLICT"
				return f
			}
			if n.itemsConflict {
				f.basis = "CONFLICT"
				return f
			}
		}
	}
	if f.unsettled {
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
	if p != nil && p.DecisionBasis == "REFUSED" && p.WriteAttempted != nil && !*p.WriteAttempted && !risk {
		f.basis = "REFUSED"
		return f
	}
	if n.side["unknown"] && (f.preview || f.absence) {
		f.basis = "UNRESOLVED"
		return f
	}
	if f.preview {
		f.basis = "UNRESOLVED"
		if f.absence || (p != nil && p.MutationOutcome == NoWrite && p.WriteAttempted != nil && !*p.WriteAttempted) {
			f.basis = "PREVIEW"
		}
		return f
	}
	if p != nil && p.MutationOutcome == NoWrite && p.WriteAttempted != nil && !*p.WriteAttempted && !risk {
		f.basis = "NO_WRITE"
		if p.DecisionBasis == "REFUSED" {
			f.basis = "REFUSED"
		}
		return f
	}
	if f.absence && !risk {
		f.basis = "NO_WRITE"
		return f
	}
	if f.mutation {
		if f.req.Action == "route.apply_batch" {
			if n.fastNoWrite {
				f.basis = "NO_WRITE"
				return f
			}
			if n.fastPartial {
				f.basis = "FAST_PARTIAL"
				return f
			}
			if n.fastComplete {
				f.basis = "FAST_COMPLETE"
				return f
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
	if risk && len(f.contract.Effects) == 0 {
		f.basis = "CONFLICT"
		return f
	}
	satisfied := n.acknowledged && !f.negative
	if p != nil && !p.RequestSatisfied && p.Persistence["state"] != "PENDING_DELIVERY" {
		satisfied = false
	}
	if f.contract.HasEffect("SAVE") {
		satisfied = satisfied && n.saveAcknowledged
	}
	if f.contract.HasEffect("ARTIFACT_DELIVERY") {
		delivered := satisfied && n.delivered
		if delivered {
			f.basis = "DELIVERED"
		} else if satisfied && n.pending {
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
	e.RequestID = f.req.ID
	e.ContractVersion = f.contract.Version
	e.ContractHash = f.contract.Hash
	e.DecisionBasis = b
	e.MutationOutcome = ""
	e.WriteAttempted = nil
	if b == "CONFLICT" || b == "INVALID" {
		e.NativeSettled = nil
	}
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
	if (f.possible || f.incomplete || f.unsettled) && e.WriteAttempted != nil && !*e.WriteAttempted {
		e.WriteAttempted = nil
	}
	if f.observed {
		v := true
		e.WriteAttempted = &v
	}
	if !f.attributionMismatch && f.meta.ObservedTargetAfter == nil && f.resp != nil {
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
			e.RequestSatisfied = f.receipt.acknowledged && !f.negative
			e.Reason = "declared no-write preview"
		}
	case "FAST_COMPLETE", "FAST_PARTIAL":
		e.PossibleEffect = true
		v := true
		e.NativeSettled = &v
		e.WriteAttempted = &v
		e.ItemResults = f.receipt.items
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
			e.Verification.Required = append([]string{}, f.contract.Verification.Required...)
			e.Verification.Observed = append([]string{}, f.receipt.verifiedRequirements...)
			e.Verification.Missing = []string{}
			if e.Verification.Source == "" {
				e.Verification.Source = "FastPath.matchesOperation"
			}
			if len(e.Verification.EvidenceRefs) == 0 {
				e.Verification.EvidenceRefs = []string{"result"}
			}
		}
		if f.receipt.restored {
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
		e.AutosaveEligible = f.receipt.acknowledged
		if b == "LEGACY_NEGATIVE" && f.receipt.side["verifiedNegative"] {
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
	if f.req.Action == "debug.exec_js" && b == "UNVERIFIED" && f.receipt.acknowledged {
		e.FreshnessRestored = f.receipt.reload
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

// Only implications of the frozen canonical tuple; legacy evidence without a
// decision_basis still uses the existing conservative compatibility path.
func validPriorTuple(p *Execution, c ActionContract) bool {
	if p.DecisionBasis == "" {
		return true
	}
	if p.RequestSatisfied != (p.NextAction == "continue") {
		return false
	}
	expected := MutationOutcome("")
	if c.ContentMutation() {
		expected = Uncertain
	}
	switch p.DecisionBasis {
	case "REFUSED", "NO_WRITE", "PREVIEW":
		if c.ContentMutation() {
			expected = NoWrite
		}
		return p.MutationOutcome == expected && !p.PossibleEffect && p.WriteAttempted != nil && !*p.WriteAttempted && (p.DecisionBasis == "PREVIEW" || !p.RequestSatisfied)
	case "FAST_COMPLETE":
		return c.ContentMutation() && p.MutationOutcome == Complete && p.RequestSatisfied && p.PossibleEffect && p.WriteAttempted != nil && *p.WriteAttempted && p.NativeSettled != nil && *p.NativeSettled
	case "FAST_PARTIAL":
		return c.ContentMutation() && p.MutationOutcome == Partial && !p.RequestSatisfied && p.PossibleEffect && p.WriteAttempted != nil && *p.WriteAttempted && p.NativeSettled != nil && *p.NativeSettled && p.NextAction == "reconcile_without_replay"
	case "INVALID", "CONFLICT", "UNRESOLVED", "UNVERIFIED", "LEGACY_NEGATIVE":
		return p.MutationOutcome == expected && (!c.ContentMutation() || p.PossibleEffect) && !p.RequestSatisfied && p.NextAction == "reconcile_without_replay" && (p.WriteAttempted == nil || *p.WriteAttempted)
	case "SATISFIED", "DELIVERED":
		return !c.ContentMutation() && p.MutationOutcome == "" && p.RequestSatisfied
	case "REJECTED", "PENDING_DELIVERY", "DELIVERY_FAILED":
		return !c.ContentMutation() && p.MutationOutcome == "" && !p.RequestSatisfied && p.NextAction == "inspect"
	}
	return false
}
