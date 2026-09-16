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
		if err := ValidateV2BusinessInput(r.Action, r.Input, v.Input); err != nil {
			return executionv2.Admission{}, err
		}
		return executionv2.Admission{EffectScope: v.EffectScope, Diagnostic: v.Diagnostic}, nil
	}
	return executionv2.Admission{}, errors.New("V2_ACTION_NOT_MIGRATED")
}

func ValidateV2BusinessInput(action string, input map[string]any, schema map[string]string) error {
	if err := ValidateV2Input(input, schema); err != nil {
		return err
	}
	return validateActionSpecificInput(action, input)
}

func validateActionSpecificInput(action string, input map[string]any) error {
	finiteNumber := func(v any) bool {
		n, ok := v.(float64)
		return ok && !math.IsNaN(n) && !math.IsInf(n, 0) && math.Abs(n) < 1e8
	}
	objects := func(key string, min, max int) ([]any, error) {
		rows, ok := input[key].([]any)
		if !ok || len(rows) < min || len(rows) > max {
			return nil, errors.New("V2_INVALID_INPUT:" + key)
		}
		for _, row := range rows {
			if _, ok := row.(map[string]any); !ok {
				return nil, errors.New("V2_INVALID_INPUT:" + key)
			}
		}
		return rows, nil
	}
	if action == "placement.preflight" || action == "placement.apply_batch" {
		rows, err := objects("placements", 1, 256)
		if err != nil {
			return err
		}
		ids := map[string]bool{}
		for _, raw := range rows {
			p := raw.(map[string]any)
			id, ok := p["primitiveId"].(string)
			layer, lok := p["layer"].(float64)
			if !ok || id == "" || ids[id] || !finiteNumber(p["x"]) || !finiteNumber(p["y"]) || !finiteNumber(p["rotation"]) || !lok || (layer != 1 && layer != 2) {
				return errors.New("V2_INVALID_INPUT:placements")
			}
			ids[id] = true
			for key := range p {
				if key != "primitiveId" && key != "x" && key != "y" && key != "rotation" && key != "layer" && key != "locked" {
					return errors.New("V2_UNKNOWN_INPUT:placements." + key)
				}
			}
			if locked, exists := p["locked"]; exists {
				if _, ok := locked.(bool); !ok {
					return errors.New("V2_INVALID_INPUT:placements.locked")
				}
			}
		}
	}
	if action == "pcb.add_components_batch" {
		rows, err := objects("components", 1, 256)
		if err != nil {
			return err
		}
		designators, uniqueIDs := map[string]bool{}, map[string]bool{}
		for _, raw := range rows {
			p := raw.(map[string]any)
			for key := range p {
				if key != "libraryUuid" && key != "uuid" && key != "designator" && key != "uniqueId" && key != "channelId" && key != "nets" && key != "x" && key != "y" && key != "rotation" && key != "layer" {
					return errors.New("V2_UNKNOWN_INPUT:components." + key)
				}
			}
			lib, lok := p["libraryUuid"].(string)
			uuid, uok := p["uuid"].(string)
			d, dok := p["designator"].(string)
			u, iok := p["uniqueId"].(string)
			layer, laok := p["layer"].(float64)
			nets, nok := p["nets"].(map[string]any)
			if !lok || lib == "" || !uok || uuid == "" || !dok || d == "" || !iok || u == "" || designators[d] || uniqueIDs[u] || !finiteNumber(p["x"]) || !finiteNumber(p["y"]) || !finiteNumber(p["rotation"]) || !laok || (layer != 1 && layer != 2) || !nok || len(nets) == 0 {
				return errors.New("V2_INVALID_INPUT:components")
			}
			designators[d] = true
			uniqueIDs[u] = true
			for pad, net := range nets {
				if pad == "" {
					return errors.New("V2_INVALID_INPUT:components.nets")
				}
				if _, ok := net.(string); !ok {
					return errors.New("V2_INVALID_INPUT:components.nets")
				}
			}
			if ch, exists := p["channelId"]; exists {
				if value, ok := ch.(string); !ok || value == "" {
					return errors.New("V2_INVALID_INPUT:components.channelId")
				}
			}
		}
	}
	return nil
}

// ValidateV2Input validates a value against an action catalog input map. Public
// projections may pass a filtered map; this keeps catalog types as the single
// schema source instead of reimplementing action contracts in CLI/MCP.
func ValidateV2Input(input map[string]any, schema map[string]string) error {
	for k, t := range schema {
		if strings.HasPrefix(t, "!") {
			if _, ok := input[k]; !ok {
				return errors.New("V2_MISSING_INPUT:" + k)
			}
		}
	}
	for k, x := range input {
		t, ok := schema[k]
		if !ok {
			return errors.New("V2_UNKNOWN_INPUT:" + k)
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
		case "number[4]":
			values, ok := x.([]any)
			valid = ok && len(values) == 4
			for _, item := range values {
				v, ok := item.(float64)
				if !ok || math.IsNaN(v) || math.IsInf(v, 0) {
					valid = false
				}
			}
		case "object":
			_, valid = x.(map[string]any)
		}
		if !valid {
			return errors.New("V2_INVALID_INPUT:" + k)
		}
	}
	return nil
}
