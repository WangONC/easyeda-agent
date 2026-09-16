package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
)

func TestV2UnknownRestartReconcileSameOperationWithoutReplay(t *testing.T) {
	path := filepath.Join(t.TempDir(), "receipts.json")
	old := New(Options{V2ReceiptFile: path})
	startupConn(old)
	if err := old.markV2Running(); err != nil {
		t.Fatal(err)
	}
	var nativeWrites atomic.Int32
	late := make(chan executionv2.HandlerResult, 1)
	old.v2 = executionv2.New(32, old.validateV2, func(r executionv2.Request, digest string) <-chan executionv2.HandlerResult {
		nativeWrites.Add(1)
		old.v2Mu.Lock()
		old.v2Pending[r.OperationID] = v2Pending{request: r, windowID: "s", started: time.Now()}
		old.v2Mu.Unlock()
		if err := old.markV2Effect(r, digest); err != nil {
			t.Fatal(err)
		}
		return late
	})
	old.v2.OnPersist(old.persistV2Snapshot)

	req := startupRequest("schematic.rename", "restart-owner")
	req.Target = executionv2.Target{Scope: "PROJECT", Session: "s", Activation: "a", ProjectUUID: "p"}
	req.Input = map[string]any{"schematicUuid": "schematic", "name": "USB-C_5V_to_3V3"}
	req.BudgetMS = 5
	result, err := old.v2.Submit(context.Background(), req)
	if err != nil || result.Outcome != executionv2.Unknown || result.Code != "V2_DEADLINE" {
		t.Fatalf("initial = %#v, %v", result, err)
	}
	digest, _ := req.Digest()
	late <- executionv2.HandlerResult{Protocol: executionv2.Version, OperationID: req.OperationID, Digest: digest, Target: req.Target, Effects: executionv2.Effects{Started: executionv2.Bool(true), Changed: executionv2.Bool(true), Settled: true, Scope: "PROJECT_TOPOLOGY"}, Verification: executionv2.Verification{Verdict: "unavailable"}}
	deadline := time.Now().Add(time.Second)
	for {
		evidence, _ := old.v2.Evidence(req.OperationID)
		data, _ := os.ReadFile(path)
		if evidence.Effects.Settled && bytes.Contains(data, []byte(`"native_settled":true`)) {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("late settled evidence was not persisted")
		}
		time.Sleep(time.Millisecond)
	}
	var durable executionv2.Handoff
	data, err := os.ReadFile(path)
	if err != nil || json.Unmarshal(data, &durable) != nil || durable.Owner != req.OperationID || len(durable.Receipts) != 1 {
		t.Fatalf("durable operation record missing: %v %#v", err, durable)
	}
	receipt := durable.Receipts[0]
	if receipt.Request.OperationID != req.OperationID || receipt.Digest != digest || receipt.Request.Target != req.Target || receipt.WindowID != "s" || receipt.Result.Outcome != executionv2.Unknown || !receipt.Evidence.Effects.Settled || receipt.Evidence.Verification.Verdict != "unavailable" {
		t.Fatalf("incomplete durable recovery contract: %#v", receipt)
	}

	next := New(Options{V2ReceiptFile: path})
	if !next.v2StartupFenced() {
		t.Fatal("restored UNKNOWN did not fence startup")
	}
	if got, ok := next.v2.Status(req.OperationID); !ok || got.Outcome != executionv2.Unknown {
		t.Fatalf("restored status = %#v, %v", got, ok)
	}
	if evidence, ok := next.v2.Evidence(req.OperationID); !ok || !evidence.Effects.Settled {
		t.Fatalf("restored evidence = %#v, %v", evidence, ok)
	}

	current := newConn(nil, time.Now())
	current.windowID, current.activationID, current.transportID = "s", "a", "new-transport"
	current.caps = []string{"execution.v2"}
	current.ctx = protocol.Context{ProjectUUID: "p", DocumentUUID: "d", DocumentType: "pcb", TabID: "t"}
	next.hub.add(current)
	if ids := next.rebindV2Transport(current); len(ids) != 1 || ids[0] != req.OperationID {
		t.Fatalf("rebind ids = %v", ids)
	}
	fresh := executionv2.HandlerResult{Protocol: executionv2.Version, OperationID: req.OperationID, Digest: digest, Target: req.Target, Effects: executionv2.Effects{Started: executionv2.Bool(true), Changed: executionv2.Bool(true), Settled: true, Scope: "PROJECT_TOPOLOGY", Reconciled: true}, Verification: executionv2.Verification{Verdict: "satisfied", Complete: true, Required: 2, Satisfied: 2, Checked: []string{"fresh_uuid", "fresh_host_canonical_name"}}, Value: json.RawMessage(`{"uuid":"schematic","name":"usb-c_5v_to_3v3","requestedName":"USB-C_5V_to_3V3"}`)}
	frame, _ := json.Marshal(map[string]any{"type": "v2_result", "result": fresh})
	next.deliverV2(current, frame)
	got, ok := next.v2.Status(req.OperationID)
	if !ok || got.Outcome != executionv2.Succeeded || !got.Effects.Reconciled {
		t.Fatalf("reconciled = %#v, %v", got, ok)
	}
	if next.v2StartupFenced() || next.v2.EffectOwner() != "" {
		t.Fatal("terminal reconciliation did not release startup/effect fences")
	}
	if nativeWrites.Load() != 1 {
		t.Fatalf("native writes = %d, want 1", nativeWrites.Load())
	}
	nextRequest := startupRequest("pcb.save", "next-mutation")
	nextRequest.Target.Session = "new-transport"
	if _, err := next.validateV2(nextRequest); err != nil {
		t.Fatalf("next mutation remained fenced: %v", err)
	}
}

func TestV2RestoredUnprovableOperationIsQueryableNot404(t *testing.T) {
	path := filepath.Join(t.TempDir(), "receipts.json")
	old := New(Options{V2ReceiptFile: path})
	startupConn(old)
	req := startupRequest("pcb.save", "unprovable")
	digest, _ := req.Digest()
	result := executionv2.Result{Protocol: executionv2.Version, OperationID: req.OperationID, Outcome: executionv2.Unknown, Code: "V2_DEADLINE", EvidenceRef: req.OperationID, Effects: executionv2.Effects{Scope: "SAVE"}}
	h := executionv2.Handoff{Version: "execution.v2.handoff.1", Owner: req.OperationID, Receipts: []executionv2.Receipt{{Request: req, Digest: digest, Result: result, Scope: "SAVE", TimedOut: true, WindowID: "s"}}}
	if err := executionv2.PersistHandoff(path, h); err != nil {
		t.Fatal(err)
	}
	if err := old.writeV2Lifecycle(v2Lifecycle{Version: "execution.v2.lifecycle.1", State: "effect_started", OperationID: req.OperationID, Digest: digest}); err != nil {
		t.Fatal(err)
	}
	next := New(Options{V2ReceiptFile: path})
	server := httptest.NewServer(next.routes(0))
	defer server.Close()
	for _, view := range []string{"status", "evidence"} {
		res, err := http.Get(server.URL + "/v2/operation?id=" + req.OperationID + "&view=" + view)
		if err != nil || res.StatusCode != http.StatusOK {
			t.Fatalf("%s = %v, %v", view, res, err)
		}
		res.Body.Close()
	}
	res, err := http.Post(server.URL+"/v2/operation?id="+req.OperationID+"&view=reconcile", "application/json", bytes.NewReader(nil))
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var body bytes.Buffer
	_, _ = body.ReadFrom(res.Body)
	if res.StatusCode != http.StatusConflict || !strings.Contains(body.String(), "V2_RECONCILIATION_UNAVAILABLE_AFTER_RESTART") {
		t.Fatalf("reconcile = %d %s", res.StatusCode, body.String())
	}
	if !next.v2StartupFenced() || next.v2.EffectOwner() != req.OperationID {
		t.Fatal("unprovable operation was unsafely released")
	}
}
