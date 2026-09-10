package protocol

import "encoding/json"

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
	if !validExecutionShape(raw) {
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
		decoded = plain{InvalidEvidence: raw}
	}
	*e = Execution(decoded)
	return nil
}

func validExecutionShape(raw any) bool {
	e, ok := raw.(map[string]any)
	if !ok {
		return false
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
		state, ok := obj["state"].(string)
		if !ok || state == "" {
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
