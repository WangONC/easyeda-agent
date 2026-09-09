package app

import (
	"encoding/json"
	"fmt"
	"github.com/zhoushoujianwork/easyeda-agent/internal/fastpath"
	"io"
	"math"
)

type measurePath struct {
	Net   string         `json:"net"`
	IDs   []string       `json:"ids"`
	Start fastpath.Point `json:"start"`
	End   fastpath.Point `json:"end"`
}

func traceLength(p fastpath.Primitive) (float64, bool) {
	if p.Unsupported || len(p.Points) < 2 {
		return 0, false
	}
	if p.Kind == "arc" {
		return p.ArcLength, p.ArcLength > 0 && !math.IsNaN(p.ArcLength) && !math.IsInf(p.ArcLength, 0)
	}
	if p.Kind != "trace" {
		return 0, false
	}
	v := 0.0
	for i := 1; i < len(p.Points); i++ {
		v += math.Hypot(p.Points[i][0]-p.Points[i-1][0], p.Points[i][1]-p.Points[i-1][1])
	}
	return v, !math.IsNaN(v) && !math.IsInf(v, 0)
}
func measureGeometry(s fastpath.Snapshot, nets []string, paths []measurePath) []map[string]any {
	out := []map[string]any{}
	near := func(a, b fastpath.Point) bool { return math.Hypot(a[0]-b[0], a[1]-b[1]) < 1e-6 }
	for _, net := range nets {
		layers := map[int]float64{}
		viaCount := 0
		total := 0.0
		complete := true
		byID := map[string]fastpath.Primitive{}
		for _, p := range s.Traces {
			if p.Net != net {
				continue
			}
			byID[p.ID] = p
			l, ok := traceLength(p)
			if !ok {
				complete = false
				continue
			}
			layers[p.Layer] += l
			total += l
		}
		for _, p := range s.Vias {
			if p.Net == net {
				viaCount++
				byID[p.ID] = p
			}
		}
		row := map[string]any{"net": net, "per_layer_length": layers, "trace_copper_length": total, "via_count": viaCount, "geometry_complete": complete, "path_completeness": "unresolved", "unresolved_reason": "explicit ordered path and endpoints required; copper sum is not endpoint signal path", "physical_path_length": nil, "via_barrel_length": nil, "layer_transitions": []any{}}
		var path *measurePath
		for i := range paths {
			if paths[i].Net == net {
				if path != nil {
					path = nil
					break
				}
				path = &paths[i]
			}
		}
		if path != nil && len(path.IDs) > 0 && len(path.IDs) <= 512 {
			cursor := path.Start
			length := 0.0
			layer := 0
			valid := true
			seen := map[string]bool{}
			reason := ""
			for _, id := range path.IDs {
				p, exists := byID[id]
				if !exists || seen[id] {
					valid = false
					reason = "missing or repeated path primitive"
					break
				}
				seen[id] = true
				if p.Kind == "via" {
					valid = false
					reason = "explicit via signal-layer span and physical barrel stackup mapping required"
					break
				}
				l, ok := traceLength(p)
				if !ok {
					valid = false
					reason = "unsupported path geometry"
					break
				}
				if layer != 0 && layer != p.Layer {
					valid = false
					reason = "layer transition without verified via span"
					break
				}
				layer = p.Layer
				a, b := p.Points[0], p.Points[len(p.Points)-1]
				if near(cursor, a) {
					cursor = b
				} else if near(cursor, b) {
					cursor = a
				} else {
					valid = false
					reason = "ordered path is not contiguous"
					break
				}
				length += l
			}
			if valid && !near(cursor, path.End) {
				valid = false
				reason = "path does not reach explicit endpoint"
			}
			if valid {
				row["path_completeness"] = "complete"
				row["physical_path_length"] = length
				row["via_barrel_length"] = 0
				row["path_layer"] = layer
				row["unresolved_reason"] = nil
			} else {
				row["unresolved_reason"] = reason
			}
		}
		if viaCount > 0 {
			row["layer_transitions"] = nil
			row["transitions_unresolved_reason"] = "physical through-via inventory does not identify signal entry/exit pair"
		}
		out = append(out, row)
	}
	return out
}
func pcbReportScoped(cfg *appConfig, window, payload string, stdout, stderr io.Writer) error {
	var p map[string]any
	if e := json.Unmarshal([]byte(payload), &p); e != nil {
		return e
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

func annotateMeasurementReport(result, p map[string]any) error {
	tolerance, hasTolerance := p["tolerance_mil"].(float64)
	if p["tolerance_mil"] != nil && (!hasTolerance || math.IsNaN(tolerance) || math.IsInf(tolerance, 0) || tolerance < 0) {
		return fmt.Errorf("tolerance_mil must be finite and nonnegative")
	}
	values := map[string]float64{}
	if nets, ok := result["nets"].([]any); ok {
		for _, v := range nets {
			if row, ok := v.(map[string]any); ok {
				if n, ok := row["net"].(string); ok {
					if length, ok := row["length"].(float64); ok {
						values[n] = length
					}
				}
			}
		}
	}

	// Pair/group-only scopes still contain measured net lengths.
	if pairs, ok := result["differentialPairs"].([]any); ok {
		for _, v := range pairs {
			if r, ok := v.(map[string]any); ok {
				for _, side := range []string{"positive", "negative"} {
					n, _ := r[side+"Net"].(string)
					length, ok := r[side+"Length"].(float64)
					if n != "" && ok && !math.IsNaN(length) && !math.IsInf(length, 0) {
						values[n] = length
					}
				}
			}
		}
	}
	if groups, ok := result["equalLengthNetGroups"].([]any); ok {
		for _, v := range groups {
			if r, ok := v.(map[string]any); ok {
				if members, ok := r["members"].([]any); ok {
					for _, m := range members {
						if row, ok := m.(map[string]any); ok {
							n, _ := row["net"].(string)
							length, ok := row["length"].(float64)
							if n != "" && ok && !math.IsNaN(length) && !math.IsInf(length, 0) {
								values[n] = length
							}
						}
					}
				}
			}
		}
	}
	if ref, ok := p["reference_net"].(string); ok && ref != "" {
		if base, ok := values[ref]; ok {
			deltas := map[string]float64{}
			for n, v := range values {
				deltas[n] = v - base
			}
			result["reference_net"] = ref
			result["copper_length_delta"] = deltas
		} else {
			result["reference_unresolved_reason"] = "reference net was not measured in requested scope"
		}
	}
	if groups, ok := result["equalLengthNetGroups"].([]any); ok {
		for _, g := range groups {
			row, ok := g.(map[string]any)
			if !ok {
				continue
			}
			members, _ := row["members"].([]any)
			complete := len(members) > 0
			min, max := math.Inf(1), math.Inf(-1)
			for _, m := range members {
				member, ok := m.(map[string]any)
				if !ok {
					complete = false
					continue
				}
				v, ok := member["length"].(float64)
				if !ok {
					complete = false
					continue
				}
				min = math.Min(min, v)
				max = math.Max(max, v)
			}
			row["minimum"] = nil
			row["maximum"] = nil
			row["tolerance_verdict"] = "unresolved"
			row["metric"] = "total_copper_length"
			if complete {
				row["minimum"] = min
				row["maximum"] = max
				if hasTolerance {
					row["tolerance_mil"] = tolerance
					row["tolerance_verdict"] = "PASS"
					if max-min > tolerance {
						row["tolerance_verdict"] = "FAIL"
					}
				}
			}
		}
	}
	if pairs, ok := result["differentialPairs"].([]any); ok {
		for _, v := range pairs {
			row, ok := v.(map[string]any)
			if !ok {
				continue
			}
			row["metric"] = "total_copper_length"
			row["tolerance_verdict"] = "unresolved"
			if skew, ok := row["skew"].(float64); ok && hasTolerance {
				row["tolerance_mil"] = tolerance
				row["tolerance_verdict"] = "PASS"
				if skew > tolerance {
					row["tolerance_verdict"] = "FAIL"
				}
			}
		}
	}
	return nil
}

// A layer match alone does not establish reviewed impedance geometry.
func pathMatchesProfile(s fastpath.Snapshot, paths []measurePath, net string, profile fastpath.RoutingProfile) bool {
	ids := map[string]bool{}
	for _, path := range paths {
		if path.Net == net {
			for _, id := range path.IDs {
				ids[id] = true
			}
		}
	}
	if len(ids) == 0 {
		return false
	}
	for _, p := range s.Traces {
		if ids[p.ID] {
			if p.Unsupported || p.Layer != profile.SignalLayer || math.Abs(p.Width-profile.Width) > 1e-7 {
				return false
			}
			delete(ids, p.ID)
		}
	}
	return len(ids) == 0
}
