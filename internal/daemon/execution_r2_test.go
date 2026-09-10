package daemon

import (
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
	"github.com/zhoushoujianwork/easyeda-agent/internal/workflow"
	"testing"
)

func TestR2RecomputePossibleEffectIsNotRequestSatisfaction(t *testing.T) {
	t.Setenv(workflow.EnvDir, t.TempDir())
	for _, status := range []string{"partial", "uncertain", "failed"} {
		for _, ok := range []bool{true, false} {
			t.Run(status+map[bool]string{true: "_ok", false: "_error"}[ok], func(t *testing.T) {
				s := New(Options{})
				project := t.Name()
				st, _ := workflow.Load(project)
				st.Confirm(workflow.StagePostRouteChecked, "old", "")
				if err := workflow.Save(st); err != nil {
					t.Fatal(err)
				}
				req := &protocol.Request{Action: "pcb.pour.rebuild", Project: project, Envelope: protocol.Envelope{WindowID: "w"}}
				resp := &protocol.Response{OK: ok, Result: map[string]any{"status": status}}
				resp.Execution = protocol.Interpret(req, resp, false)
				if resp.Execution.RequestSatisfied || resp.Execution.MutationOutcome != "" {
					t.Fatalf("request and content outcome: %+v", resp.Execution)
				}
				if !protocol.PossibleMutation(req, resp) {
					t.Fatal("lost recompute side effect")
				}
				s.maybeInvalidateStage(req, resp)
				got, _ := workflow.Load(project)
				if got.Has(workflow.StagePostRouteChecked) {
					t.Fatal("old stage survived possible recompute")
				}
				g := newStaleGuard()
				g.last["w"] = "pcb.line.create"
				g.observe(req, resp)
				if g.last["w"] == "" {
					t.Fatal("unsatisfied recompute cleared stale state")
				}
				if shouldAutosave(req, resp) {
					t.Fatal("unsatisfied recompute scheduled autosave")
				}
			})
		}
	}
	for _, preview := range []bool{false, true} {
		req := &protocol.Request{Action: "pcb.pour.rebuild"}
		resp := &protocol.Response{OK: true}
		if preview {
			req.Action = "pcb.page.clear"
			req.Payload = map[string]any{"dryRun": true}
			resp.Execution = protocol.Interpret(req, resp, false)
		} else {
			resp.Execution = protocol.Interpret(req, resp, true)
		}
		if protocol.PossibleMutation(req, resp) {
			t.Fatal("preview/pre-dispatch refusal has effects")
		}
	}
	req := &protocol.Request{Action: "pcb.pour.rebuild"}
	resp := &protocol.Response{OK: true, Execution: &protocol.Execution{MutationOutcome: protocol.NoWrite}}
	if protocol.PossibleMutation(req, resp) {
		t.Fatal("NO_WRITE has effects")
	}
}
