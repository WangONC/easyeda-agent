package protocol

import (
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"strings"
	"testing"
)

func TestV2TerminalDispositionsFailClosed(t *testing.T) {
	count := 0
	for _, a := range AllActions() {
		if a.V2Disposition == nil {
			continue
		}
		count++
		if a.V2 != nil || a.V2Disposition.Reason == "" {
			t.Fatal(a.Name)
		}
		_, e := ValidateV2(executionv2.Request{Action: a.Name})
		if e == nil || !strings.Contains(e.Error(), "V2_ACTION_"+a.V2Disposition.Mode) {
			t.Fatal(a.Name, e)
		}
	}
	if count != 7 {
		t.Fatal(count)
	}
}

func TestV2Round2CompleteCatalog(t *testing.T) {
	actions := AllActions()
	if len(actions) != 154 {
		t.Fatal(len(actions))
	}
	native := 0
	for _, a := range actions {
		if a.V2 != nil {
			native++
			if a.V2Disposition != nil {
				t.Fatal(a.Name)
			}
		} else if a.V2Disposition == nil {
			t.Fatalf("unmigrated: %s", a.Name)
		}
	}
	if native != 147 {
		t.Fatal(native)
	}
}

func TestAddComponentsBatchExplicitPinPadMappingContract(t *testing.T) {
	valid := map[string]any{
		"libraryUuid": "library", "uuid": "generic-device", "designator": "J1", "uniqueId": "unique",
		"nets":           map[string]any{"1": "SHELL", "2": "SHELL", "3": "SHELL", "4": "SHELL"},
		"pin_nets":       map[string]any{"EP1": "SHELL", "EP2": "SHELL", "EP3": "SHELL", "EP4": "SHELL"},
		"pin_to_pad_map": map[string]any{"EP1": "1", "EP2": "2", "EP3": "3", "EP4": "4"},
		"x":              1.0, "y": 2.0, "rotation": 0.0, "layer": 1.0,
	}
	if err := ValidateV2BusinessInput("pcb.add_components_batch", map[string]any{"components": []any{valid}}, map[string]string{"components": "!array"}); err != nil {
		t.Fatal(err)
	}
	for name, mutate := range map[string]func(map[string]any){
		"missing map":  func(row map[string]any) { delete(row, "pin_to_pad_map") },
		"unknown pad":  func(row map[string]any) { row["pin_to_pad_map"].(map[string]any)["EP4"] = "9" },
		"net mismatch": func(row map[string]any) { row["pin_nets"].(map[string]any)["EP4"] = "OTHER" },
	} {
		t.Run(name, func(t *testing.T) {
			copyRow := map[string]any{}
			for key, value := range valid {
				copyRow[key] = value
			}
			copyRow["pin_nets"] = map[string]any{"EP1": "SHELL", "EP2": "SHELL", "EP3": "SHELL", "EP4": "SHELL"}
			copyRow["pin_to_pad_map"] = map[string]any{"EP1": "1", "EP2": "2", "EP3": "3", "EP4": "4"}
			mutate(copyRow)
			if err := ValidateV2BusinessInput("pcb.add_components_batch", map[string]any{"components": []any{copyRow}}, map[string]string{"components": "!array"}); err == nil {
				t.Fatal("invalid explicit pin-to-pad relation accepted")
			}
		})
	}
}
