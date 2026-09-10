package daemon

import (
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
	"github.com/zhoushoujianwork/easyeda-agent/internal/workflow"
	"strings"
	"testing"
)

func TestV2ConsumersUseEffectFacts(t *testing.T) {
	for _, outcome := range []executionv2.Outcome{executionv2.Succeeded, executionv2.NotApplied, executionv2.Partial, executionv2.Unknown} {
		result := executionv2.Result{Outcome: outcome, Effects: executionv2.Effects{Scope: "DESIGN_CONTENT", Changed: executionv2.Bool(false)}}
		if v2MayChangeDesign(result.Effects) {
			t.Fatal("outcome treated as a write", outcome)
		}
		result.Effects.Changed = nil
		if !v2MayChangeDesign(result.Effects) {
			t.Fatal("possible effect missed", outcome)
		}
	}
}

func TestV2AdmissionPreservesStageGate(t *testing.T) {
	t.Setenv(workflow.EnvDir, t.TempDir())
	s := New(Options{})
	s.hub.add(&conn{windowID: "s", activationID: "a", caps: []string{"execution.v2"}, ctx: protocol.Context{ProjectUUID: "p", DocumentUUID: "d", DocumentType: "pcb", TabID: "t"}})
	var spec *protocol.V2Action
	for _, a := range protocol.AllActions() {
		if a.Name == "pcb.line.create" {
			spec = a.V2
		}
	}
	req := executionv2.Request{Action: "pcb.line.create", ActionRevision: spec.Revision, Schema: spec.SchemaID(), Target: executionv2.Target{Scope: "DOCUMENT", Session: "s", Activation: "a", ProjectUUID: "p", DocumentUUID: "d", DocumentType: "pcb", TabID: "t"}, Input: map[string]any{"startX": float64(0), "startY": float64(0), "endX": float64(10), "endY": float64(0)}}
	if _, err := s.validateV2(req); err == nil || !strings.Contains(err.Error(), "STAGE_BLOCKED") {
		t.Fatalf("fresh project was not gated: %v", err)
	}
	state, _ := workflow.Load("p")
	state.Confirm(workflow.StageOutlineConfirmed, "confirm", "test")
	state.Confirm(workflow.StagePreRoutePassed, "gate-pass", "test")
	if err := workflow.Save(state); err != nil {
		t.Fatal(err)
	}
	if _, err := s.validateV2(req); err != nil {
		t.Fatal(err)
	}
}
