package app

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
)

func TestApplyUnknownReconcilesSameOperationAndContinuesWithoutReplay(t *testing.T) {
	var wireSubmits, nextStepCalls, reconcileCalls int
	var wireOperation string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v2/operation" {
			reconcileCalls++
			if r.Method != http.MethodPost || r.URL.Query().Get("view") != "reconcile" || r.URL.Query().Get("id") != wireOperation {
				t.Errorf("wrong reconcile request: %s %s", r.Method, r.URL.String())
			}
			_ = json.NewEncoder(w).Encode(executionv2.Result{Protocol: executionv2.Version, OperationID: wireOperation, EvidenceRef: wireOperation, Outcome: executionv2.Succeeded, Effects: executionv2.Effects{Started: executionv2.Bool(true), Changed: executionv2.Bool(true), Settled: true, Scope: "DESIGN_CONTENT", Reconciled: true}, Value: json.RawMessage(`{"primitiveId":"wire-1"}`)})
			return
		}
		var req executionv2.Request
		_ = json.NewDecoder(r.Body).Decode(&req)
		if req.Action == "schematic.wire.create" {
			wireSubmits++
			wireOperation = req.OperationID
			_ = json.NewEncoder(w).Encode(executionv2.Result{Protocol: executionv2.Version, OperationID: req.OperationID, EvidenceRef: req.OperationID, Outcome: executionv2.Unknown, Code: "V2_DEADLINE", Effects: executionv2.Effects{Started: executionv2.Bool(true), Changed: nil, Settled: true, Scope: "DESIGN_CONTENT"}})
			return
		}
		nextStepCalls++
		_ = json.NewEncoder(w).Encode(executionv2.Result{Protocol: executionv2.Version, OperationID: req.OperationID, EvidenceRef: req.OperationID, Outcome: executionv2.Succeeded, Effects: executionv2.Effects{Started: executionv2.Bool(false), Changed: executionv2.Bool(false), Settled: true, Scope: "NONE"}, Value: json.RawMessage(`{"count":1}`)})
	}))
	defer server.Close()

	journal := t.TempDir() + "/apply.journal.jsonl"
	var stdout, stderr bytes.Buffer
	runner := &applyRunner{
		cfg: &appConfig{v2Read: fixtureSchematicBinding(server.URL)}, stdout: &stdout, stderr: &stderr,
		pb: &playbook{Version: 1, Meta: playbookMeta{Name: "recover"}, Steps: []playbookStep{
			{ID: "wire", Action: "schematic.wire.create", Payload: map[string]any{"points": []any{0., 0., 10., 0.}}, Capture: map[string]string{"WIRE": "$.primitiveId"}},
			{ID: "read-next", Action: "schematic.read", Assert: map[string]string{"$.count": "==1"}},
		}}, sha: "test", vars: map[string]string{}, journalPath: journal,
	}
	if err := runner.resolveRange("", ""); err != nil {
		t.Fatal(err)
	}
	if err := runner.execute(); err != nil {
		t.Fatalf("apply failed: %v\nstdout=%s\nstderr=%s", err, stdout.String(), stderr.String())
	}
	if wireSubmits != 1 || reconcileCalls != 1 || nextStepCalls != 1 {
		t.Fatalf("wire submits=%d reconcile=%d next=%d", wireSubmits, reconcileCalls, nextStepCalls)
	}
	if runner.vars["WIRE"] != "wire-1" {
		t.Fatalf("capture not restored from reconciled value: %#v", runner.vars)
	}
	raw, err := os.ReadFile(journal)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(raw), `"status":"ok(reconciled)"`) || !strings.Contains(string(raw), `"id":"read-next","status":"ok"`) {
		t.Fatalf("journal=%s", raw)
	}
}

func TestApplyStopsWhenSameOperationReconcileIsNotSucceeded(t *testing.T) {
	var mutationCalls, verifyCalls int
	var operationID string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v2/operation" {
			_ = json.NewEncoder(w).Encode(executionv2.Result{Protocol: executionv2.Version, OperationID: operationID, EvidenceRef: operationID, Outcome: executionv2.Partial, Effects: executionv2.Effects{Started: executionv2.Bool(true), Changed: executionv2.Bool(true), Settled: true, Scope: "DESIGN_CONTENT", Reconciled: true}})
			return
		}
		var req executionv2.Request
		_ = json.NewDecoder(r.Body).Decode(&req)
		if req.Action == "schematic.wire.create" {
			mutationCalls++
			operationID = req.OperationID
			_ = json.NewEncoder(w).Encode(executionv2.Result{Protocol: executionv2.Version, OperationID: operationID, EvidenceRef: operationID, Outcome: executionv2.Unknown, Effects: executionv2.Effects{Started: executionv2.Bool(true), Settled: true, Scope: "DESIGN_CONTENT"}})
			return
		}
		verifyCalls++
		_ = json.NewEncoder(w).Encode(executionv2.Result{Protocol: executionv2.Version, OperationID: req.OperationID, EvidenceRef: req.OperationID, Outcome: executionv2.Succeeded, Effects: executionv2.Effects{Scope: "NONE", Settled: true}, Value: json.RawMessage(`{"count":1}`)})
	}))
	defer server.Close()
	runner := &applyRunner{cfg: &appConfig{v2Read: fixtureSchematicBinding(server.URL)}, stderr: io.Discard, pb: &playbook{}, vars: map[string]string{}}
	step := &playbookStep{Action: "schematic.wire.create", Payload: map[string]any{"points": []any{0., 0., 10., 0.}}, Verify: &verifyBlock{Action: "schematic.read", Assert: map[string]string{"$.count": "==1"}}}
	_, _, err := runner.executeStep(step, actionCatalog())
	if err == nil || mutationCalls != 1 || verifyCalls != 0 {
		t.Fatalf("err=%v mutation=%d verify=%d", err, mutationCalls, verifyCalls)
	}
}
