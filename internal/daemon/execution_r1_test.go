package daemon

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"github.com/zhoushoujianwork/easyeda-agent/internal/fastpath"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
	"github.com/zhoushoujianwork/easyeda-agent/internal/workflow"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"testing"
	"time"
)

func TestR1FastCompositeChildExecution(t *testing.T) {
	t.Setenv(workflow.EnvDir, t.TempDir())
	board, plan := fastFixture(1, 2)
	plan.Routes[0].Net = "N"
	plan.Vias[0].Net = "N"
	board.Traces = []fastpath.Primitive{{ID: "span", Kind: "trace", Net: "N", Layer: 1, Width: 6, Points: []fastpath.Point{{0, 0}, {400, 0}}}}
	cases := []struct {
		action  string
		payload any
	}{
		{"route.preflight", plan},
		{"route.tuning_plan", fastpath.TuningRequest{Base: board.Revision, Net: "N", SpanID: "span", Corridor: fastpath.Box{-10, -10, 410, 110}, AddedLength: 200, Pitch: 25, MinSpacing: 6, MaxAmplitude: 50, Side: 1}},
		{"route.pair_plan", fastpath.PairRequest{Base: board.Revision, Positive: "P", Negative: "M", Layer: 1, Width: 6, Gap: 8, Centerline: []fastpath.Point{{0, 100}, {200, 100}, {200, 300}}}},
		{"pcb.routing_profile", map[string]any{"operation": "context"}},
	}
	for _, tc := range cases {
		t.Run(tc.action, func(t *testing.T) {
			s := New(Options{})
			req := protocol.Request{Envelope: protocol.Envelope{ID: "parent", WindowID: "w"}, Action: tc.action, OperationID: "operation", Payload: map[string]any{}}
			_ = fastpath.Decode(tc.payload, &req.Payload)
			req.Payload["document_uuid"] = "d"
			req.Payload["project_uuid"] = "p"
			c, _ := protocol.ContractFor(req.Action)
			req.ContractHash = c.Hash
			req.ContractVersion = c.Version
			var child protocol.Response
			forward := func(_ context.Context, r protocol.Request) (*protocol.Response, error) {
				if r.Action != "board.snapshot_compact" || r.ID == req.ID || r.ParentOperationID != req.OperationID {
					t.Fatalf("child ownership: %+v", r)
				}
				value := map[string]any{}
				_ = fastpath.Decode(board, &value)
				child = protocol.Response{Envelope: protocol.Envelope{ID: r.ID}, OK: true, Result: value}
				// Same boundary as Connector transport, before the daemon creates parent result.
				child.Execution = connectorExecution(t, r, child)
				return &child, nil
			}
			resp, err := s.forwardFast(context.Background(), req, forward, []string{fastpath.Capability})
			if err != nil {
				t.Fatal(err)
			}
			resp.Execution = protocol.Interpret(&req, resp, false)
			if !resp.Execution.RequestSatisfied || resp.Execution.ContractHash != c.Hash || resp.Execution.OperationID != req.OperationID {
				t.Fatalf("parent: %+v result=%v error=%+v", resp.Execution, resp.Result, resp.Error)
			}
			if len(resp.Execution.ChildResponses) != 1 {
				t.Fatal("missing child")
			}
			preserved := resp.Execution.ChildResponses[0]
			snapshotC, _ := protocol.ContractFor("board.snapshot_compact")
			if preserved.Execution.ContractHash != snapshotC.Hash || preserved.Execution.ParentOperationID != req.OperationID || preserved.ID == resp.ID || preserved.Result["board_revision"] != board.Revision {
				t.Fatalf("child: %+v", preserved)
			}
			if reflect.DeepEqual(resp.Result, preserved.Result) {
				t.Fatal("parent result was not derived")
			}
		})
	}
}

func TestR1ArtifactConnectorDaemonDelivery(t *testing.T) {
	for _, failure := range []bool{false, true} {
		t.Run(map[bool]string{false: "delivered", true: "write_failed"}[failure], func(t *testing.T) {
			req := protocol.Request{Envelope: protocol.Envelope{ID: "artifact"}, Action: "schematic.export_bom"}
			// Use the canonical action name from the catalog.
			req.Action = "schematic.export.bom"
			if _, ok := protocol.ContractFor(req.Action); !ok {
				t.Fatal("fixture action not in catalog")
			}
			resp := &protocol.Response{Envelope: protocol.Envelope{ID: req.ID}, OK: true, Result: map[string]any{}, Artifacts: []protocol.Artifact{{ID: "bom", InlineBase64: base64.StdEncoding.EncodeToString([]byte("a,b\n1,2\n"))}}}
			resp.Execution = connectorExecution(t, req, *resp)
			if resp.Execution.RequestSatisfied || resp.Execution.Persistence["state"] != "PENDING_DELIVERY" {
				t.Fatalf("connector: %+v", resp.Execution)
			}
			dir := t.TempDir()
			if failure {
				dir = filepath.Join(dir, "file")
				if err := os.WriteFile(dir, []byte("block"), 0600); err != nil {
					t.Fatal(err)
				}
			}
			s := New(Options{})
			s.persistArtifacts(resp, dir)
			resp.Execution = protocol.Interpret(&req, resp, false)
			if resp.Execution.RequestSatisfied == failure {
				t.Fatalf("daemon: %+v", resp.Execution)
			}
			// CLI/MCP will interpret the serialized daemon response once more.
			b, _ := json.Marshal(resp)
			var wire protocol.Response
			_ = json.Unmarshal(b, &wire)
			if protocol.Interpret(&req, &wire, false).RequestSatisfied == failure || connectorExecution(t, req, wire).RequestSatisfied == failure {
				t.Fatal("delivery changed at next entry point")
			}
			if !failure {
				if _, err := os.ReadFile(resp.Artifacts[0].Path); err != nil {
					t.Fatal(err)
				}
			} else if len(resp.Warnings) == 0 {
				t.Fatal("lost persistence error")
			}
		})
	}
}

func TestR1ConsumersContractAndExecution(t *testing.T) {
	t.Setenv(workflow.EnvDir, t.TempDir())
	s := New(Options{})
	for _, action := range []string{"pcb.pour.rebuild", "pcb.components.move"} {
		st, _ := workflow.Load(action)
		st.Confirm(workflow.StagePostRouteChecked, "test", "")
		st.Confirm(workflow.StagePlacementConfirmed, "test", "")
		_ = workflow.Save(st)
		req := &protocol.Request{Action: action, Project: action}
		resp := &protocol.Response{OK: true}
		resp.Execution = protocol.Interpret(req, resp, false)
		s.maybeInvalidateStage(req, resp)
		got, _ := workflow.Load(action)
		if action == "pcb.pour.rebuild" && got.Has(workflow.StagePostRouteChecked) {
			t.Fatal("recompute did not invalidate")
		}
		if action == "pcb.components.move" && got.Has(workflow.StagePlacementConfirmed) {
			t.Fatal("possible content write did not invalidate")
		}
	}
	req := &protocol.Request{Action: "route.apply_batch", Envelope: protocol.Envelope{WindowID: "w"}}
	s.autosave = newAutosaver(time.Hour, func(string, string) { t.Error("unexpected save") })
	defer s.autosave.stop()
	for _, state := range []protocol.MutationOutcome{protocol.Uncertain, protocol.NoWrite} {
		settled := false
		resp := &protocol.Response{OK: true, Result: map[string]any{"status": "uncertain"}, Execution: &protocol.Execution{MutationOutcome: state, NativeSettled: &settled}}
		if shouldAutosave(req, resp) {
			s.maybeAutosave(req)
		}
		if len(s.autosave.timers) != 0 {
			t.Fatal("uncertain/no-write armed autosave")
		}
		if state == protocol.NoWrite && protocol.PossibleMutation(req, resp) {
			t.Fatal("NO_WRITE invalidates")
		}
	}
}

func connectorExecution(t *testing.T, req protocol.Request, resp protocol.Response) *protocol.Execution {
	t.Helper()
	data, _ := json.Marshal([]any{map[string]any{"request": req, "response": resp}})
	cmd := exec.Command("node", "../../scripts/test-execution-parity.mjs")
	cmd.Stdin = bytes.NewReader(data)
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("Connector reducer: %v %s", err, output)
	}
	var parsed []struct{ First *protocol.Execution }
	if err = json.Unmarshal(output, &parsed); err != nil {
		t.Fatal(err)
	}
	return parsed[0].First
}

func TestR1FailedChildCannotBecomeParentSuccess(t *testing.T) {
	t.Setenv(workflow.EnvDir, t.TempDir())
	s := New(Options{})
	req := protocol.Request{Envelope: protocol.Envelope{ID: "p"}, Action: "route.preflight", Payload: map[string]any{"document_uuid": "d", "project_uuid": "p"}}
	resp, err := s.forwardFast(context.Background(), req, func(_ context.Context, r protocol.Request) (*protocol.Response, error) {
		child := &protocol.Response{Envelope: protocol.Envelope{ID: r.ID}, OK: true, Result: map[string]any{"board_revision": "r"}}
		child.Execution = protocol.Interpret(&r, child, false)
		child.Execution.Verification.State = "INVALID"
		child.Execution.RequestSatisfied = false
		return child, nil
	}, []string{fastpath.Capability})
	if err != nil || resp.Execution == nil || resp.Execution.RequestSatisfied || len(resp.Execution.ChildResponses) != 1 {
		t.Fatalf("%+v %v", resp, err)
	}
	if resp.Execution.ChildResponses[0].Execution.Verification.State != "INVALID" {
		t.Fatal("lost failed dependency evidence")
	}
}
