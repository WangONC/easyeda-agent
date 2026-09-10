package app

import (
	"encoding/json"
	"fmt"
	"github.com/zhoushoujianwork/easyeda-agent/internal/fastpath"
	"github.com/zhoushoujianwork/easyeda-agent/internal/measurement"
	"io"
)

type measurePath = measurement.Path

var traceLength = measurement.TraceLength
var measureGeometry = measurement.Geometry
var annotateMeasurementReport = measurement.Annotate
var pathMatchesProfile = measurement.PathMatchesProfile

func pcbReportScoped(cfg *appConfig, window, payload string, stdout, stderr io.Writer) error {
	var p map[string]any
	if e := json.Unmarshal([]byte(payload), &p); e != nil {
		return e
	}
	if value, exists := p["telemetry"]; exists {
		if _, ok := value.(bool); !ok {
			return fmt.Errorf("telemetry must be boolean")
		}
	}
	if p["telemetry"] == true {
		return pcbRoutingTelemetry(cfg, window, p, stdout, stderr)
	}
	if p["geometry"] != true && p["profile_id"] == nil {
		return dispatch(cfg, "pcb.report", window, p, stdout, stderr)
	}
	doc, _ := p["document_uuid"].(string)
	project, _ := p["project_uuid"].(string)
	if doc == "" || project == "" {
		return fmt.Errorf("geometry report requires explicit project_uuid/document_uuid")
	}
	pinned := *cfg
	pinned.doc = doc
	pinned.project = project
	cfg = &pinned
	native, e := requestAction(cfg, "pcb.report", window, p)
	if e != nil {
		return e
	}
	// Native report determines requested net membership, including selected pairs/groups.
	names := []string{}
	seen := map[string]bool{}
	add := func(v any) {
		if n, ok := v.(string); ok && n != "" && !seen[n] {
			seen[n] = true
			names = append(names, n)
		}
	}
	if rows, ok := native.Result["nets"].([]any); ok {
		for _, v := range rows {
			if r, ok := v.(map[string]any); ok {
				add(r["net"])
			}
		}
	}
	if rows, ok := native.Result["differentialPairs"].([]any); ok {
		for _, v := range rows {
			if r, ok := v.(map[string]any); ok {
				add(r["positiveNet"])
				add(r["negativeNet"])
			}
		}
	}
	if rows, ok := native.Result["equalLengthNetGroups"].([]any); ok {
		for _, v := range rows {
			if r, ok := v.(map[string]any); ok {
				if members, ok := r["members"].([]any); ok {
					for _, m := range members {
						if row, ok := m.(map[string]any); ok {
							add(row["net"])
						}
					}
				}
			}
		}
	}
	snapshot, e := requestAction(cfg, "board.snapshot_compact", window, map[string]any{"project_uuid": project, "document_uuid": doc, "nets": names, "include": map[string]bool{"components": false, "pads": false, "fills": false, "traces": true, "vias": true}})
	if e != nil {
		return e
	}
	var s fastpath.Snapshot
	if e = fastpath.Decode(snapshot.Result, &s); e != nil {
		return e
	}
	var paths []measurePath
	if p["paths"] != nil {
		if e = fastpath.Decode(p["paths"], &paths); e != nil {
			return e
		}
	}
	rows := measureGeometry(s, names, paths)
	if id, ok := p["profile_id"].(string); ok && id != "" {
		r, e := requestAction(cfg, "pcb.routing_profile", window, map[string]any{"project_uuid": project, "document_uuid": doc, "operation": "get", "profile_id": id})
		if e != nil {
			return e
		}
		var profile fastpath.RoutingProfile
		if e = fastpath.Decode(r.Result["profile"], &profile); e != nil {
			return e
		}
		state, _ := r.Result["state"].(string)
		native.Result["profile_state"] = state
		native.Result["profile_stale_reason"] = r.Result["stale_reason"]
		native.Result["profile_usable"] = fastpath.ProfileUsable(state)
		for _, row := range rows {
			row["delay_profile_id"] = id
			row["estimated_delay_ps"] = nil
			if fastpath.ProfileUsable(state) && r.Result["board_revision"] == s.Revision && profile.UnitDelay > 0 && pathMatchesProfile(s, paths, row["net"].(string), profile) && row["path_layer"] == profile.SignalLayer && row["path_completeness"] == "complete" {
				row["estimated_delay_ps"] = row["physical_path_length"].(float64) * profile.UnitDelay
			} else {
				row["delay_unresolved_reason"] = "verified matching single-layer path/profile with unit delay required"
			}
		}
	}
	if err := annotateMeasurementReport(native.Result, p); err != nil {
		return err
	}
	native.Result["geometry_measurements"] = rows
	native.Result["board_revision"] = s.Revision
	native.Result["measurement_note"] = "native copper totals and explicit endpoint path are distinct; no topology guessing; delay is a profile-based estimate"
	return json.NewEncoder(stdout).Encode(map[string]any{"ok": true, "result": native.Result})
}
