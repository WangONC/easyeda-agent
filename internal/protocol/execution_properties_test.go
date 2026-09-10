package protocol

import (
	"bytes"
	"encoding/json"
	"os/exec"
	"reflect"
	"testing"
)

// The generator varies evidence, intent and acknowledgements independently. Its
// seed and case number identify every failure; it does not derive expected outcomes.
func TestExecutionSeededPropertiesAndParity(t *testing.T) {
	executionProperties(t, "execution-properties.cjs", 4096)
}
func TestEvidenceInventoryIndependentOracleAndParity(t *testing.T) {
	executionProperties(t, "execution-evidence-properties.cjs", 0)
}
func TestActualPreviewReceiptsParity(t *testing.T) {
	executionProperties(t, "execution-preview-fixtures.cjs", 0)
}
func executionProperties(t *testing.T, script string, size int) {
	cmd := exec.Command("node", "../../scripts/"+script, "--json")
	raw, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("generator: %v %s", err, raw)
	}
	var cases []struct {
		Name                              string
		Request                           Request
		Response                          Response
		Before, Locked, Effect, Malformed bool
		Semantic                          map[string]bool
	}
	if err = json.Unmarshal(raw, &cases); err != nil {
		t.Fatal(err)
	}
	if size > 0 && len(cases) != size {
		t.Fatalf("unexpected scale %d", len(cases))
	}
	cmd = exec.Command("node", "../../scripts/test-execution-parity.mjs")
	cmd.Stdin = bytes.NewReader(raw)
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("TS: %v %s", err, output)
	}
	var projected []struct{ First, Repeated json.RawMessage }
	if err = json.Unmarshal(output, &projected); err != nil {
		t.Fatal(err)
	}
	normalize := func(x any) any { b, _ := json.Marshal(x); var v any; _ = json.Unmarshal(b, &v); return v }
	for i, c := range cases {
		e := Interpret(&c.Request, &c.Response, c.Before)
		checkIndependentSemantics(t, c.Name, c.Semantic, e)
		expected := normalize(e)
		r := c.Response
		r.Execution = e
		if !reflect.DeepEqual(expected, normalize(Interpret(&c.Request, &r, c.Before))) {
			t.Fatalf("%s Go idempotence\n%s\n%s", c.Name, mustJSON(e), mustJSON(Interpret(&c.Request, &r, c.Before)))
		}
		for _, encoded := range []json.RawMessage{projected[i].First, projected[i].Repeated} {
			var v any
			_ = json.Unmarshal(encoded, &v)
			if !reflect.DeepEqual(expected, v) {
				t.Fatalf("%s full Go/TS parity\nGo %s\nTS %s", c.Name, mustJSON(e), encoded)
			}
			var returned Execution
			if err = json.Unmarshal(encoded, &returned); err != nil {
				t.Fatal(c.Name, err)
			}
			r.Execution = &returned
			if !reflect.DeepEqual(expected, normalize(Interpret(&c.Request, &r, c.Before))) {
				t.Fatalf("%s TS->Go round trip", c.Name)
			}
		}
		if e.MutationOutcome == Complete && (!e.RequestSatisfied || e.NextAction != "continue" || !e.PossibleEffect || e.NativeSettled == nil || !*e.NativeSettled || e.Verification.State != "AVAILABLE" || e.Verification.Coverage != "COMPLETE" || len(e.Verification.Missing) > 0 || !containsAll(e.Verification.Observed, e.Verification.Required)) {
			t.Fatal(c.Name, "inconsistent COMPLETE")
		}
		if !e.RequestSatisfied && e.NextAction == "continue" {
			t.Fatal(c.Name, "stale success permission")
		}
		if e.DecisionBasis == "INVALID" || e.DecisionBasis == "CONFLICT" || e.DecisionBasis == "UNRESOLVED" {
			if e.MutationOutcome == Complete || e.RequestSatisfied || e.AutosaveEligible || e.HealthEffect != "UNKNOWN" || e.NextAction != "reconcile_without_replay" {
				t.Fatal(c.Name, "unresolved gained permission")
			}
		}
		if c.Malformed && (e.MutationOutcome == Complete || e.RequestSatisfied) {
			t.Fatal(c.Name, "malformed promoted success")
		}
		if c.Locked && (e.MutationOutcome == Complete || e.MutationOutcome == NoWrite || e.HealthEffect != "UNKNOWN") {
			t.Fatal(c.Name, "uncertainty upgraded")
		}
		if c.Effect && (!e.PossibleEffect || e.MutationOutcome == NoWrite) {
			t.Fatal(c.Name, "intent suppressed effects")
		}
		if e.MutationOutcome == NoWrite && (e.PossibleEffect || e.WriteAttempted == nil || *e.WriteAttempted || e.AutosaveEligible) {
			t.Fatal(c.Name, "inconsistent NO_WRITE")
		}
	}
	t.Logf(script+" cases=%d; complete JSON Go/TS, both round trips, repeated interpretation", len(cases))
}

func TestRefusalKeepsCanonicalPhaseAcrossConsumers(t *testing.T) {
	for _, req := range []Request{
		{Action: "pcb.component.modify", ContractHash: "mismatch"},
		{Action: "pcb.component.modify", Payload: map[string]any{"dryRun": true}},
		{Action: "pcb.page.clear", Payload: map[string]any{"dryRun": "invalid"}},
		{Action: "unknown.action"},
	} {
		resp := Response{OK: false}
		e := Interpret(&req, &resp, true)
		resp.Execution = e
		again := Interpret(&req, &resp, false)
		if mustJSON(e) != mustJSON(again) {
			t.Fatalf("phase lost for %s\n%s\n%s", req.Action, mustJSON(e), mustJSON(again))
		}
		if again.PossibleEffect || again.RequestSatisfied || again.AutosaveEligible {
			t.Fatal("refusal gained effect or permission")
		}
		resp.Result = map[string]any{"mutation_started": true, "deleted_ids": []string{"sentinel"}}
		conflict := Interpret(&req, &resp, false)
		if !conflict.PossibleEffect || conflict.MutationOutcome == NoWrite || conflict.RequestSatisfied {
			t.Fatal("refusal suppressed actual effects")
		}
	}
}

func checkIndependentSemantics(t *testing.T, name string, s map[string]bool, e *Execution) {
	t.Helper()
	if s == nil {
		return
	}
	if s["risk"] && (!e.PossibleEffect || e.MutationOutcome == NoWrite) {
		t.Fatal(name, "risk suppressed")
	}
	if (s["unsettled"] || s["locked"]) && (e.MutationOutcome == Complete || e.HealthEffect != "UNKNOWN") {
		t.Fatal(name, "unresolved evidence upgraded")
	}
	if (s["invalid"] || s["conflict"] || s["blocked"]) && e.MutationOutcome == Complete {
		t.Fatal(name, "blocker promoted complete")
	}
	if e.MutationOutcome == NoWrite && (!s["proof"] || s["risk"] || s["invalid"] || s["conflict"] || s["locked"]) {
		t.Fatal(name, "no-write without uncontradicted proof")
	}
}
