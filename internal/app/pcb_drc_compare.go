package app

import (
	"encoding/json"
	"fmt"
	"github.com/spf13/cobra"
	"github.com/zhoushoujianwork/easyeda-agent/internal/drc"
	"github.com/zhoushoujianwork/easyeda-agent/internal/fastpath"
	"github.com/zhoushoujianwork/easyeda-agent/internal/workflow"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"time"
)

type drcBaseline = drc.Baseline

func compareDRC(a, b drcBaseline) map[string]any { return drc.Compare(a, b) }

var drcIDPattern = regexp.MustCompile(`^[0-9a-f]{64}$`)

func drcRecordPath(id string) string {
	return filepath.Join(workflow.Dir(), "drc-baselines", id+".json")
}
func loadDRCBaseline(id string) (drcBaseline, error) {
	var v drcBaseline
	if !drcIDPattern.MatchString(id) {
		return v, fmt.Errorf("invalid drc ID")
	}
	b, e := os.ReadFile(drcRecordPath(id))
	if e != nil {
		return v, e
	}
	e = json.Unmarshal(b, &v)
	return v, e
}
func addDRCCompare(pcb *cobra.Command, cfg *appConfig, stdout, stderr io.Writer) {
	var payload, window string
	c := &cobra.Command{Use: "drc-compare", Short: "Native DRC with compact stable-anchor baseline comparison", Args: cobra.NoArgs, RunE: func(_ *cobra.Command, _ []string) error {
		var p struct {
			Project   string `json:"project_uuid"`
			Doc       string `json:"document_uuid"`
			Baseline  string `json:"baseline_id"`
			RunNative bool   `json:"run_native"`
		}
		if e := json.Unmarshal([]byte(payload), &p); e != nil {
			return e
		}
		if p.Project == "" || p.Doc == "" || !p.RunNative {
			return fmt.Errorf("explicit project_uuid/document_uuid and run_native:true required; no hidden DRC run")
		}
		pinned := *cfg
		pinned.doc = p.Doc
		pinned.project = p.Project
		cfg = &pinned
		var old drcBaseline
		var e error
		if p.Baseline != "" {
			old, e = loadDRCBaseline(p.Baseline)
			if e != nil {
				return e
			}
			if old.Project != p.Project || old.Document != p.Doc {
				return fmt.Errorf("baseline belongs to another design")
			}
		}
		scope := map[string]any{"project_uuid": p.Project, "document_uuid": p.Doc, "include": map[string]bool{"components": false, "pads": false, "traces": false, "vias": false, "fills": false}}
		before, e := requestAction(cfg, "board.snapshot_compact", window, scope)
		if e != nil {
			return e
		}
		native, e := requestActionTimed(cfg, "pcb.drc.check", window, nil, 120*time.Second)
		if e != nil {
			return drcTimeoutHint(e, stderr)
		}
		after, e := requestAction(cfg, "board.snapshot_compact", window, scope)
		if e != nil {
			return e
		}
		str := func(k string) string { v, _ := after.Result[k].(string); return v }
		now := drcBaseline{Layers: fastpath.Hash(after.Result["copper_layers"]), Project: p.Project, Document: p.Doc, Revision: str("board_revision"), Rules: str("rules_hash"), Stackup: str("stackup_hash"), Trusted: sameObservedContent(before, after) && native.Context != nil && native.Context.ProjectUUID == p.Project && native.Context.DocumentUUID == p.Doc, Report: flattenDrcResult(native.Result)}
		now.ID = fastpath.Hash(now)
		if e = os.MkdirAll(filepath.Dir(drcRecordPath(now.ID)), 0700); e != nil {
			return e
		}
		b, e := json.Marshal(now)
		if e != nil {
			return e
		}
		if e = os.WriteFile(drcRecordPath(now.ID), b, 0600); e != nil {
			return e
		}
		result := map[string]any{"drc_id": now.ID, "revision": now.Revision, "passed": now.Report.Passed, "counts": now.Report.Counts, "comparable": false, "reason": "no baseline selected", "detailed_artifact": drcRecordPath(now.ID), "scope": "native whole board", "comparison_context": "native rules and logical layers; physical stackup availability reported separately", "physical_stackup_observed": now.Stackup != "", "readback_stable": now.Trusted}
		if p.Baseline != "" {
			delete(result, "reason")
			for k, v := range compareDRC(old, now) {
				result[k] = v
			}
		}
		// Cap projected rows, retaining complete evidence in the persisted artifact.
		for _, key := range []string{"new", "cleared", "persistent"} {
			if rows, ok := result[key].([]drcFlatViolation); ok && len(rows) > 20 {
				result[key] = rows[:20]
				result[key+"_omitted"] = len(rows) - 20
			}
		}
		return json.NewEncoder(stdout).Encode(map[string]any{"ok": true, "result": result})
	}}
	c.Flags().StringVar(&payload, "payload", "{}", "Explicit native run and optional baseline ID")
	c.Flags().StringVar(&window, "window", "", "Connector window ID")
	pcb.AddCommand(c)
}
