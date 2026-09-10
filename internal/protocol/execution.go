package protocol

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"
)

const ContractVersion = "execution.v1"

type ActionContract struct {
	Operations            []string             `json:"operations,omitempty"`
	Version               string               `json:"version"`
	Hash                  string               `json:"hash"`
	Executor              string               `json:"executor"`
	Effects               []string             `json:"effects"`
	TargetScope           string               `json:"target_scope"`
	DryRun                string               `json:"dry_run"`
	Guard                 []string             `json:"guard"`
	Verification          VerificationContract `json:"verification"`
	ReplayPolicy          string               `json:"replay_policy"`
	Recovery              string               `json:"recovery"`
	Dependencies          []string             `json:"dependencies"`
	SupportedParameters   []string             `json:"supported_parameters"`
	AutonomousEligibility string               `json:"autonomous_eligibility"`
	ExclusionReason       string               `json:"exclusion_reason"`
}

type VerificationContract struct {
	VerifierRefs        []string `json:"verifier_refs"`
	Required            []string `json:"required"`
	Coverage            string   `json:"coverage"`
	Quantization        string   `json:"quantization"`
	ElectricalMapping   bool     `json:"electrical_mapping"`
	PersistenceRequired bool     `json:"persistence_required"`
}

// This enriches the existing catalog, never maintains a second registry.
// EXCLUDED is deliberate: schema adoption is not Host qualification.
func withContracts(actions []ActionSpec) []ActionSpec {
	for i := range actions {
		a := &actions[i]
		c := ActionContract{Version: ContractVersion, Executor: "CONNECTOR", Effects: []string{}, TargetScope: "DOCUMENT", DryRun: "unsupported", Guard: []string{}, Verification: VerificationContract{VerifierRefs: append([]string{}, a.VerifyWith...), Required: []string{}, Coverage: "COMPLETE", Quantization: "existing verifier only; no generic tolerance"}, ReplayPolicy: "read_only_retry", Recovery: "reconcile_only", Dependencies: []string{}, SupportedParameters: append([]string{}, a.Inputs...), AutonomousEligibility: "EXCLUDED", ExclusionReason: "Legacy execution has not completed target, recovery and Host qualification migration"}
		if a.Mutates {
			c.Effects = []string{"DESIGN_CONTENT"}
			c.ReplayPolicy = "receipt_or_reconcile"
		}
		switch a.Domain {
		case DomainProject, DomainBoard:
			c.TargetScope = "PROJECT"
			if a.Mutates {
				c.Effects = []string{"PROJECT_TOPOLOGY"}
			}
		case DomainLibrary:
			c.TargetScope = "LIBRARY"
			if a.Mutates {
				c.Effects = []string{"LIBRARY_ASSET"}
			}
		case DomainSystem:
			c.TargetScope = "HOME"
		}
		if strings.HasSuffix(a.Name, ".save") {
			c.Effects = []string{"SAVE"}
			c.Verification.PersistenceRequired = true
		}
		if strings.HasPrefix(a.Name, "view.") || strings.Contains(a.Name, ".view.") || a.Name == "pcb.layers.set_current" || a.Name == "pcb.layers.visibility" || strings.HasSuffix(a.Name, ".open") || strings.HasSuffix(a.Name, ".select") {
			c.Effects = []string{"NAVIGATION_SELECTION"}
			c.ReplayPolicy = "bounded_navigation"
		}
		if strings.HasSuffix(a.Name, ".drc.check") || a.Name == "pcb.pour.rebuild" {
			c.Effects = []string{"NATIVE_RECOMPUTE"}
		}
		if a.Domain == DomainArtifact || strings.Contains(a.Name, ".export") {
			c.Effects = append(c.Effects, "ARTIFACT_DELIVERY")
		}
		if a.Name == "debug.exec_js" {
			c.Effects = []string{"DESIGN_CONTENT", "PROJECT_TOPOLOGY", "LIBRARY_ASSET", "NAVIGATION_SELECTION", "NATIVE_RECOMPUTE", "SAVE", "ARTIFACT_DELIVERY"}
		}
		switch a.Name {
		case "system.health":
			c.Executor = "DAEMON"
		case "route.preflight", "route.tuning_plan", "route.pair_plan", "pcb.routing_profile":
			c.Executor = "DAEMON"
			c.Dependencies = []string{"board.snapshot_compact"}
		case "pcb.plane.refresh":
			c.Executor = "CLI_COMPOSITE"
			c.Dependencies = []string{"board.snapshot_compact", "pcb.pour.list", "pcb.pour.rebuild"}
			c.Effects = []string{"NATIVE_RECOMPUTE"}
		case "pcb.drc.compare":
			c.Executor = "CLI_COMPOSITE"
			c.Dependencies = []string{"board.snapshot_compact", "pcb.drc.check"}
			c.Effects = []string{"NATIVE_RECOMPUTE", "ARTIFACT_DELIVERY"}
		case "route.apply_batch":
			c.Operations = []string{"add_trace", "add_arc", "add_via", "delete_trace", "delete_via"}
			c.Verification.Required = []string{"net", "layer", "geometry", "width", "hole", "diameter", "deleted_absence", "all_operations", "no_pending_native_write"}
			c.Recovery = "existing_fast_owned_compensation; deletions not restorable"
		case "schematic.create":
			c.TargetScope = "PROJECT"
			c.Effects = []string{"PROJECT_TOPOLOGY"}
		case "schematic.page.clear", "pcb.page.clear", "pcb.beautify":
			c.DryRun = "preview"
		}
		if c.TargetScope == "DOCUMENT" {
			c.Guard = []string{"project_uuid", "document_uuid", "document_type", "activation"}
		}
		raw, _ := json.Marshal(struct {
			Name     string
			Contract ActionContract
		}{a.Name, c})
		h := sha256.Sum256(raw)
		c.Hash = hex.EncodeToString(h[:])
		a.Contract = c
	}
	return actions
}
func ContractFor(action string) (ActionContract, bool) {
	for _, a := range AllActions() {
		if a.Name == action {
			return a.Contract, true
		}
	}
	return ActionContract{}, false
}
func (c ActionContract) HasEffect(effect string) bool {
	for _, e := range c.Effects {
		if e == effect {
			return true
		}
	}
	return false
}
func (c ActionContract) ContentMutation() bool {
	return c.HasEffect("DESIGN_CONTENT") || c.HasEffect("PROJECT_TOPOLOGY") || c.HasEffect("LIBRARY_ASSET")
}
func Preview(req *Request) bool {
	c, ok := ContractFor(req.Action)
	return ok && c.DryRun == "preview" && req.Payload["dryRun"] == true
}

// Empty contract identity remains explicitly legacy; an explicit mismatch is refused.
func ValidateContract(req *Request, executor string) *ErrorInfo {
	c, ok := ContractFor(req.Action)
	if !ok {
		return &ErrorInfo{Code: "UNKNOWN_ACTION", Message: "No action contract"}
	}
	if req.ContractVersion != "" && req.ContractVersion != c.Version || req.ContractHash != "" && req.ContractHash != c.Hash {
		return &ErrorInfo{Code: "CONTRACT_MISMATCH", Message: "Execution contract mismatch"}
	}
	if req.Payload["dryRun"] == true && c.DryRun != "preview" {
		return &ErrorInfo{Code: "INVALID_DRY_RUN", Message: "Action does not implement a no-write preview"}
	}
	if executor == "DAEMON" && (c.Executor == "CLI_COMPOSITE" || c.Executor == "LOCAL") || executor == "CONNECTOR" && c.Executor != "CONNECTOR" {
		return &ErrorInfo{Code: "EXECUTOR_UNAVAILABLE", Message: "This entry point does not execute this action"}
	}
	return nil
}

type MutationOutcome string

const (
	NoWrite   MutationOutcome = "NO_WRITE"
	Complete  MutationOutcome = "COMPLETE"
	Partial   MutationOutcome = "PARTIAL"
	Uncertain MutationOutcome = "UNCERTAIN"
)

type Evidence struct {
	State           string   `json:"state"`
	Coverage        string   `json:"coverage"`
	Scope           *Context `json:"scope,omitempty"`
	Source          string   `json:"source,omitempty"`
	Revision        string   `json:"revision,omitempty"`
	Activation      string   `json:"activation,omitempty"`
	ObservedAt      string   `json:"observed_at,omitempty"`
	VerifierVersion string   `json:"verifier_version,omitempty"`
	Required        []string `json:"required"`
	Observed        []string `json:"observed"`
	Missing         []string `json:"missing"`
	EvidenceRefs    []string `json:"evidence_refs"`
}
type Execution struct {
	NativeSettled        *bool           `json:"native_settled,omitempty"`
	OperationID          string          `json:"operation_id,omitempty"`
	ParentOperationID    string          `json:"parent_operation_id,omitempty"`
	RequestID            string          `json:"request_id"`
	ContractVersion      string          `json:"contract_version"`
	ContractHash         string          `json:"contract_hash"`
	PayloadHash          string          `json:"payload_hash,omitempty"`
	ExpectedTarget       *Context        `json:"expected_target,omitempty"`
	ObservedTargetBefore *Context        `json:"observed_target_before,omitempty"`
	ObservedTargetAfter  *Context        `json:"observed_target_after,omitempty"`
	Activation           string          `json:"activation,omitempty"`
	ExecutorBuild        string          `json:"executor_build,omitempty"`
	MutationOutcome      MutationOutcome `json:"mutation_outcome,omitempty"`
	WriteAttempted       *bool           `json:"write_attempted,omitempty"`
	ItemResults          any             `json:"item_results,omitempty"`
	AffectedTargets      []Context       `json:"affected_targets,omitempty"`
	Verification         Evidence        `json:"verification"`
	Recovery             map[string]any  `json:"recovery"`
	Persistence          map[string]any  `json:"persistence"`
	RequestSatisfied     bool            `json:"request_satisfied"`
	NextAction           string          `json:"next_action"`
	Reason               string          `json:"reason"`
}

func nonempty(v any) bool {
	switch x := v.(type) {
	case []any:
		return len(x) > 0
	case []string:
		return len(x) > 0
	case map[string]any:
		return len(x) > 0
	}
	return false
}
func NegativeResult(r map[string]any) bool {
	if r["partial"] == true || r["verified"] == false || r["deleted"] == false || r["disconnected"] == false || nonempty(r["notApplied"]) || nonempty(r["survived"]) || nonempty(r["survivedIds"]) {
		return true
	}
	switch n := r["survivedTotal"].(type) {
	case int:
		if n > 0 {
			return true
		}
	case float64:
		if n > 0 {
			return true
		}
	}
	switch r["status"] {
	case "partial", "uncertain", "stale", "failed", "unverified":
		return true
	}
	return false
}

// Interpret only projects evidence. It never changes OK, native status, receipts or health.
// beforeDispatch is supplied by a known control-flow boundary, NEVER an error code.
func Interpret(req *Request, resp *Response, beforeDispatch bool) *Execution {
	c, _ := ContractFor(req.Action)
	e := &Execution{OperationID: req.OperationID, ParentOperationID: req.ParentOperationID, RequestID: req.ID, ContractVersion: c.Version, ContractHash: c.Hash, ExpectedTarget: req.ExpectedTarget, Verification: Evidence{State: "UNAVAILABLE", Coverage: "PARTIAL", Required: []string{}, Observed: []string{}, Missing: []string{}, EvidenceRefs: []string{}}, Recovery: map[string]any{"state": "NOT_REQUESTED"}, Persistence: map[string]any{"state": "NOT_REQUESTED"}, NextAction: "inspect", Reason: "legacy evidence does not prove semantic completion"}
	if e.OperationID == "" {
		e.OperationID, _ = req.Payload["client_transaction_id"].(string)
	}
	mutation := c.ContentMutation()
	if mutation {
		e.MutationOutcome = Uncertain
		e.NextAction = "reconcile_without_replay"
	}
	if beforeDispatch {
		if mutation {
			e.MutationOutcome = NoWrite
		}
		b := false
		e.WriteAttempted = &b
		e.Reason = "refused before dispatch"
		return e
	}
	if resp == nil {
		return e
	}
	if Preview(req) {
		e.MutationOutcome = NoWrite
		b := false
		e.WriteAttempted = &b
		e.RequestSatisfied = resp.OK && !NegativeResult(resp.Result)
		e.Reason = "declared no-write preview"
		return e
	}
	// Structured producer claims are checked, not trusted as verified booleans.
	if prior := resp.Execution; prior != nil && (req.Action != "route.apply_batch" || prior.MutationOutcome == NoWrite) {
		copy := *prior
		copy.Persistence = map[string]any{}
		for k, v := range prior.Persistence {
			copy.Persistence[k] = v
		}
		e = &copy
		cvalid := prior.ContractVersion == c.Version && prior.ContractHash == c.Hash && prior.RequestID == resp.ID && (req.ID == "" || req.ID == resp.ID)
		if mutation {
			valid := cvalid
			switch prior.MutationOutcome {
			case NoWrite:
				valid = valid && prior.WriteAttempted != nil && !*prior.WriteAttempted && resp.Result["mutation_started"] != true && !nonempty(resp.Result["created_ids"]) && !nonempty(resp.Result["deleted_ids"])
				if prior.RequestSatisfied {
					valid = valid && completeEvidence(prior.Verification)
				}
			case Complete:
				valid = valid && prior.NativeSettled != nil && *prior.NativeSettled && len(c.Verification.Required) > 0 && completeEvidence(prior.Verification) && !NegativeResult(resp.Result) && prior.Recovery["state"] != "RESTORED"
			case Partial:
				valid = valid && prior.NativeSettled != nil && *prior.NativeSettled && prior.WriteAttempted != nil && *prior.WriteAttempted && completeEvidence(prior.Verification)
				e.RequestSatisfied = false
			case Uncertain:
				e.RequestSatisfied = false
			default:
				valid = false
			}
			if !valid {
				e.MutationOutcome = Uncertain
				e.RequestSatisfied = false
				e.Reason = "incomplete or conflicting execution evidence"
				e.NextAction = "reconcile_without_replay"
			}
			return e
		}
	}
	if prior := resp.Execution; prior != nil && !mutation && (!prior.RequestSatisfied || prior.ContractVersion != c.Version || prior.ContractHash != c.Hash || prior.Verification.State == "INVALID" || prior.Verification.State == "UNSUPPORTED") {
		e.RequestSatisfied = false
		return e
	}
	e.ObservedTargetAfter = resp.Context
	r := resp.Result
	if mutation {
		// Fast Path owns its status and readback semantics. Keep its complete historical
		// receipt intact but never treat a cached receipt as fresh current proof.
		if req.Action == "route.apply_batch" {
			e.ItemResults = r["item_results"]
			if b, ok := r["mutation_started"].(bool); ok {
				e.WriteAttempted = &b
			}
			switch r["status"] {
			case "stale", "partial":
				if r["mutation_started"] == false && !nonempty(r["created_ids"]) && !nonempty(r["deleted_ids"]) {
					e.MutationOutcome = NoWrite
				} else if r["status"] == "partial" && r["mutation_started"] == true && r["revision_after"] != nil {
					e.MutationOutcome = Partial
				}
			case "complete":
				if fastComplete(r, req.Payload) {
					e.MutationOutcome = Complete
					e.RequestSatisfied = true
					e.Verification.State = "AVAILABLE"
					e.Verification.Coverage = "COMPLETE"
					e.Verification.Source = "FastPath.matchesOperation"
					e.Verification.EvidenceRefs = []string{"result"}
					e.NextAction = "continue"
					e.Reason = "Fast Path semantic readback"
				}
			}
			if r["rollback_complete"] == true && e.MutationOutcome == Partial {
				e.Recovery = map[string]any{"state": "RESTORED", "evidence_refs": []string{"result"}}
				if e.MutationOutcome != Uncertain {
					e.MutationOutcome = Partial
					e.RequestSatisfied = false
				}
			}
		}
	} else {
		e.RequestSatisfied = resp.OK && !NegativeResult(r) && r["ok"] != false && r["saved"] != false
		if c.HasEffect("SAVE") {
			e.RequestSatisfied = e.RequestSatisfied && r["saved"] == true
			if e.RequestSatisfied {
				e.Persistence["state"] = "SAVE_ACKNOWLEDGED"
			} else {
				e.Persistence["state"] = "UNKNOWN"
			}
		}
		if c.HasEffect("ARTIFACT_DELIVERY") {
			e.RequestSatisfied = e.RequestSatisfied && len(resp.Artifacts) > 0
			for _, a := range resp.Artifacts {
				if a.Path == "" || a.SHA256 == "" {
					e.RequestSatisfied = false
				}
			}
		}
	}
	if Preview(req) {
		e.MutationOutcome = NoWrite
		b := false
		e.WriteAttempted = &b
		e.RequestSatisfied = resp.OK && !NegativeResult(r)
		e.Reason = "declared no-write preview"
	}
	// Stage A accepts only this reducer's proof; arbitrary verified/outcome fields
	// are not an authorization channel. Future migrated producers need a verifier.
	return e
}
func RequestSatisfied(req *Request, resp *Response) bool {
	return Interpret(req, resp, false).RequestSatisfied
}
func PossibleMutation(req *Request, resp *Response) bool {
	if resp == nil {
		return false
	}
	if resp.Execution != nil {
		return resp.Execution.MutationOutcome == Complete || resp.Execution.MutationOutcome == Partial || resp.Execution.MutationOutcome == Uncertain
	}
	return resp.OK
}

func completeEvidence(v Evidence) bool {
	if v.State != "AVAILABLE" || v.Coverage != "COMPLETE" || len(v.Required) == 0 || len(v.Missing) > 0 || len(v.EvidenceRefs) == 0 || v.Activation == "" || v.Revision == "" || v.ObservedAt == "" || v.VerifierVersion == "" || v.Source == "" || v.Scope == nil {
		return false
	}
	for _, field := range v.Required {
		found := false
		for _, observed := range v.Observed {
			if field == observed {
				found = true
			}
		}
		if !found {
			return false
		}
	}
	return true
}

func fastComplete(r map[string]any, payload map[string]any) bool {
	if r["readback_verified"] != true || r["mutation_started"] != true || r["duplicate"] == true || r["rollback_attempted"] != false || r["rollback_complete"] != false || NegativeResult(r) {
		return false
	}
	for _, key := range []string{"revision_before", "revision_after"} {
		s, ok := r[key].(string)
		if !ok || s == "" {
			return false
		}
	}
	if value, ok := r["failed_index"]; !ok || value != nil {
		return false
	}
	// Marshal handles typed Fast Go structures and decoded JSON identically.
	b, err := json.Marshal(r["item_results"])
	if err != nil {
		return false
	}
	var items []struct {
		Index  int
		Status string
		ID     string
	}
	if json.Unmarshal(b, &items) != nil || len(items) == 0 {
		return false
	}
	for i, item := range items {
		if item.Index != i || item.Status != "applied" || item.ID == "" {
			return false
		}
	}
	for _, key := range []string{"created_ids", "deleted_ids"} {
		b, _ := json.Marshal(r[key])
		var ids []string
		if json.Unmarshal(b, &ids) != nil || ids == nil {
			return false
		}
	}
	if ops, ok := payload["operations"]; ok {
		b, _ := json.Marshal(ops)
		var list []any
		if json.Unmarshal(b, &list) != nil || len(list) != len(items) {
			return false
		}
	}
	return true
}
