package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestV2HTTPWebSocketReceiptAndDuplicate(t *testing.T) {
	s := New(Options{})
	server := httptest.NewServer(s.routes(0))
	defer server.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	ws, _, e := websocket.Dial(ctx, "ws"+strings.TrimPrefix(server.URL, "http")+"/eda", nil)
	if e != nil {
		t.Fatal(e)
	}
	defer ws.CloseNow()
	var handshake map[string]any
	if e = wsjson.Read(ctx, ws, &handshake); e != nil {
		t.Fatal(e)
	}
	if e = wsjson.Write(ctx, ws, map[string]any{"type": "register", "windowId": "s", "activationId": "s", "capabilities": []string{"execution.v2"}}); e != nil {
		t.Fatal(e)
	}
	if e = wsjson.Write(ctx, ws, map[string]any{"type": "context", "windowId": "s", "projectUuid": "p", "documentUuid": "d", "documentType": "pcb", "tabId": "t"}); e != nil {
		t.Fatal(e)
	}
	for {
		c, ok := s.hub.get("s")
		if ok && c.snapshot().Context.DocumentUUID == "d" {
			break
		}
		select {
		case <-ctx.Done():
			t.Fatal(ctx.Err())
		case <-time.After(time.Millisecond):
		}
	}
	var spec *protocol.V2Action
	for _, a := range protocol.AllActions() {
		if a.Name == "document.current" {
			spec = a.V2
		}
	}
	req := executionv2.Request{Protocol: executionv2.Version, Action: "document.current", ActionRevision: spec.Revision, Schema: spec.SchemaID(), RequestID: "r", OperationID: "op", Target: executionv2.Target{Scope: "DOCUMENT", Session: "s", Activation: "s", ProjectUUID: "p", DocumentUUID: "d", DocumentType: "pcb", TabID: "t"}, Input: map[string]any{}, BudgetMS: 2000}
	body, _ := json.Marshal(req)
	done := make(chan executionv2.Result, 1)
	go func() {
		response, err := http.Post(server.URL+"/v2/operations", "application/json", bytes.NewReader(body))
		if err != nil {
			return
		}
		defer response.Body.Close()
		var out executionv2.Result
		_ = json.NewDecoder(response.Body).Decode(&out)
		done <- out
	}()
	var dispatched struct {
		Type     string              `json:"type"`
		Request  executionv2.Request `json:"request"`
		Digest   string              `json:"digest"`
		Deadline int64               `json:"deadline_unix_ms"`
	}
	if e = wsjson.Read(ctx, ws, &dispatched); e != nil {
		t.Fatal(e)
	}
	if dispatched.Type != "v2_request" || dispatched.Request.OperationID != "op" || dispatched.Deadline <= time.Now().UnixMilli() {
		t.Fatalf("wrong dispatch %+v", dispatched)
	}
	proof := executionv2.HandlerResult{Protocol: executionv2.Version, OperationID: "op", Digest: dispatched.Digest, Target: req.Target, Effects: executionv2.Effects{Started: executionv2.Bool(false), Changed: executionv2.Bool(false), Settled: true, Scope: "NONE"}, Verification: executionv2.Verification{Verdict: "satisfied", Checked: []string{"fresh_document_uuid"}, Complete: true, Required: 1, Satisfied: 1}, Value: json.RawMessage(`{"uuid":"d"}`)}
	if e = wsjson.Write(ctx, ws, map[string]any{"type": "v2_result", "result": proof}); e != nil {
		t.Fatal(e)
	}
	var release map[string]any
	if e = wsjson.Read(ctx, ws, &release); e != nil {
		t.Fatal(e)
	}
	if release["type"] != "v2_release" {
		t.Fatal(release)
	}
	select {
	case result := <-done:
		if result.Outcome != executionv2.Succeeded {
			t.Fatal(result)
		}
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}
	// Drop the first release at the simulated Connector. Reconcile must resend
	// only resolved release authority, not dispatch or a mutation/readback replay.
	recovered, err := http.Post(server.URL+"/v2/operation?id=op&view=reconcile", "application/json", nil)
	if err != nil {
		t.Fatal(err)
	}
	recovered.Body.Close()
	if recovered.StatusCode != http.StatusOK {
		t.Fatal(recovered.StatusCode)
	}
	var repeated map[string]any
	if err = wsjson.Read(ctx, ws, &repeated); err != nil {
		t.Fatal(err)
	}
	if repeated["type"] != "v2_release" || repeated["digest"] != dispatched.Digest {
		t.Fatal(repeated)
	}
	// Same operation is answered from the daemon receipt, not another WS dispatch.
	response, e := http.Post(server.URL+"/v2/operations", "application/json", bytes.NewReader(body))
	if e != nil {
		t.Fatal(e)
	}
	defer response.Body.Close()
	var duplicate executionv2.Result
	if e = json.NewDecoder(response.Body).Decode(&duplicate); e != nil {
		t.Fatal(e)
	}
	if duplicate.Outcome != executionv2.Succeeded || duplicate.OperationID != "op" {
		t.Fatal(duplicate)
	}
}
func TestV2LegacyEndpointsAndUnmigratedAreClosed(t *testing.T) {
	s := New(Options{})
	for _, path := range []string{"/action", "/writeverify"} {
		w := httptest.NewRecorder()
		s.routes(0).ServeHTTP(w, httptest.NewRequest("POST", path, strings.NewReader(`{"action":"debug.exec_js"}`)))
		if w.Code != 410 {
			t.Fatal(path, w.Code)
		}
	}
	req := executionv2.Request{Protocol: executionv2.Version, Action: "unknown.action", ActionRevision: "1", Schema: "x", RequestID: "r", OperationID: "op", Target: executionv2.Target{Scope: "HOME", Session: "s", Activation: "a"}, Input: map[string]any{}, BudgetMS: 100}
	if _, e := s.v2.Submit(context.Background(), req); e == nil || !strings.Contains(e.Error(), "NOT_MIGRATED") {
		t.Fatal(e)
	}
}
