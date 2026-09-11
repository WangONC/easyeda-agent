package protocol

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"math"
	"strings"
)

// V2 metadata is part of the existing action catalog, never a second registry.
type V2Action struct {
	Diagnostic  bool              `json:"diagnostic,omitempty"`
	Revision    string            `json:"revision"`
	EffectScope string            `json:"effect_scope"`
	Target      string            `json:"target"`
	Input       map[string]string `json:"input"`
}

func (v V2Action) SchemaID() string {
	b, _ := json.Marshal(v)
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}
func ValidateV2(r executionv2.Request) (executionv2.Admission, error) {
	for _, a := range AllActions() {
		if a.Name != r.Action {
			continue
		}
		if a.V2Disposition != nil {
			return executionv2.Admission{}, errors.New("V2_ACTION_" + a.V2Disposition.Mode + ": " + a.V2Disposition.Reason)
		}
		v := a.V2
		if v == nil {
			return executionv2.Admission{}, errors.New("V2_ACTION_NOT_MIGRATED")
		}
		if r.ActionRevision != v.Revision || r.Schema != v.SchemaID() {
			return executionv2.Admission{}, errors.New("V2_SCHEMA_MISMATCH")
		}
		if r.ExpectedRevision != nil {
			return executionv2.Admission{}, errors.New("V2_REVISION_NOT_SUPPORTED")
		}
		targetKind := v.Target
		if r.Action == "document.open" && r.Input["reload"] == true {
			targetKind = "DOCUMENT"
			if r.Input["uuid"] != r.Target.DocumentUUID || (r.Target.DocumentType != "pcb" && r.Target.DocumentType != "schematic") {
				return executionv2.Admission{}, errors.New("V2_RELOAD_TARGET_MISMATCH")
			}
		}
		// Active-page inventory may carry a stricter document binding. Its
		// existing controlled traversal verifies restoration of that exact page.
		if r.Action == "schematic.components.list" && r.Target.Scope == "DOCUMENT" {
			targetKind = "schematic"
		}
		if targetKind != "ANY" && targetKind != r.Target.Scope && !(r.Target.Scope == "DOCUMENT" && targetKind == r.Target.DocumentType) {
			return executionv2.Admission{}, errors.New("V2_TARGET_MISMATCH")
		}
		for k, t := range v.Input {
			if strings.HasPrefix(t, "!") {
				if _, ok := r.Input[k]; !ok {
					return executionv2.Admission{}, errors.New("V2_MISSING_INPUT:" + k)
				}
			}
		}
		for k, x := range r.Input {
			t, ok := v.Input[k]
			if !ok {
				return executionv2.Admission{}, errors.New("V2_UNKNOWN_INPUT:" + k)
			}
			valid := false
			switch strings.TrimPrefix(t, "!") {
			case "string":
				v, ok := x.(string)
				valid = ok && (!strings.HasPrefix(t, "!") || v != "")
			case "string|number":
				switch v := x.(type) {
				case string:
					valid = strings.TrimSpace(v) != ""
				case float64:
					valid = !math.IsNaN(v) && !math.IsInf(v, 0)
				}
			case "number":
				v, ok := x.(float64)
				valid = ok && !math.IsNaN(v) && !math.IsInf(v, 0)
			case "boolean":
				_, valid = x.(bool)
			case "string|array", "string|string[]":
				switch v := x.(type) {
				case string:
					valid = v != ""
				case []any:
					valid = true
					for _, item := range v {
						if _, ok := item.(string); !ok {
							valid = false
						}
					}
				}
			case "string[]":
				values, ok := x.([]any)
				valid = ok
				for _, item := range values {
					str, ok := item.(string)
					if !ok || str == "" {
						valid = false
					}
				}
			case "string|number|array":
				switch v := x.(type) {
				case string:
					valid = strings.TrimSpace(v) != ""
				case float64:
					valid = !math.IsNaN(v) && !math.IsInf(v, 0)
				case []any:
					valid = true
				}
			case "array":
				_, valid = x.([]any)
			case "object":
				_, valid = x.(map[string]any)
			}
			if !valid {
				return executionv2.Admission{}, errors.New("V2_INVALID_INPUT:" + k)
			}
		}
		return executionv2.Admission{EffectScope: v.EffectScope, Diagnostic: v.Diagnostic}, nil
	}
	return executionv2.Admission{}, errors.New("V2_ACTION_NOT_MIGRATED")
}
