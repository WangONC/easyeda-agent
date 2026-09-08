package daemon

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/zhoushoujianwork/easyeda-agent/internal/fastpath"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
	"github.com/zhoushoujianwork/easyeda-agent/internal/workflow"
	"testing"
	"time"
)

func fastFixture(nets, segments int) (fastpath.Snapshot, fastpath.Plan) {
	s := fastpath.Snapshot{Revision: "fixture:1", Layers: []int{1, 2}, Components: []fastpath.Primitive{}, Pads: []fastpath.Primitive{}, Traces: []fastpath.Primitive{}, Vias: []fastpath.Primitive{}, Fills: []fastpath.Primitive{}}
	p := fastpath.Plan{Base: s.Revision, Profile: &fastpath.Rules{Clearance: 6, MinWidth: 5, MinHole: 12, MinDiameter: 24, MinAnnulus: 6}}
	for i := 0; i < nets; i++ {
		net := fmt.Sprintf("N%d", i)
		y := float64(i * 100)
		pts := []fastpath.Point{}
		for j := 0; j <= segments; j++ {
			pts = append(pts, fastpath.Point{float64(j * 100), y})
		}
		p.Routes = append(p.Routes, fastpath.Route{Net: net, Layer: 1, Width: 6, Points: pts})
		p.Vias = append(p.Vias, fastpath.Via{Net: net, X: float64(segments * 100), Y: y, Hole: 12, Diameter: 24, From: 1, To: 2})
	}
	return s, p
}
func TestFastPathFixture(t *testing.T) {
	for _, nets := range []int{8, 16} {
		for _, segments := range []int{2, 12} {
			t.Run(fmt.Sprintf("nets_%d_segments_%d", nets, segments), func(t *testing.T) {
				t.Setenv(workflow.EnvDir, t.TempDir())
				s := New(Options{})
				board, plan := fastFixture(nets, segments)
				ws := 0
				forward := func(ctx context.Context, r protocol.Request) (*protocol.Response, error) {
					ws++
					res := map[string]any{}
					if r.Action == "board.snapshot_compact" {
						_ = fastpath.Decode(board, &res)
						res["native_api_call_count"] = 14
					}
					if r.Action == "route.apply_batch" {
						if r.Payload["expires_at_ms"] == nil {
							t.Fatal("missing queue expiry")
						}
						var ops []fastpath.Operation
						_ = fastpath.Decode(r.Payload["operations"], &ops)
						ids := []string{}
						for i, o := range ops {
							p := fastpath.OperationPrimitive(o)
							p.ID = fmt.Sprint(i)
							ids = append(ids, p.ID)
							if p.Kind == "via" {
								board.Vias = append(board.Vias, p)
							} else {
								board.Traces = append(board.Traces, p)
							}
						}
						board.Revision = "fixture:2"
						res = map[string]any{"status": "complete", "created_ids": ids, "deleted_ids": []string{}, "readback_verified": true, "revision_before": "fixture:1", "revision_after": board.Revision, "native_api_call_count": 3*len(ops) + 28}
					}
					return &protocol.Response{OK: true, Result: res}, nil
				}
				call := func(action string, payload any) *protocol.Response {
					r := protocol.Request{Envelope: protocol.Envelope{ID: fmt.Sprint(ws), WindowID: "fixture"}, Action: action, Payload: map[string]any{}}
					_ = fastpath.Decode(payload, &r.Payload)
					r.Payload["document_uuid"] = "pcb"
					r.Payload["project_uuid"] = "project"
					resp, e := s.forwardFast(context.Background(), r, forward, []string{fastpath.Capability})
					if e != nil || !resp.OK {
						t.Fatalf("%+v %v", resp, e)
					}
					t.Logf("operation=%s telemetry=%v", action, resp.Result["telemetry"])
					if resp.Result["telemetry"] == nil {
						t.Fatal("missing telemetry")
					}
					return resp
				}
				call("board.snapshot_compact", map[string]any{})
				checked := call("route.preflight", plan)
				if checked.Result["ok"] != true {
					t.Fatal(checked)
				}
				local, _ := fastpath.Preflight(board, plan)
				applied := call("route.apply_batch", map[string]any{"base_revision": plan.Base, "plan_hash": checked.Result["plan_hash"], "client_transaction_id": "fixture", "operations": local.Operations})
				verification := call("board.snapshot_compact", map[string]any{"include": map[string]bool{"traces": true, "vias": true}})
				if ws != 4 {
					t.Fatalf("WS calls %d", ws)
				}
				if len(board.Traces) != nets*segments || len(board.Vias) != nets {
					t.Fatal("geometry lost")
				}
				raw, _ := json.Marshal(verification.Result)
				t.Logf("nets=%d segments=%d primitives=%d Agent/MCP_round_trips=4 WS_round_trips=%d manual_JS=0 check_Python=0 compact_bytes=%d telemetry=%v", nets, segments, len(local.Operations), ws, len(raw), applied.Result["telemetry"])
			})
		}
	}
}
func TestFastContractRefusals(t *testing.T) {
	s := New(Options{})
	calls := 0
	forward := func(context.Context, protocol.Request) (*protocol.Response, error) {
		calls++
		return nil, fmt.Errorf("timeout")
	}
	r := protocol.Request{Action: "route.apply_batch", Payload: map[string]any{"document_uuid": "pcb", "project_uuid": "p"}}
	resp, _ := s.forwardFast(context.Background(), r, forward, nil)
	if resp.Error.Code != "CONNECTOR_UPGRADE_REQUIRED" || calls != 0 {
		t.Fatal(resp, calls)
	}
	r.Payload["operations"] = []fastpath.Operation{{Type: "add_trace", Net: "N", Layer: 1, Width: 6, Points: []fastpath.Point{{0, 0}, {100, 0}}}}
	resp, _ = s.forwardFast(context.Background(), r, forward, []string{fastpath.Capability})
	if resp.Error.Code != "PREFLIGHT_REQUIRED" || calls != 0 {
		t.Fatal(resp, calls)
	}
	r.Payload["dryRun"] = true
	resp, _ = s.forwardFast(context.Background(), r, forward, []string{fastpath.Capability})
	if resp.Error.Code != "INVALID_DRY_RUN" || calls != 0 {
		t.Fatal(resp, calls)
	}
	delete(r.Payload, "dryRun")
	r.Action = "board.snapshot_compact"
	resp, _ = s.forwardFast(context.Background(), r, forward, []string{fastpath.Capability})
	if resp.OK || resp.Result["telemetry"] == nil {
		t.Fatal(resp)
	}
}
func TestFastGatesAndTelemetry(t *testing.T) {
	if gateForAction["route.apply_batch"] != protocol.GateRouting || !knownActions["route.preflight"] {
		t.Fatal("catalog not integrated")
	}
	g := newStaleGuard()
	g.observe(&protocol.Request{Envelope: protocol.Envelope{WindowID: "w"}, Action: "route.apply_batch"}, &protocol.Response{OK: true})
	for _, a := range []string{"board.snapshot_compact", "route.preflight"} {
		r := &protocol.Request{Envelope: protocol.Envelope{WindowID: "w"}, Action: a}
		if g.blockedBy(r) != "" {
			t.Fatal("fast geometry read blocked")
		}
		resp := &protocol.Response{OK: true}
		g.observe(r, resp)
		if resp.StaleRisk == "" {
			t.Fatal("stale warning lost")
		}
	}
	if g.blockedBy(&protocol.Request{Envelope: protocol.Envelope{WindowID: "w"}, Action: "pcb.drc.check"}) == "" {
		t.Fatal("native DRC stale gate bypassed")
	}
	r := &protocol.Request{Action: "route.preflight"}
	resp := errorResponse("1", "STAGE_BLOCKED", "test", "")
	_ = fromResponse(time.Now(), r, &resp)
}
func BenchmarkFastPathPreflight(b *testing.B) {
	s, p := fastFixture(16, 12)
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		r, e := fastpath.Preflight(s, p)
		if e != nil || !r.OK {
			b.Fatal(e, r)
		}
	}
}
func TestFastQueueRefusalVersusAbandon(t *testing.T) {
	for _, code := range []string{"QUEUE_OVERFLOW", "ACTION_ABANDONED", "TRANSACTION_ID_REUSED"} {
		t.Run(code, func(t *testing.T) {
			s := New(Options{})
			ops := []fastpath.Operation{{Type: "add_trace", Net: "N", Layer: 1, Width: 6, Points: []fastpath.Point{{0, 0}, {100, 0}}}}
			s.fastPlans.receipts = map[string]fastReceipt{"h": {Base: "r", Document: "d", Project: "p", OperationsHash: fastpath.Hash(ops)}}
			r := protocol.Request{Action: "route.apply_batch", Payload: map[string]any{"document_uuid": "d", "project_uuid": "p", "base_revision": "r", "plan_hash": "h", "client_transaction_id": "t", "operations": ops}}
			resp, e := s.forwardFast(context.Background(), r, func(context.Context, protocol.Request) (*protocol.Response, error) {
				v := errorResponse("1", code, code, "")
				return &v, nil
			}, []string{fastpath.Capability})
			if e != nil || resp.OK || resp.Error.Code != code {
				t.Fatal(resp, e)
			}
			if code == "ACTION_ABANDONED" {
				if resp.Result["status"] != "uncertain" {
					t.Fatal(resp)
				}
			} else {
				if resp.Result["mutation_started"] != false || resp.Result["status"] != "partial" {
					t.Fatal(resp)
				}
			}
		})
	}
}
