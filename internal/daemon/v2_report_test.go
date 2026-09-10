package daemon

import (
	"encoding/json"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"github.com/zhoushoujianwork/easyeda-agent/internal/fastpath"
	"testing"
)

func reportFixture(t *testing.T, input map[string]any) (executionv2.Request, executionv2.HandlerResult) {
	t.Helper()
	req := executionv2.Request{Protocol: executionv2.Version, Action: "pcb.report", ActionRevision: "1", Schema: "test", RequestID: "r", OperationID: "o", Target: executionv2.Target{Scope: "DOCUMENT", Session: "s", Activation: "a", ProjectUUID: "p", DocumentUUID: "d", DocumentType: "pcb", TabID: "tab"}, Input: input, BudgetMS: 1000}
	digest, _ := req.Digest()
	snapshot := fastpath.Snapshot{Revision: "r1", Layers: []int{1}, Traces: []fastpath.Primitive{{ID: "line", Kind: "trace", Net: "N", Layer: 1, Points: []fastpath.Point{{0, 0}, {10, 0}}}}, Vias: []fastpath.Primitive{}}
	value, _ := json.Marshal(map[string]any{"report_bundle": "report.v2", "native": map[string]any{"nets": []any{map[string]any{"net": "N", "length": 10}}}, "snapshot": snapshot, "inventory": []string{"N"}})
	h := executionv2.HandlerResult{Protocol: executionv2.Version, OperationID: req.OperationID, Digest: digest, Target: req.Target, Effects: executionv2.Effects{Started: executionv2.Bool(false), Changed: executionv2.Bool(false), Settled: true, Scope: "NONE"}, Verification: executionv2.Verification{Verdict: "satisfied", Checked: []string{"fresh_read"}, Complete: true, Required: 1, Satisfied: 1}, Value: value}
	return req, h
}
func TestV2ReportPreservesGeometryAndTelemetry(t *testing.T) {
	for _, mode := range []string{"geometry", "telemetry"} {
		req, h := reportFixture(t, map[string]any{mode: true})
		h = completeReportV2(req, h)
		result := executionv2.Finalize(req, h.Digest, h, false)
		if result.Outcome != executionv2.Succeeded {
			t.Fatal(mode, result)
		}
		var value map[string]any
		if err := json.Unmarshal(h.Value, &value); err != nil {
			t.Fatal(err)
		}
		if mode == "geometry" {
			if value["geometry_measurements"].([]any)[0].(map[string]any)["trace_copper_length"] != 10.0 {
				t.Fatal(value)
			}
		} else if value["routingTelemetry"] == nil {
			t.Fatal(value)
		}
		if len(h.Evidence) == 0 {
			t.Fatal("observation was not retained")
		}
	}
}
func TestV2ReportMalformedBundleAndForeignReceiptFailClosed(t *testing.T) {
	req, h := reportFixture(t, map[string]any{"geometry": true})
	h.Value = json.RawMessage(`{"report_bundle":"report.v2","native":{},"snapshot":{}}`)
	got := completeReportV2(req, h)
	if executionv2.Finalize(req, h.Digest, got, false).Outcome != executionv2.Unknown {
		t.Fatal(got)
	}
	req, h = reportFixture(t, map[string]any{"geometry": true})
	digest := h.Digest
	h.OperationID = "foreign"
	got = completeReportV2(req, h)
	if executionv2.Finalize(req, digest, got, false).Outcome != executionv2.Unknown {
		t.Fatal(got)
	}
}
func TestV2ReportProfileMissingIsNotAnEmptySuccess(t *testing.T) {
	req, h := reportFixture(t, map[string]any{"profile_id": "missing"})
	h = completeReportV2(req, h)
	if executionv2.Finalize(req, h.Digest, h, false).Outcome != executionv2.Unknown {
		t.Fatal(h)
	}
}
