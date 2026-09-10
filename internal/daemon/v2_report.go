package daemon

import (
	"encoding/json"
	"fmt"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"github.com/zhoushoujianwork/easyeda-agent/internal/fastpath"
	"github.com/zhoushoujianwork/easyeda-agent/internal/measurement"
)

// Action-specific read computation, before the single public finalizer. No
// legacy Response, child dispatch, or outcome interpretation is involved.
func completeReportV2(req executionv2.Request, h executionv2.HandlerResult) executionv2.HandlerResult {
	p := req.Input
	if req.Action != "pcb.report" || (p["telemetry"] != true && p["geometry"] != true && p["profile_id"] == nil) {
		return h
	}
	digest, err := req.Digest()
	if err != nil || h.Protocol != executionv2.Version || h.OperationID != req.OperationID || h.Digest != digest || h.Target != req.Target || h.Verification.Verdict != "satisfied" || !h.Verification.Complete {
		return h
	}
	value, err := reportValueV2(req, h.Value)
	if err != nil {
		h.Verification = executionv2.Verification{Verdict: "unavailable"}
		h.Evidence, _ = json.Marshal(map[string]any{"report_error": err.Error(), "observation": json.RawMessage(h.Value)})
		h.Value = nil
		return h
	}
	h.Evidence = h.Value
	h.Value, _ = json.Marshal(value)
	h.Verification.Checked = append(h.Verification.Checked, "report_business_computation")
	return h
}
func reportValueV2(req executionv2.Request, raw json.RawMessage) (map[string]any, error) {
	var bundle struct {
		Version   string          `json:"report_bundle"`
		Native    map[string]any  `json:"native"`
		Snapshot  json.RawMessage `json:"snapshot"`
		Inventory []string        `json:"inventory"`
	}
	if err := json.Unmarshal(raw, &bundle); err != nil {
		return nil, err
	}
	if bundle.Version != "report.v2" || bundle.Native == nil {
		return nil, fmt.Errorf("V2_REPORT_BUNDLE_INVALID")
	}
	var s fastpath.Snapshot
	if err := json.Unmarshal(bundle.Snapshot, &s); err != nil {
		return nil, err
	}
	if s.Revision == "" || s.Traces == nil || s.Vias == nil {
		return nil, fmt.Errorf("V2_REPORT_SNAPSHOT_INCOMPLETE")
	}
	p := req.Input
	if p["telemetry"] == true {
		if bundle.Inventory == nil {
			return nil, fmt.Errorf("V2_REPORT_INVENTORY_MISSING")
		}
		var selected []string
		_, scoped := p["nets"]
		if scoped {
			if err := fastpath.Decode(p["nets"], &selected); err != nil {
				return nil, err
			}
		}
		value, err := measurement.Telemetry(s, bundle.Inventory, selected, scoped)
		return map[string]any{"routingTelemetry": value}, err
	}
	names := []string{}
	seen := map[string]bool{}
	add := func(v any) {
		if n, ok := v.(string); ok && n != "" && !seen[n] {
			seen[n] = true
			names = append(names, n)
		}
	}
	result := bundle.Native
	if rows, ok := result["nets"].([]any); ok {
		for _, v := range rows {
			if r, ok := v.(map[string]any); ok {
				add(r["net"])
			}
		}
	}
	if rows, ok := result["differentialPairs"].([]any); ok {
		for _, v := range rows {
			if r, ok := v.(map[string]any); ok {
				add(r["positiveNet"])
				add(r["negativeNet"])
			}
		}
	}
	if rows, ok := result["equalLengthNetGroups"].([]any); ok {
		for _, v := range rows {
			if r, ok := v.(map[string]any); ok {
				if members, ok := r["members"].([]any); ok {
					for _, m := range members {
						if member, ok := m.(map[string]any); ok {
							add(member["net"])
						}
					}
				}
			}
		}
	}
	var paths []measurement.Path
	if p["paths"] != nil {
		if err := fastpath.Decode(p["paths"], &paths); err != nil {
			return nil, err
		}
	}
	rows := measurement.Geometry(s, names, paths)
	if id, ok := p["profile_id"].(string); ok && id != "" {
		profile, err := loadRoutingProfile(req.Target.ProjectUUID, req.Target.DocumentUUID, id)
		if err != nil {
			return nil, err
		}
		state, reason := profile.EvidenceState(s)
		result["profile_state"] = state
		result["profile_stale_reason"] = reason
		result["profile_usable"] = fastpath.ProfileUsable(state)
		for _, row := range rows {
			row["delay_profile_id"] = id
			row["estimated_delay_ps"] = nil
			if fastpath.ProfileUsable(state) && profile.UnitDelay > 0 && measurement.PathMatchesProfile(s, paths, row["net"].(string), profile) && row["path_layer"] == profile.SignalLayer && row["path_completeness"] == "complete" {
				row["estimated_delay_ps"] = row["physical_path_length"].(float64) * profile.UnitDelay
			} else {
				row["delay_unresolved_reason"] = "verified matching single-layer path/profile with unit delay required"
			}
		}
	}
	if err := measurement.Annotate(result, p); err != nil {
		return nil, err
	}
	result["geometry_measurements"] = rows
	result["board_revision"] = s.Revision
	result["measurement_note"] = "native copper totals and explicit endpoint path are distinct; no topology guessing; delay is a profile-based estimate"
	return result, nil
}
