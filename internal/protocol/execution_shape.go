package protocol

import (
	"encoding/json"
	"regexp"
	"time"
)

// Decode malformed nested evidence as an explicit invalid projection rather than
// losing null/missing distinctions through Go zero values. Keep the original wire
// evidence so another entry point cannot reinterpret a repaired-looking receipt.
func (e *Execution) UnmarshalJSON(data []byte) error {
	type plain Execution
	var raw any
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	var decoded plain
	invalid := !validExecutionShape(raw)
	if invalid {
		obj, _ := raw.(map[string]any)
		safe := map[string]any{}
		for k, v := range obj {
			if k != "verification" && k != "recovery" && k != "persistence" {
				safe[k] = v
			}
		}
		b, _ := json.Marshal(safe)
		_ = json.Unmarshal(b, &decoded)
		decoded.InvalidEvidence = raw
	} else if err := json.Unmarshal(data, &decoded); err != nil {
		invalid = true
		decoded = plain{InvalidEvidence: raw}
	}
	*e = Execution(decoded)
	e.decodedInvalid = invalid
	if obj, ok := raw.(map[string]any); ok {
		e.wireMetadata = obj
		if children, exists := obj["child_responses"]; exists {
			e.childResponseEvidence, _ = json.Marshal(children)
		}
		e.presentConclusionFields = map[string]bool{}
		for _, key := range []string{"possible_effect", "autosave_eligible", "freshness_restored"} {
			_, e.presentConclusionFields[key] = obj[key]
		}
	}
	return nil
}

func validExecutionShape(raw any) bool {
	e, ok := raw.(map[string]any)
	if !ok {
		return false
	}
	if _, canonical := e["decision_basis"]; canonical {
		for _, k := range []string{"possible_effect", "autosave_eligible", "freshness_restored"} {
			if _, ok := e[k].(bool); !ok {
				return false
			}
		}
		if !enumField(e, "health_effect", []string{"UNKNOWN", "LANDED", "NOT_LANDED"}, false) {
			return false
		}
	}
	for _, k := range []string{"request_id", "contract_version", "contract_hash", "next_action", "reason"} {
		if _, ok := e[k].(string); !ok {
			return false
		}
	}
	if _, ok := e["request_satisfied"].(bool); !ok {
		return false
	}
	for _, k := range []string{"operation_id", "parent_operation_id", "payload_hash", "activation", "executor_build"} {
		if x, has := e[k]; has {
			if _, ok := x.(string); !ok {
				return false
			}
		}
	}
	for _, k := range []string{"native_settled", "write_attempted", "possible_effect", "autosave_eligible", "freshness_restored"} {
		if x, has := e[k]; has {
			if _, ok := x.(bool); !ok {
				return false
			}
		}
	}
	if !enumField(e, "mutation_outcome", []string{"NO_WRITE", "COMPLETE", "PARTIAL", "UNCERTAIN"}, true) || !enumField(e, "health_effect", []string{"UNKNOWN", "LANDED", "NOT_LANDED"}, true) || !enumField(e, "next_action", []string{"", "inspect", "continue", "reconcile_without_replay"}, false) || !enumField(e, "decision_basis", decisionBases, true) {
		return false
	}
	for _, k := range []string{"expected_target", "observed_target_before", "observed_target_after"} {
		if x, has := e[k]; has && !contextShape(x) {
			return false
		}
	}
	if x, has := e["affected_targets"]; has {
		a, ok := x.([]any)
		if !ok {
			return false
		}
		for _, v := range a {
			if !contextShape(v) {
				return false
			}
		}
	}
	if x, has := e["item_results"]; has {
		if !validItems(x) {
			return false
		}
	}
	if x, has := e["child_responses"]; has {
		a, ok := x.([]any)
		if !ok {
			return false
		}
		for _, v := range a {
			child, ok := v.(map[string]any)
			if !ok || !validChildResponse(child) {
				return false
			}
			if nested, has := child["execution"]; has && nested != nil && !validExecutionShape(nested) {
				return false
			}
		}
	}
	v, ok := e["verification"].(map[string]any)
	if !ok {
		return false
	}
	state, ok := v["state"].(string)
	if !ok || (state != "AVAILABLE" && state != "UNAVAILABLE" && state != "INVALID" && state != "UNSUPPORTED") {
		return false
	}
	coverage, ok := v["coverage"].(string)
	if !ok || (coverage != "COMPLETE" && coverage != "PARTIAL") {
		return false
	}
	for _, k := range []string{"required", "observed", "missing", "evidence_refs"} {
		if !stringList(v[k]) {
			return false
		}
	}
	for _, k := range []string{"source", "revision", "activation", "observed_at", "verifier_version"} {
		if x, has := v[k]; has {
			if _, ok := x.(string); !ok {
				return false
			}
		}
	}
	if x, has := v["scope"]; has {
		if !contextShape(x) {
			return false
		}
	}
	for _, k := range []string{"recovery", "persistence"} {
		obj, ok := e[k].(map[string]any)
		if !ok {
			return false
		}
		states := []string{"NOT_REQUESTED", "RESTORED", "PARTIAL", "FAILED", "PENDING", "UNKNOWN"}
		if k == "persistence" {
			states = []string{"NOT_REQUESTED", "UNKNOWN", "SAVE_ACKNOWLEDGED", "PENDING_DELIVERY", "DELIVERED", "DELIVERY_FAILED"}
		}
		if !enumField(obj, "state", states, false) {
			return false
		}
		if refs, has := obj["evidence_refs"]; has && !stringList(refs) {
			return false
		}
	}
	return true
}
func stringList(v any) bool {
	a, ok := v.([]any)
	if !ok {
		return false
	}
	for _, x := range a {
		if _, ok := x.(string); !ok {
			return false
		}
	}
	return true
}

func contextShape(x any) bool {
	obj, ok := x.(map[string]any)
	if !ok {
		return false
	}
	for _, key := range []string{"projectUuid", "projectName", "documentUuid", "documentType", "tabId", "unit"} {
		if value, has := obj[key]; has {
			if _, ok := value.(string); !ok {
				return false
			}
		}
	}
	return true
}

var decisionBases = []string{"REFUSED", "NO_WRITE", "PREVIEW", "FAST_COMPLETE", "FAST_PARTIAL", "UNVERIFIED", "LEGACY_NEGATIVE", "SATISFIED", "REJECTED", "DELIVERED", "PENDING_DELIVERY", "DELIVERY_FAILED", "INVALID", "CONFLICT", "UNRESOLVED"}

func enumField(o map[string]any, k string, allowed []string, optional bool) bool {
	x, has := o[k]
	if !has {
		return optional
	}
	v, ok := x.(string)
	if !ok {
		return false
	}
	for _, a := range allowed {
		if v == a {
			return true
		}
	}
	return false
}
func validItems(x any) bool {
	a, ok := x.([]any)
	if !ok {
		return false
	}
	for _, v := range a {
		o, ok := v.(map[string]any)
		if !ok {
			return false
		}
		if n, has := o["index"]; has {
			i, ok := n.(float64)
			if !ok || i < 0 || i != float64(int(i)) {
				return false
			}
		}
		if status, has := o["status"]; has {
			if _, ok := status.(string); !ok {
				return false
			}
		}
		if id, has := o["id"]; has {
			if _, ok := id.(string); !ok {
				return false
			}
		}
	}
	return true
}
func validRawEvidence(raw map[string]any, action string) bool {
	r, _ := jsonValue(raw).(map[string]any)
	for _, k := range []string{"ok", "saved", "partial", "verified", "disconnected", "mutation_started", "readback_verified", "rollback_attempted", "rollback_complete", "duplicate", "native_settled", "write_attempted"} {
		if x, has := r[k]; has {
			if _, ok := x.(bool); !ok {
				return false
			}
		}
	}
	if x, has := r["deleted"]; has {
		if _, ok := x.(bool); !ok {
			// Legacy delete handlers also return opaque per-kind counts or item receipts.
			switch x.(type) {
			case map[string]any, []any:
			default:
				return false
			}
		}
	}
	if x, has := r["status"]; has {
		if _, ok := x.(string); !ok {
			return false
		}
		if action == "route.apply_batch" && !enumField(r, "status", []string{"complete", "partial", "uncertain", "stale"}, false) {
			return false
		}
	}
	for _, k := range []string{"created_ids", "deleted_ids"} {
		if x, has := r[k]; has {
			if _, ok := stringIDs(x); !ok {
				return false
			}
		}
	}
	if x, has := r["item_results"]; has && !validItems(x) {
		return false
	}
	for _, k := range []string{"revision_before", "revision_after"} {
		if x, has := r[k]; has && x != nil {
			if _, ok := x.(string); !ok {
				return false
			}
		}
	}
	if x, has := r["failed_index"]; has && x != nil {
		n, ok := x.(float64)
		if !ok || n < 0 || n != float64(int(n)) {
			return false
		}
	}
	if x, has := r["survivedTotal"]; has {
		n, ok := x.(float64)
		if !ok || n < 0 || n != float64(int(n)) {
			return false
		}
	}
	for _, k := range []string{"notApplied", "survived", "survivedIds"} {
		if x, has := r[k]; has {
			switch x.(type) {
			case []any, map[string]any:
			default:
				return false
			}
		}
	}
	return true
}

// Optional fields remain absent on legacy evidence; canonical conclusions always
// serialize the full derived tuple, including explicit false permissions.
func (e Execution) MarshalJSON() ([]byte, error) {
	// Before reduction, forward malformed wire evidence verbatim instead of Go zero values.
	if e.decodedInvalid {
		return json.Marshal(e.InvalidEvidence)
	}
	type plain Execution
	b, err := json.Marshal(plain(e))
	if err != nil || e.DecisionBasis == "" && len(e.presentConclusionFields) == 0 && e.childResponseEvidence == nil && e.wireMetadata == nil {
		return b, err
	}
	var obj map[string]any
	if err = json.Unmarshal(b, &obj); err != nil {
		return nil, err
	}
	if e.DecisionBasis != "" || e.presentConclusionFields["possible_effect"] {
		obj["possible_effect"] = e.PossibleEffect
	}
	if e.DecisionBasis != "" || e.presentConclusionFields["autosave_eligible"] {
		obj["autosave_eligible"] = e.AutosaveEligible
	}
	if e.DecisionBasis != "" || e.presentConclusionFields["freshness_restored"] {
		obj["freshness_restored"] = e.FreshnessRestored
	}
	// Preserve optional empty metadata and extension fields inside evidence objects.
	for _, key := range []string{"operation_id", "parent_operation_id", "payload_hash", "activation", "executor_build", "expected_target", "observed_target_before", "observed_target_after", "affected_targets", "item_results", "verification", "recovery", "persistence"} {
		if original, exists := e.wireMetadata[key]; exists {
			if current, exists := obj[key]; exists {
				obj[key] = mergeWireMetadata(current, original)
			} else {
				obj[key] = original
			}
		}
	}
	// Child receipts are immutable evidence, including optional envelope fields.
	if e.childResponseEvidence != nil {
		obj["child_responses"] = e.childResponseEvidence
	}
	return json.Marshal(obj)
}

// Structured metadata is carried forward; only the reducer's conclusion tuple is replaced.
func mergeWireMetadata(current, original any) any {
	switch c := current.(type) {
	case map[string]any:
		if o, ok := original.(map[string]any); ok {
			for k, v := range o {
				if cv, has := c[k]; has {
					c[k] = mergeWireMetadata(cv, v)
				} else {
					c[k] = v
				}
			}
		}
	case []any:
		if o, ok := original.([]any); ok && len(o) == len(c) {
			for i := range c {
				c[i] = mergeWireMetadata(c[i], o[i])
			}
		}
	}
	return current
}

// Child receipts use the existing Response wire schema. Validate before typed decode.
var receiptTimeShape = regexp.MustCompile("^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\\.[0-9]+)?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$")

func validChildResponse(o map[string]any) bool {
	if _, ok := o["id"].(string); !ok {
		return false
	}
	if _, ok := o["ok"].(bool); !ok {
		return false
	}
	if x, has := o["unordered"]; has {
		if _, ok := x.(bool); !ok {
			return false
		}
	}
	if x, has := o["abandonedIds"]; has && x != nil && !stringList(x) {
		return false
	}
	for _, k := range []string{"type", "version", "windowId", "staleRisk", "concurrentWriter"} {
		if x, has := o[k]; has {
			if _, ok := x.(string); !ok {
				return false
			}
		}
	}
	if x, has := o["createdAt"]; has {
		s, ok := x.(string)
		if !ok {
			return false
		}
		if _, err := time.Parse(time.RFC3339Nano, s); err != nil || !receiptTimeShape.MatchString(s) {
			return false
		}
	}
	for _, k := range []string{"seq", "seqAbandoned"} {
		if x, has := o[k]; has && x != nil {
			n, ok := x.(float64)
			if !ok || n < 0 || n > 9007199254740991 || n != float64(int64(n)) {
				return false
			}
		}
	}
	if x, has := o["result"]; has && x != nil {
		if _, ok := x.(map[string]any); !ok {
			return false
		}
	}
	if x, has := o["context"]; has && x != nil && !contextShape(x) {
		return false
	}
	if x, has := o["warnings"]; has && x != nil && !stringList(x) {
		return false
	}
	if x, has := o["error"]; has && x != nil {
		v, ok := x.(map[string]any)
		if !ok {
			return false
		}
		for _, k := range []string{"code", "message", "detail"} {
			if x, has := v[k]; has {
				if _, ok := x.(string); !ok {
					return false
				}
			}
		}
	}
	if x, has := o["artifacts"]; has && x != nil {
		a, ok := x.([]any)
		if !ok {
			return false
		}
		for _, x := range a {
			v, ok := x.(map[string]any)
			if !ok {
				return false
			}
			for _, k := range []string{"id", "kind", "path", "fileName", "mimeType", "sha256", "inlineBase64"} {
				if x, has := v[k]; has {
					if _, ok := x.(string); !ok {
						return false
					}
				}
			}
			if x, has := v["size"]; has {
				n, ok := x.(float64)
				if !ok || n < 0 || n > 9007199254740991 || n != float64(int64(n)) {
					return false
				}
			}
		}
	}
	return true
}
