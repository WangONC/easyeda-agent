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
	"sync/atomic"
	"testing"
	"time"
)

func TestRecoveryHTTPUsesOnlyNewReadAndPreservesOriginal(t *testing.T) {
	for _, mode := range []string{"release", "read", "pending", "wrong-document", "wrong-project", "wrong-type", "mutation", "replay-id"} {
		t.Run(mode, func(t *testing.T) {
			s := New(Options{V2HostStartupConfirmed: true})
			server := httptest.NewServer(s.routes(0))
			defer server.Close()
			old := executionv2.Target{Scope: "DOCUMENT", Session: "lost", Activation: "old", ProjectUUID: "p", DocumentUUID: "d", DocumentType: "pcb", TabID: "old-tab"}
			now := old
			now.Session = "current"
			now.Activation = "new"
			now.TabID = "new-tab"
			current := newConn(nil, time.Now())
			current.windowID = now.Session
			current.activationID = now.Activation
			current.caps = []string{"execution.v2"}
			current.ctx = protocol.Context{ProjectUUID: "p", DocumentUUID: "d", DocumentType: "pcb", TabID: "new-tab"}
			s.hub.add(current)
			original := executionv2.Request{Protocol: executionv2.Version, Action: "old-effect", ActionRevision: "1", Schema: "s", RequestID: "old", OperationID: "original", Target: old, Input: map[string]any{}, BudgetMS: 1000}
			var nativeWrites, readCalls, releases atomic.Int32
			s.v2 = executionv2.New(30, func(r executionv2.Request) (executionv2.Admission, error) {
				if r.Action == "old-effect" {
					return executionv2.Admission{EffectScope: "DESIGN_CONTENT"}, nil
				}
				return s.validateV2(r)
			}, func(r executionv2.Request, d string) <-chan executionv2.HandlerResult {
				ch := make(chan executionv2.HandlerResult, 1)
				h := executionv2.HandlerResult{Protocol: executionv2.Version, OperationID: r.OperationID, Digest: d, Target: r.Target, Effects: executionv2.Effects{Started: executionv2.Bool(true), Settled: mode != "pending", Scope: "DESIGN_CONTENT"}, Verification: executionv2.Verification{Verdict: "unavailable"}}
				if r.Action == "old-effect" {
					nativeWrites.Add(1)
				} else {
					readCalls.Add(1)
					h.Effects = executionv2.Effects{Started: executionv2.Bool(false), Changed: executionv2.Bool(false), Settled: true, Scope: "NONE"}
					h.Verification = executionv2.Verification{Verdict: "satisfied", Complete: true, Required: 1, Satisfied: 1, Checked: []string{"fresh_uuid"}}
				}
				ch <- h
				return ch
			})
			s.v2.OnResolved(func(r executionv2.Request, d string) {
				if r.OperationID == "original" {
					releases.Add(1)
				}
			})
			_, _ = s.v2.Submit(context.Background(), original)
			s.v2Pending["original"] = v2Pending{request: original, conn: newConn(nil, time.Now())}
			action := "document.current"
			if mode == "read" {
				action = "board.snapshot_compact"
			}
			if mode == "mutation" {
				action = "pcb.save"
			}
			var spec *protocol.V2Action
			for _, a := range protocol.AllActions() {
				if a.Name == action {
					spec = a.V2
				}
			}
			read := executionv2.Request{Protocol: executionv2.Version, Action: action, ActionRevision: spec.Revision, Schema: spec.SchemaID(), RequestID: "new-read", OperationID: "readback", Target: now, Input: map[string]any{}, BudgetMS: 1000}
			switch mode {
			case "wrong-document":
				read.Target.DocumentUUID = "wrong"
			case "wrong-project":
				read.Target.ProjectUUID = "wrong"
			case "wrong-type":
				read.Target.DocumentType = "schematic"
			case "replay-id":
				read.OperationID = "original"
			}
			view := "release"
			if mode == "read" {
				view = "recover"
			}
			body, _ := json.Marshal(read)
			res, err := http.Post(server.URL+"/v2/operation?id=original&view="+view, "application/json", bytes.NewReader(body))
			if err != nil {
				t.Fatal(err)
			}
			defer res.Body.Close()
			success := mode == "release" || mode == "read"
			if (res.StatusCode == 200) != success {
				t.Fatal(mode, res.StatusCode)
			}
			got, _ := s.v2.Status("original")
			wantOutcome := executionv2.Unknown
			if mode == "release" {
				wantOutcome = executionv2.RetiredUnresolved
			}
			if got.Outcome != wantOutcome || got.OwnershipReleased != (mode == "release") {
				t.Fatal(got)
			}
			if nativeWrites.Load() != 1 {
				t.Fatal("replayed effect")
			}
			if mode == "release" || mode == "read" || mode == "pending" {
				if readCalls.Load() != 1 {
					t.Fatal("missing read")
				}
			} else if readCalls.Load() != 0 {
				t.Fatal("invalid recovery dispatched")
			}
			if mode == "release" {
				if releases.Load() != 1 || s.v2Pending["original"].releaseConn != current {
					t.Fatal("wrong release recipient")
				}
				dup, _ := s.v2.Submit(context.Background(), original)
				if !dup.OwnershipReleased || dup.Outcome != executionv2.RetiredUnresolved || nativeWrites.Load() != 1 {
					t.Fatal(dup)
				}
			}
			if mode == "mutation" {
				var b bytes.Buffer
				_, _ = b.ReadFrom(res.Body)
				if !strings.Contains(b.String(), "READ_ONLY") {
					t.Fatal(b.String())
				}
			}
		})
	}
}

func TestRecoveryReleaseUsesReconnectedTransport(t *testing.T) {
	s := New(Options{})
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	connected := make(chan *conn, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ws, err := websocket.Accept(w, r, nil)
		if err != nil {
			return
		}
		defer ws.CloseNow()
		c := newConn(ws, time.Now())
		c.activationID = "same-activation"
		connected <- c
		<-ctx.Done()
	}))
	defer server.Close()
	ws, _, err := websocket.Dial(ctx, "ws"+strings.TrimPrefix(server.URL, "http"), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer ws.CloseNow()
	current := <-connected
	request := executionv2.Request{OperationID: "original", Target: executionv2.Target{Activation: "same-activation"}}
	s.v2Pending["original"] = v2Pending{request: request, conn: newConn(nil, time.Now()), releaseConn: current}
	// The disconnected original transport cannot be used. Both sends must be
	// release-only authorization to the surviving activation's new transport.
	for i := 0; i < 2; i++ {
		s.releaseV2(request, "original-digest")
		var frame map[string]any
		if err := wsjson.Read(ctx, ws, &frame); err != nil {
			t.Fatal(err)
		}
		if frame["type"] != "v2_release" || frame["operation_id"] != "original" || frame["digest"] != "original-digest" {
			t.Fatal(frame)
		}
	}
	cancel()
}

func TestProjectRecoveryHTTPFreshPCBInventory(t *testing.T) {
	for _, mode := range []string{"release", "pending", "wrong-project", "wrong-pcb", "replay-id"} {
		t.Run(mode, func(t *testing.T) {
			s := New(Options{V2HostStartupConfirmed: true})
			server := httptest.NewServer(s.routes(0))
			defer server.Close()
			old := executionv2.Target{Scope: "PROJECT", Session: "lost", Activation: "old", ProjectUUID: "p"}
			now := old
			now.Session = "current"
			now.Activation = "new"

			current := newConn(nil, time.Now())
			current.windowID = now.Session
			current.activationID = now.Activation
			current.caps = []string{"execution.v2"}
			current.ctx = protocol.Context{ProjectUUID: "p", DocumentUUID: "d", DocumentType: "pcb", TabID: "new-tab"}
			s.hub.add(current)
			original := executionv2.Request{Protocol: executionv2.Version, Action: "board.new_pcb", ActionRevision: "1", Schema: "s", RequestID: "old", OperationID: "original", Target: old, Input: map[string]any{"schematicUuid": "sch"}, BudgetMS: 1000}
			var nativeWrites, readCalls, releases atomic.Int32
			s.v2 = executionv2.New(30, func(r executionv2.Request) (executionv2.Admission, error) {
				if r.Action == "board.new_pcb" {
					return executionv2.Admission{EffectScope: "PROJECT_TOPOLOGY"}, nil
				}
				return s.validateV2(r)
			}, func(r executionv2.Request, d string) <-chan executionv2.HandlerResult {
				ch := make(chan executionv2.HandlerResult, 1)
				h := executionv2.HandlerResult{Protocol: executionv2.Version, OperationID: r.OperationID, Digest: d, Target: r.Target, Effects: executionv2.Effects{Started: executionv2.Bool(true), Settled: mode != "pending", Scope: "PROJECT_TOPOLOGY"}, Verification: executionv2.Verification{Verdict: "unavailable"}}
				if r.Action == "board.new_pcb" {
					nativeWrites.Add(1)
				} else {
					readCalls.Add(1)
					h.Value = json.RawMessage(`{"boards":[{"parentProjectUuid":"p","schematicUuid":"sch","pcbUuid":"new-pcb"}]}`)
					h.Effects = executionv2.Effects{Started: executionv2.Bool(false), Changed: executionv2.Bool(false), Settled: true, Scope: "NONE"}
					h.Verification = executionv2.Verification{Verdict: "satisfied", Complete: true, Required: 1, Satisfied: 1, Checked: []string{"fresh_uuid"}}
				}
				ch <- h
				return ch
			})
			s.v2.OnResolved(func(r executionv2.Request, d string) {
				if r.OperationID == "original" {
					releases.Add(1)
				}
			})
			_, _ = s.v2.Submit(context.Background(), original)
			s.v2Pending["original"] = v2Pending{request: original, conn: newConn(nil, time.Now())}
			action := "board.list"
			if mode == "read" {
				action = "board.snapshot_compact"
			}
			if mode == "mutation" {
				action = "pcb.save"
			}
			var spec *protocol.V2Action
			for _, a := range protocol.AllActions() {
				if a.Name == action {
					spec = a.V2
				}
			}
			read := executionv2.Request{Protocol: executionv2.Version, Action: action, ActionRevision: spec.Revision, Schema: spec.SchemaID(), RequestID: "new-read", OperationID: "readback", Target: now, Input: map[string]any{}, BudgetMS: 1000}
			switch mode {
			case "wrong-document":
				read.Target.DocumentUUID = "wrong"
			case "wrong-project":
				read.Target.ProjectUUID = "wrong"
			case "wrong-type":
				read.Target.DocumentType = "schematic"
			case "replay-id":
				read.OperationID = "original"
			}
			view := "release"
			if mode == "read" {
				view = "recover"
			}
			pcb := "new-pcb"
			if mode == "wrong-pcb" {
				pcb = "wrong"
			}
			body, _ := json.Marshal(read)
			res, err := http.Post(server.URL+"/v2/operation?id=original&view="+view+"&pcb_uuid="+pcb, "application/json", bytes.NewReader(body))
			if err != nil {
				t.Fatal(err)
			}
			defer res.Body.Close()
			success := mode == "release" || mode == "read"
			if (res.StatusCode == 200) != success {
				t.Fatal(mode, res.StatusCode)
			}
			got, _ := s.v2.Status("original")
			wantOutcome := executionv2.Unknown
			if mode == "release" {
				wantOutcome = executionv2.RetiredUnresolved
			}
			if got.Outcome != wantOutcome || got.OwnershipReleased != (mode == "release") {
				t.Fatal(got)
			}
			if nativeWrites.Load() != 1 {
				t.Fatal("replayed effect")
			}
			if mode == "release" || mode == "read" || mode == "pending" || mode == "wrong-pcb" {
				if readCalls.Load() != 1 {
					t.Fatal("missing read")
				}
			} else if readCalls.Load() != 0 {
				t.Fatal("invalid recovery dispatched")
			}
			if mode == "release" {
				if releases.Load() != 1 || s.v2Pending["original"].releaseConn != current {
					t.Fatal("wrong release recipient")
				}
				dup, _ := s.v2.Submit(context.Background(), original)
				if !dup.OwnershipReleased || dup.Outcome != executionv2.RetiredUnresolved || nativeWrites.Load() != 1 {
					t.Fatal(dup)
				}
			}
			if mode == "mutation" {
				var b bytes.Buffer
				_, _ = b.ReadFrom(res.Body)
				if !strings.Contains(b.String(), "READ_ONLY") {
					t.Fatal(b.String())
				}
			}
		})
	}
}
