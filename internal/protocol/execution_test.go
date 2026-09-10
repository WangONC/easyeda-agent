package protocol

import (
	"encoding/json"
	"os"
	"reflect"
	"strings"
	"testing"
)

func TestExecutionTruthTable(t *testing.T) {
	b, e := os.ReadFile("testdata/execution.json")
	if e != nil {
		t.Fatal(e)
	}
	var cases []struct {
		Name          string
		Request       Request
		Response      Response
		Before        bool
		WantOutcome   MutationOutcome `json:"want_outcome"`
		WantSatisfied bool            `json:"want_satisfied"`
	}
	if e = json.Unmarshal(b, &cases); e != nil {
		t.Fatal(e)
	}
	for _, c := range cases {
		t.Run(c.Name, func(t *testing.T) {
			before, _ := json.Marshal(c.Response)
			got := Interpret(&c.Request, &c.Response, c.Before)
			if got.MutationOutcome != c.WantOutcome || got.RequestSatisfied != c.WantSatisfied {
				t.Fatalf("%+v", got)
			}
			after, _ := json.Marshal(c.Response)
			if string(before) != string(after) {
				t.Fatal("native evidence changed")
			}
		})
	}
}
func TestCatalogContractProjection(t *testing.T) {
	b, e := os.ReadFile("../../extension/src/action-contracts.json")
	if e != nil {
		t.Fatal(e)
	}
	var generated map[string]ActionContract
	if e = json.Unmarshal(b, &generated); e != nil {
		t.Fatal(e)
	}
	actions := AllActions()
	if len(actions) != len(generated) {
		t.Fatal("catalog size drift")
	}
	for _, a := range actions {
		c := a.Contract
		if !reflect.DeepEqual(c, generated[a.Name]) {
			t.Errorf("stale generated contract %s", a.Name)
		}
		if c.Hash == "" || c.Version != ContractVersion || c.Executor == "" || c.AutonomousEligibility != "EXCLUDED" {
			t.Errorf("invalid/default-safe contract %s", a.Name)
		}
		for _, d := range c.Dependencies {
			if _, ok := generated[d]; !ok {
				t.Errorf("missing dependency %s -> %s", a.Name, d)
			}
		}
	}
}
func TestUnsupportedPreviewAndExecutor(t *testing.T) {
	for _, action := range []string{"pcb.line.create", "pcb.via.create", "route.apply_batch"} {
		r := Request{Action: action, Payload: map[string]any{"dryRun": true}}
		if e := ValidateContract(&r, "DAEMON"); e == nil || e.Code != "INVALID_DRY_RUN" {
			t.Fatal(action, e)
		}
		if Preview(&r) {
			t.Fatal("unknown flag changed effects")
		}
	}
	for _, action := range []string{"pcb.plane.refresh", "pcb.drc.compare"} {
		if e := ValidateContract(&Request{Action: action}, "DAEMON"); e == nil || e.Code != "EXECUTOR_UNAVAILABLE" {
			t.Fatal(action, e)
		}
	}
	if e := ValidateContract(&Request{Action: "pcb.line.create", ContractVersion: "unknown"}, "DAEMON"); e == nil || e.Code != "CONTRACT_MISMATCH" {
		t.Fatal(e)
	}
}
func TestExecutionSchemaParity(t *testing.T) {
	b, e := os.ReadFile("../../extension/src/protocol.ts")
	if e != nil {
		t.Fatal(e)
	}
	for _, typ := range []reflect.Type{reflect.TypeOf(Execution{}), reflect.TypeOf(Evidence{})} {
		for i := 0; i < typ.NumField(); i++ {
			key := strings.Split(typ.Field(i).Tag.Get("json"), ",")[0]
			if !strings.Contains(string(b), key+":") && !strings.Contains(string(b), key+"?:") {
				t.Errorf("TS missing %s", key)
			}
		}
	}
	for _, v := range []MutationOutcome{NoWrite, Complete, Partial, Uncertain} {
		if !strings.Contains(string(b), "'"+string(v)+"'") {
			t.Fatal("enum drift", v)
		}
	}
}
func TestBareStructuredCompleteCannotPass(t *testing.T) {
	c, _ := ContractFor("pcb.component.modify")
	r := Request{Action: "pcb.component.modify"}
	resp := Response{OK: true, Execution: &Execution{ContractVersion: c.Version, ContractHash: c.Hash, MutationOutcome: Complete, RequestSatisfied: true}}
	got := Interpret(&r, &resp, false)
	if got.MutationOutcome != Uncertain || got.RequestSatisfied {
		t.Fatal(got)
	}
}
