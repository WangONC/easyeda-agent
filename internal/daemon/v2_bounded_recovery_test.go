package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
)

func TestPublicMutationBoundedRecoveryReturnsTerminalWithoutReplay(t *testing.T) {
	for _, fixture := range []struct {
		name, action, verdict, recovery string
		changed                         bool
		satisfied, residual             int
		want                            executionv2.Outcome
	}{
		{name: "wire-delayed-visibility", action: "schematic.wire.create", verdict: "satisfied", recovery: "PROVEN_SUCCESS", changed: true, satisfied: 1, want: executionv2.Succeeded},
		{name: "rename-host-no-op", action: "schematic.rename", verdict: "unchanged", recovery: "PROVEN_NO_EFFECT", changed: false, residual: 1, want: executionv2.NotApplied},
		{name: "known-partial-batch", action: "route.apply_batch", verdict: "partial", recovery: "KNOWN_PARTIAL", changed: true, satisfied: 6, residual: 4, want: executionv2.Partial},
	} {
		t.Run(fixture.name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			s := New(Options{V2RecoveryBudget: 500 * time.Millisecond, V2RecoveryAttempts: 2})
			connected := make(chan *conn, 1)
			connectorServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				ws, err := websocket.Accept(w, r, nil)
				if err != nil {
					return
				}
				defer ws.CloseNow()
				c := newConn(ws, time.Now())
				c.windowID, c.activationID, c.transportID = "window", "activation", "transport"
				connected <- c
				for {
					_, data, err := ws.Read(ctx)
					if err != nil {
						return
					}
					s.handleFrame(ctx, c, data)
				}
			}))
			defer connectorServer.Close()
			connector, _, err := websocket.Dial(ctx, "ws"+strings.TrimPrefix(connectorServer.URL, "http"), nil)
			if err != nil {
				t.Fatal(err)
			}
			defer connector.CloseNow()
			current := <-connected

			var writes, reconciles atomic.Int32
			s.v2 = executionv2.New(20, func(executionv2.Request) (executionv2.Admission, error) {
				return executionv2.Admission{EffectScope: "DESIGN_CONTENT"}, nil
			}, func(r executionv2.Request, digest string) <-chan executionv2.HandlerResult {
				writes.Add(1)
				ch := make(chan executionv2.HandlerResult, 1)
				s.v2Mu.Lock()
				s.v2Pending[r.OperationID] = v2Pending{request: r, conn: current, results: ch, started: time.Now(), windowID: "window"}
				s.v2Mu.Unlock()
				ch <- executionv2.HandlerResult{Protocol: executionv2.Version, OperationID: r.OperationID, Digest: digest, Target: r.Target, Effects: executionv2.Effects{Started: executionv2.Bool(true), Changed: nil, Settled: true, Scope: "DESIGN_CONTENT"}, Verification: executionv2.Verification{Verdict: "unavailable"}}
				return ch
			})
			s.v2.OnResolved(s.resolveV2)
			s.v2.OnPersist(s.persistV2Snapshot)

			request := executionv2.Request{Protocol: executionv2.Version, Action: fixture.action, ActionRevision: "1", Schema: "test", RequestID: "request", OperationID: "operation", Target: executionv2.Target{Scope: "DOCUMENT", Session: "transport", Activation: "activation", ProjectUUID: "project", DocumentUUID: "document", DocumentType: "pcb", TabID: "tab"}, Input: map[string]any{}, BudgetMS: 100}
			digest, _ := request.Digest()
			connectorDone := make(chan struct{})
			go func() {
				defer close(connectorDone)
				for {
					var frame map[string]any
					if err := wsjson.Read(ctx, connector, &frame); err != nil {
						return
					}
					if frame["type"] == "v2_reconcile" {
						reconciles.Add(1)
						result := executionv2.HandlerResult{Protocol: executionv2.Version, OperationID: request.OperationID, Digest: digest, Target: request.Target, Effects: executionv2.Effects{Started: executionv2.Bool(true), Changed: executionv2.Bool(fixture.changed), Settled: true, Scope: "DESIGN_CONTENT", Reconciled: true}, Verification: executionv2.Verification{Verdict: fixture.verdict, Checked: []string{"authoritative_fresh_state"}, Complete: true, Required: fixture.satisfied + fixture.residual, Satisfied: fixture.satisfied, Residual: fixture.residual}}
						_ = wsjson.Write(ctx, connector, map[string]any{"type": "v2_result", "result": result})
					}
					if frame["type"] == "v2_release" {
						return
					}
				}
			}()

			public := httptest.NewServer(s.routes(0))
			defer public.Close()
			body, _ := json.Marshal(request)
			response, err := http.Post(public.URL+"/v2/operations", "application/json", bytes.NewReader(body))
			if err != nil {
				t.Fatal(err)
			}
			defer response.Body.Close()
			var result executionv2.Result
			if response.StatusCode != http.StatusOK || json.NewDecoder(response.Body).Decode(&result) != nil {
				t.Fatalf("response=%d", response.StatusCode)
			}
			if result.Outcome != fixture.want || !result.RecoveryAttempted || result.RecoveryResult != fixture.recovery || !result.Effects.Reconciled || result.BarrierMode != executionv2.BarrierNone || result.NativeReplayed {
				t.Fatal(result)
			}
			if writes.Load() != 1 || reconciles.Load() < 1 {
				t.Fatalf("writes=%d reconciles=%d", writes.Load(), reconciles.Load())
			}
			if s.v2.EffectOwner() != "" {
				t.Fatal("terminal recovery retained global owner")
			}
			if fixture.want == executionv2.NotApplied {
				next := request
				next.OperationID, next.RequestID = "new-operation", "new-request"
				if _, err := s.v2.Submit(context.Background(), next); err != nil || writes.Load() != 2 {
					t.Fatal("new operation after proven no-effect was blocked or replayed", err, writes.Load())
				}
			}
			cancel()
			<-connectorDone
		})
	}
}

func TestBoundedRecoveryRetiresOnlySettledEvidence(t *testing.T) {
	for _, settled := range []bool{true, false} {
		t.Run(map[bool]string{true: "settled", false: "pending"}[settled], func(t *testing.T) {
			s := New(Options{V2RecoveryBudget: 25 * time.Millisecond, V2RecoveryAttempts: 1})
			s.v2 = executionv2.New(10, func(executionv2.Request) (executionv2.Admission, error) {
				return executionv2.Admission{EffectScope: "DESIGN_CONTENT"}, nil
			}, func(r executionv2.Request, digest string) <-chan executionv2.HandlerResult {
				ch := make(chan executionv2.HandlerResult, 1)
				s.v2Mu.Lock()
				s.v2Pending[r.OperationID] = v2Pending{request: r, started: time.Now()}
				s.v2Mu.Unlock()
				ch <- executionv2.HandlerResult{Protocol: executionv2.Version, OperationID: r.OperationID, Digest: digest, Target: r.Target, Effects: executionv2.Effects{Started: executionv2.Bool(true), Settled: settled, Scope: "DESIGN_CONTENT"}, Verification: executionv2.Verification{Verdict: "unavailable"}}
				return ch
			})
			s.v2.OnResolved(s.resolveV2)
			request := executionv2.Request{Protocol: executionv2.Version, Action: "test", ActionRevision: "1", Schema: "test", RequestID: "request", OperationID: "operation", Target: executionv2.Target{Scope: "DOCUMENT", Session: "session", Activation: "activation", ProjectUUID: "project", DocumentUUID: "document", DocumentType: "pcb", TabID: "tab"}, Input: map[string]any{}, BudgetMS: 100}
			initial, err := s.v2.Submit(context.Background(), request)
			if err != nil {
				t.Fatal(err)
			}
			result := s.autoRecoverV2(context.Background(), request, initial)
			if settled {
				if result.Outcome != executionv2.RetiredUnresolved || !result.RecoveryAttempted || result.RecoveryResult != "RETIRED_UNRESOLVED" || result.RecoveryDurationMS < 20 || result.BarrierMode != executionv2.BarrierScoped || s.v2.EffectOwner() != "" || len(s.v2.Quarantines()) != 1 {
					t.Fatal(result, s.v2.Quarantines())
				}
			} else {
				if result.Outcome != executionv2.Unknown || !result.RecoveryAttempted || result.RecoveryResult != "NATIVE_PENDING" || result.RecoveryDurationMS < 20 || result.Effects.Settled || result.BarrierMode != executionv2.BarrierGlobal || s.v2.EffectOwner() != request.OperationID || len(s.v2.Quarantines()) != 0 {
					t.Fatal(result, s.v2.Quarantines())
				}
			}
		})
	}
}
