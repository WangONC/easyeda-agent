package protocol

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"
)

const ContractVersion = "execution.v1.3"

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
	wireMetadata            map[string]any
	decodedInvalid          bool
	childResponseEvidence   json.RawMessage
	presentConclusionFields map[string]bool
	PriorEvidence           any             `json:"prior_evidence,omitempty"`
	DecisionBasis           string          `json:"decision_basis,omitempty"`
	PossibleEffect          bool            `json:"possible_effect,omitempty"`
	AutosaveEligible        bool            `json:"autosave_eligible,omitempty"`
	HealthEffect            string          `json:"health_effect,omitempty"`
	FreshnessRestored       bool            `json:"freshness_restored,omitempty"`
	InvalidEvidence         any             `json:"invalid_evidence,omitempty"`
	ChildResponses          []Response      `json:"child_responses,omitempty"`
	NativeSettled           *bool           `json:"native_settled,omitempty"`
	OperationID             string          `json:"operation_id,omitempty"`
	ParentOperationID       string          `json:"parent_operation_id,omitempty"`
	RequestID               string          `json:"request_id"`
	ContractVersion         string          `json:"contract_version"`
	ContractHash            string          `json:"contract_hash"`
	PayloadHash             string          `json:"payload_hash,omitempty"`
	ExpectedTarget          *Context        `json:"expected_target,omitempty"`
	ObservedTargetBefore    *Context        `json:"observed_target_before,omitempty"`
	ObservedTargetAfter     *Context        `json:"observed_target_after,omitempty"`
	Activation              string          `json:"activation,omitempty"`
	ExecutorBuild           string          `json:"executor_build,omitempty"`
	MutationOutcome         MutationOutcome `json:"mutation_outcome,omitempty"`
	WriteAttempted          *bool           `json:"write_attempted,omitempty"`
	ItemResults             any             `json:"item_results,omitempty"`
	AffectedTargets         []Context       `json:"affected_targets,omitempty"`
	Verification            Evidence        `json:"verification"`
	Recovery                map[string]any  `json:"recovery"`
	Persistence             map[string]any  `json:"persistence"`
	RequestSatisfied        bool            `json:"request_satisfied"`
	NextAction              string          `json:"next_action"`
	Reason                  string          `json:"reason"`
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
func NegativeResult(r map[string]any) bool { return adaptEvidence(r)["negative"] }

// Interpret has one path: validate evidence, reconcile it, then derive all conclusions.
func Interpret(req *Request, resp *Response, beforeDispatch bool) *Execution {
	return deriveExecution(reconcileExecution(validateExecution(req, resp, beforeDispatch)))
}
func RequestSatisfied(req *Request, resp *Response) bool {
	return Interpret(req, resp, false).RequestSatisfied
}

// CanonicalConclusion is the only legacy adapter used by downstream consumers.
// It normalizes every input without mutating the raw response.
func CanonicalConclusion(req *Request, resp *Response) *Execution { return Interpret(req, resp, false) }

func PossibleMutation(req *Request, resp *Response) bool {
	return CanonicalConclusion(req, resp).PossibleEffect
}

func pendingArtifacts(resp *Response) bool {
	if len(resp.Artifacts) == 0 {
		return false
	}
	for _, a := range resp.Artifacts {
		if (a.Path == "" || a.SHA256 == "") && a.InlineBase64 == "" {
			return false
		}
	}
	return true
}
func fastComplete(r map[string]any, payload map[string]any) bool {
	return r["readback_verified"] == true && r["rollback_attempted"] == false && r["rollback_complete"] == false && !NegativeResult(r) && fastSettled(r, payload, true)
}
func jsonValue(v any) any {
	b, err := json.Marshal(v)
	if err != nil {
		return nil
	}
	var out any
	if json.Unmarshal(b, &out) != nil {
		return nil
	}
	return out
}
func stringIDs(v any) ([]string, bool) {
	a, ok := jsonValue(v).([]any)
	if !ok {
		return nil, false
	}
	ids := []string{}
	seen := map[string]bool{}
	for _, v := range a {
		id, ok := v.(string)
		if !ok || id == "" || seen[id] {
			return nil, false
		}
		seen[id] = true
		ids = append(ids, id)
	}
	return ids, true
}
func fastNoWrite(r map[string]any) bool {
	created, cok := stringIDs(r["created_ids"])
	deleted, dok := stringIDs(r["deleted_ids"])
	items, ok := jsonValue(r["item_results"]).([]any)
	return cok && dok && ok && len(created) == 0 && len(deleted) == 0 && len(items) == 0
}

// Existing Fast terminal status plus a complete indexed receipt establishes settlement.
// It never overrides an explicit native_settled=false from an attributed execution.
func fastSettled(r map[string]any, payload map[string]any, complete bool) bool {
	if r["mutation_started"] != true || r["duplicate"] == true {
		return false
	}
	for _, key := range []string{"revision_before", "revision_after"} {
		v, ok := r[key].(string)
		if !ok || strings.TrimSpace(v) == "" {
			return false
		}
	}
	if r["revision_before"] == r["revision_after"] {
		return false
	}
	if v, ok := r["duplicate"]; ok {
		if _, valid := v.(bool); !valid {
			return false
		}
	}
	if !complete && r["readback_verified"] != false {
		return false
	}
	if r["rollback_complete"] == true && (r["rollback_attempted"] != true || nonempty(r["deleted_ids"])) {
		return false
	}
	if base, ok := payload["base_revision"]; ok && base != r["revision_before"] {
		return false
	}
	if v, ok := r["native_settled"]; ok && v != true {
		return false
	}
	if _, ok := r["rollback_attempted"].(bool); !ok {
		return false
	}
	if _, ok := r["rollback_complete"].(bool); !ok {
		return false
	}
	created, cok := stringIDs(r["created_ids"])
	deleted, dok := stringIDs(r["deleted_ids"])
	if !cok || !dok {
		return false
	}
	items, iok := jsonValue(r["item_results"]).([]any)
	ops, ook := jsonValue(payload["operations"]).([]any)
	if !iok || !ook || len(items) == 0 || len(items) != len(ops) {
		return false
	}
	failed := -1
	f, exists := r["failed_index"]
	if !exists {
		return false
	}
	if complete {
		if f != nil {
			return false
		}
	} else {
		n, ok := jsonValue(f).(float64)
		if !ok || n < 0 || n >= float64(len(items)) || n != float64(int(n)) {
			return false
		}
		failed = int(n)
	}
	wantCreated := map[string]bool{}
	wantDeleted := map[string]bool{}
	seen := map[string]bool{}
	for i, v := range items {
		item, ok := v.(map[string]any)
		if !ok {
			return false
		}
		index, ok := item["index"].(float64)
		if !ok || index != float64(i) {
			return false
		}
		op, ok := ops[i].(map[string]any)
		if !ok {
			return false
		}
		typ, _ := op["type"].(string)
		add := typ == "add_trace" || typ == "add_arc" || typ == "add_via"
		del := typ == "delete_trace" || typ == "delete_via"
		if !add && !del {
			return false
		}
		status := "applied"
		if failed >= 0 && i == failed {
			status = "failed"
		}
		if failed >= 0 && i > failed {
			status = "skipped"
		}
		if item["status"] != status {
			return false
		}
		if status != "applied" {
			if _, has := item["id"]; has {
				return false
			}
			continue
		}
		id, ok := item["id"].(string)
		if !ok || id == "" || seen[id] {
			return false
		}
		seen[id] = true
		if add {
			wantCreated[id] = true
		} else {
			if op["id"] != id {
				return false
			}
			wantDeleted[id] = true
		}
	}
	if len(created) != len(wantCreated) || len(deleted) != len(wantDeleted) {
		return false
	}
	for _, id := range created {
		if !wantCreated[id] {
			return false
		}
	}
	for _, id := range deleted {
		if !wantDeleted[id] {
			return false
		}
	}
	return true
}
