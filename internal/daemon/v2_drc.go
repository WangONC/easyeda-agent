package daemon

import (
	"encoding/json"
	"fmt"
	"github.com/zhoushoujianwork/easyeda-agent/internal/drc"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"github.com/zhoushoujianwork/easyeda-agent/internal/fastpath"
	"github.com/zhoushoujianwork/easyeda-agent/internal/workflow"
	"os"
	"path/filepath"
	"regexp"
)

func drcPathV2(id string) string { return filepath.Join(workflow.Dir(), "drc-baselines", id+".json") }
func loadDrcV2(id string) (drc.Baseline, error) {
	var b drc.Baseline
	if !regexp.MustCompile(`^[0-9a-f]{64}$`).MatchString(id) {
		return b, fmt.Errorf("V2_INVALID_DRC_ID")
	}
	data, e := os.ReadFile(drcPathV2(id))
	if e != nil {
		return b, e
	}
	if e = json.Unmarshal(data, &b); e != nil {
		return b, e
	}
	saved := b.ID
	b.ID = ""
	if saved != id || fastpath.Hash(b) != id {
		return b, fmt.Errorf("V2_FOREIGN_DRC_BASELINE")
	}
	b.ID = saved
	return b, nil
}
func validateDrcV2(req executionv2.Request) error {
	if req.Input["run_native"] != true {
		return fmt.Errorf("V2_EXPLICIT_DRC_REQUIRED")
	}
	if id, ok := req.Input["baseline_id"].(string); ok && id != "" {
		b, e := loadDrcV2(id)
		if e != nil {
			return e
		}
		if b.Project != req.Target.ProjectUUID || b.Document != req.Target.DocumentUUID {
			return fmt.Errorf("V2_FOREIGN_DRC_BASELINE")
		}
	}
	return nil
}
func completeDrcV2(req executionv2.Request, h executionv2.HandlerResult) executionv2.HandlerResult {
	if req.Action != "pcb.drc.compare" {
		return h
	}
	digest, e := req.Digest()
	if e != nil || h.Protocol != executionv2.Version || h.OperationID != req.OperationID || h.Digest != digest || h.Target != req.Target || !h.Effects.Settled || h.Verification.Verdict != "satisfied" || !h.Verification.Complete {
		return h
	}
	fail := func(e error) executionv2.HandlerResult {
		h.Evidence = h.Value
		h.Value, _ = json.Marshal(map[string]any{"error": e.Error()})
		h.Verification = executionv2.Verification{Verdict: "unavailable"}
		return h
	}
	var bundle struct {
		Version string            `json:"drc_comparison"`
		Report  map[string]any    `json:"report"`
		Before  fastpath.Snapshot `json:"before"`
		After   fastpath.Snapshot `json:"after"`
	}
	if e = json.Unmarshal(h.Value, &bundle); e != nil {
		return fail(e)
	}
	if bundle.Version != "v2" || bundle.After.Revision == "" || bundle.Report == nil {
		return fail(fmt.Errorf("V2_DRC_BUNDLE_INVALID"))
	}
	stackup, rules := fastpath.ProfileTokens(bundle.After)
	now := drc.Baseline{Layers: fastpath.Hash(bundle.After.Layers), Project: req.Target.ProjectUUID, Document: req.Target.DocumentUUID, Revision: bundle.After.Revision, Rules: rules, Stackup: stackup, Trusted: true, Report: drc.Flatten(bundle.Report)}
	now.ID = fastpath.Hash(now)
	if e = os.MkdirAll(filepath.Dir(drcPathV2(now.ID)), 0700); e != nil {
		return fail(e)
	}
	data, _ := json.Marshal(now)
	if e = os.WriteFile(drcPathV2(now.ID), data, 0600); e != nil {
		return fail(e)
	}
	value := map[string]any{"drc_id": now.ID, "revision": now.Revision, "passed": now.Report.Passed, "design_pass": now.Report.Passed, "counts": now.Report.Counts, "comparable": false, "reason": "no baseline selected", "detailed_artifact": drcPathV2(now.ID), "scope": "native whole board", "comparison_context": "native rules and logical layers; physical stackup availability reported separately", "physical_stackup_observed": now.Stackup != "", "readback_stable": true}
	if id, ok := req.Input["baseline_id"].(string); ok && id != "" {
		old, e := loadDrcV2(id)
		if e != nil {
			return fail(e)
		}
		delete(value, "reason")
		for k, v := range drc.Compare(old, now) {
			value[k] = v
		}
	}
	for _, key := range []string{"new", "cleared", "persistent"} {
		if rows, ok := value[key].([]drc.Violation); ok && len(rows) > 20 {
			value[key] = rows[:20]
			value[key+"_omitted"] = len(rows) - 20
		}
	}
	h.Evidence = h.Value
	h.Value, _ = json.Marshal(value)
	h.Verification.Checked = append(h.Verification.Checked, "stable_anchor_drc_comparison")
	return h
}
