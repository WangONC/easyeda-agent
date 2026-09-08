package app

import (
	"bytes"
	"encoding/json"
	"io"
	"testing"
)

func TestMCPParityAssemblyStatus(t *testing.T) {
	t.Setenv("EASYEDA_WORKFLOW_DIR", t.TempDir())
	for _, profile := range []string{"hand-solder", "reflow"} {
		var out, errs bytes.Buffer
		cfg := &appConfig{project: "parity-" + profile, host: "127.0.0.1", ports: "1-1"}
		window := ""
		cmd := newPcbStageSetAssemblyCmd(cfg, &window, &out, &errs)
		cmd.SetArgs([]string{"--profile", profile})
		if err := cmd.Execute(); err != nil {
			t.Fatal(err)
		}
		status := newWorkflowStatusCmd(cfg, &window, &out, &errs)
		status.SetArgs([]string{"--json"})
		if err := status.Execute(); err != nil {
			t.Fatal(err)
		}
		var value struct {
			Assembly     *pcbAssemblyProfile `json:"assembly"`
			RouteAllowed bool                `json:"routeAllowed"`
		}
		if err := json.Unmarshal(out.Bytes(), &value); err != nil {
			t.Fatal(err, out.String())
		}
		if value.Assembly == nil || value.Assembly.Profile != profile || value.RouteAllowed {
			t.Fatalf("%+v", value)
		}
	}
	cfg := &appConfig{project: "invalid"}
	w := ""
	cmd := newPcbStageSetAssemblyCmd(cfg, &w, io.Discard, io.Discard)
	cmd.SetArgs([]string{"--profile", "invalid"})
	if err := cmd.Execute(); err == nil {
		t.Fatal("invalid accepted")
	}
}
func TestMCPParityPreRouteGate(t *testing.T) {
	t.Setenv("EASYEDA_WORKFLOW_DIR", t.TempDir())
	cfg := &appConfig{project: "parity", host: "127.0.0.1", ports: "1-1"}
	if err := runPcbLayoutLint(cfg, "", 0, true, pcbLayoutGateOpts{gate: true, project: "parity", minScore: 60, maxCrossings: 8}, io.Discard, io.Discard); err == nil {
		t.Fatal("assembly missing must reject")
	}
	rep := pcbLayoutReport{Score: 80}
	opts := pcbLayoutGateOpts{minScore: 60, maxCrossings: 8}
	if !evalLayoutGate(rep, opts).Pass {
		t.Fatal("clean gate rejected")
	}
	assembly := &pcbAssemblyProfile{Profile: "hand-solder", MinGapMil: 40, LargePadAccessMil: 60}
	st := &pcbStageState{Project: "parity", Assembly: assembly}
	if err := savePcbStageState(st); err != nil {
		t.Fatal(err)
	}
	if err := recordLayoutGatePass("parity", rep, assembly); err != nil {
		t.Fatal(err)
	}
	st, _ = loadPcbStageState("parity")
	if !st.Has(stagePreRoutePassed) {
		t.Fatal("gate not persisted")
	}
	if checkRouteGate(st, false, false, "").Allowed {
		t.Fatal("missing outline allowed")
	}
	st.Confirm(stageOutlineConfirmed, "confirm", "test outline")
	if !checkRouteGate(st, false, false, "").Allowed {
		t.Fatal("valid prerequisites blocked")
	}
	rep.Score = 59
	if evalLayoutGate(rep, opts).Pass {
		t.Fatal("low score accepted")
	}
	rep.Score = 80
	rep.CrossingCount = 9
	if evalLayoutGate(rep, opts).Pass {
		t.Fatal("crossings accepted")
	}
}
