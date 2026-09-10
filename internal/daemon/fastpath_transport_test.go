package daemon

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/zhoushoujianwork/easyeda-agent/internal/fastpath"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
	"github.com/zhoushoujianwork/easyeda-agent/internal/workflow"
	"sync/atomic"
	"testing"
	"time"
)

// Exercise actual HTTP -> daemon gates -> WS framing, with no running EasyEDA.
func TestFastPathHTTPWebSocket(t *testing.T) {
	t.Setenv(workflow.EnvDir, t.TempDir())
	base, cleanup := startDaemon(t)
	defer cleanup()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	c, _, e := websocket.Dial(ctx, "ws://"+base+"/eda", nil)
	if e != nil {
		t.Fatal(e)
	}
	defer c.Close(websocket.StatusNormalClosure, "")
	if e = wsjson.Write(ctx, c, protocol.Register{Type: protocol.TypeRegister, WindowID: "fast-test", ConnectorVersion: "1.4.4", Capabilities: []string{fastpath.Capability}}); e != nil {
		t.Fatal(e)
	}
	if e = wsjson.Write(ctx, c, protocol.ContextMessage{Type: protocol.TypeContext, WindowID: "fast-test", ProjectUUID: "p", ProjectName: "fixture", DocumentUUID: "d", DocumentType: "pcb"}); e != nil {
		t.Fatal(e)
	}
	var count atomic.Int32
	board, plan := fastFixture(8, 4)
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			_, data, e := c.Read(ctx)
			if e != nil {
				return
			}
			var req protocol.Request
			if json.Unmarshal(data, &req) != nil || req.Type != protocol.TypeRequest {
				continue
			}
			count.Add(1)
			result := map[string]any{}
			if req.Action == "board.snapshot_compact" {
				_ = fastpath.Decode(board, &result)
				result["native_api_call_count"] = 14
			} else if req.Action == "route.apply_batch" {
				board.Revision = "fixture:2"
				result = map[string]any{"status": "complete", "readback_verified": true, "revision_before": "fixture:1", "revision_after": board.Revision, "native_api_call_count": 40}
			}
			response := protocol.Response{Envelope: protocol.Envelope{ID: req.ID, Type: protocol.TypeResponse, Version: "v1"}, OK: true, Result: result}
			response.Execution = protocol.Interpret(&req, &response, false)
			_ = wsjson.Write(ctx, c, response)
		}
	}()
	defer func() { cancel(); <-done }()
	for {
		w := waitForWindow(t, base, "fast-test")
		if w.Context.ProjectUUID == "p" {
			break
		}
		select {
		case <-ctx.Done():
			t.Fatal("context not registered")
		case <-time.After(10 * time.Millisecond):
		}
	}
	call := func(action string, payload any) protocol.Response {
		p := map[string]any{}
		_ = fastpath.Decode(payload, &p)
		p["document_uuid"] = "d"
		body, _ := json.Marshal(map[string]any{"action": action, "project": "fixture", "windowId": "fast-test", "payload": p})
		return postAction(t, base, string(body))
	}
	blocked := call("route.apply_batch", map[string]any{})
	if blocked.Error == nil || blocked.Error.Code != "STAGE_BLOCKED" || count.Load() != 0 || blocked.Result["telemetry"] == nil {
		t.Fatalf("gate/telemetry: %+v", blocked)
	}
	st, _ := workflow.Load("fixture")
	st.Confirm(workflow.StageOutlineConfirmed, "test", "")
	st.Confirm(workflow.StagePreRoutePassed, "test", "")
	if e = workflow.Save(st); e != nil {
		t.Fatal(e)
	}
	if r := call("board.snapshot_compact", map[string]any{}); !r.OK {
		t.Fatal(r)
	}
	checked := call("route.preflight", plan)
	if !checked.OK || checked.Result["ok"] != true || checked.Execution == nil || !checked.Execution.RequestSatisfied || len(checked.Execution.ChildResponses) != 1 {
		t.Fatal(checked)
	}
	if checked.Execution.OperationID != checked.ID || checked.Execution.ChildResponses[0].Execution.ParentOperationID != checked.Execution.OperationID {
		t.Fatal("legacy parent/child operation ownership lost")
	}
	local, _ := fastpath.Preflight(board, plan)
	applied := call("route.apply_batch", map[string]any{"base_revision": plan.Base, "plan_hash": checked.Result["plan_hash"], "client_transaction_id": "http-fixture", "operations": local.Operations})
	if !applied.OK {
		t.Fatal(applied)
	}
	verified := call("board.snapshot_compact", map[string]any{"include": map[string]bool{"traces": true, "vias": true}})
	if !verified.OK || verified.StaleRisk == "" || verified.Result["board_revision"] != "fixture:2" {
		t.Fatal(verified)
	}
	if count.Load() != 4 {
		t.Fatal(fmt.Sprintf("%d WS actions, want4", count.Load()))
	}
	// Legacy native DRC is still blocked; fast snapshot did not clear stale connectivity.
	drc := call("pcb.drc.check", map[string]any{})
	if drc.Error == nil || drc.Error.Code != "STALE_READ" {
		t.Fatal(drc)
	}
}
