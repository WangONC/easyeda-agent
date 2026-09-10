package daemon

import (
	"encoding/json"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestContractRejectedBeforeConnectorLookup(t *testing.T) {
	s := New(Options{})
	for _, body := range []string{`{"action":"pcb.line.create","payload":{"dryRun":true}}`, `{"action":"pcb.via.create","contractHash":"stale"}`, `{"action":"pcb.plane.refresh"}`} {
		w := httptest.NewRecorder()
		s.handleAction(w, httptest.NewRequest(http.MethodPost, "/action", strings.NewReader(body)))
		var resp protocol.Response
		if e := json.Unmarshal(w.Body.Bytes(), &resp); e != nil {
			t.Fatal(e)
		}
		if w.Code != 400 || resp.OK || resp.Execution == nil || resp.Execution.RequestSatisfied || resp.Error.Code == "NO_CONNECTOR" {
			t.Fatal(w.Body.String())
		}
	}
}
func TestExecutionHealthAndLateVerifyUseOneSample(t *testing.T) {
	tr := newWriteHealthTracker()
	req := protocol.Request{Envelope: protocol.Envelope{ID: "one"}, Action: "route.apply_batch"}
	resp := &protocol.Response{OK: false, Result: map[string]any{"status": "complete", "mutation_started": true, "readback_verified": true, "revision_before": "b", "revision_after": "r", "failed_index": nil, "item_results": []any{map[string]any{"index": 0, "status": "applied", "id": "x"}}, "created_ids": []string{"x"}, "deleted_ids": []string{}, "rollback_attempted": false, "rollback_complete": false}}
	verdict := effectFromResponse(&req, resp)
	if verdict != effectLanded {
		t.Fatal(verdict)
	}
	tr.observe("w", outcome{Action: req.Action, RequestID: req.ID, OK: resp.OK, Verdict: verdict})
	for i := 0; i < 2; i++ {
		tr.verify("w", WriteVerification{Action: req.Action, RequestID: req.ID, Landed: 1})
	}
	if len(tr.byWindow["w"].recent) != 1 {
		t.Fatal("duplicate sample")
	}
}
func TestStructuredPossibleMutationDoesNotRewriteOK(t *testing.T) {
	req := &protocol.Request{Envelope: protocol.Envelope{WindowID: "w"}, Action: "pcb.component.modify"}
	for _, o := range []protocol.MutationOutcome{protocol.Complete, protocol.Partial, protocol.Uncertain, protocol.NoWrite} {
		g := newStaleGuard()
		resp := &protocol.Response{OK: false, Execution: &protocol.Execution{MutationOutcome: o}}
		g.observe(req, resp)
		if resp.OK {
			t.Fatal("OK changed")
		}
		if (g.last["w"] != "") != (o != protocol.NoWrite) {
			t.Fatal(o, g.last)
		}
	}
}

func TestAddressedLateVerifyBackfillRemainsIdempotent(t *testing.T) {
	tr := newWriteHealthTracker()
	for i := 0; i < 2; i++ {
		tr.verify("w", WriteVerification{Action: "pcb.component.modify", RequestID: "aged-out", Landed: 1})
	}
	if len(tr.byWindow["w"].recent) != 1 {
		t.Fatal("duplicate addressed telemetry")
	}
}
