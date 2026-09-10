package app

import (
	"encoding/json"
	"fmt"
	"github.com/zhoushoujianwork/easyeda-agent/internal/fastpath"
	"github.com/zhoushoujianwork/easyeda-agent/internal/measurement"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
	"io"
)

type routingDistribution = measurement.Distribution
type routingBucket = measurement.Bucket
type routingLayer = measurement.Layer
type routingStats = measurement.Stats

var routingQuantiles = measurement.Quantiles
var routingTelemetry = measurement.Telemetry

func pcbRoutingTelemetry(cfg *appConfig, window string, p map[string]any, stdout, stderr io.Writer) error {
	if protocol.ActionDisabled("pcb.report") {
		return dispatch(cfg, "pcb.report", window, p, stdout, stderr)
	}
	for k := range p {
		switch k {
		case "telemetry", "nets", "project_uuid", "document_uuid":
		default:
			return fmt.Errorf("telemetry supports only board/nets scope; incompatible parameter: %s", k)
		}
	}
	var nets []string
	_, scoped := p["nets"]
	if scoped {
		if err := fastpath.Decode(p["nets"], &nets); err != nil || nets == nil || len(nets) > 256 {
			return fmt.Errorf("nets must be an array of at most 256 names")
		}
		for _, n := range nets {
			if n == "" {
				return fmt.Errorf("nets must contain nonempty names")
			}
		}
	}
	doc, _ := p["document_uuid"].(string)
	project, _ := p["project_uuid"].(string)
	if doc == "" {
		doc = cfg.doc
	}
	if project == "" {
		project = cfg.project
	}
	if doc == "" || project == "" {
		return fmt.Errorf("telemetry requires explicit project_uuid/document_uuid or --project/--doc")
	}
	pinned := *cfg
	pinned.doc = doc
	pinned.project = project
	cfg = &pinned
	inventory, err := requestAction(cfg, "pcb.nets.list", window, nil)
	if err != nil {
		return err
	}
	var rows []struct {
		Net string `json:"net"`
	}
	if inventory.Result["nets"] == nil {
		return fmt.Errorf("TELEMETRY_UNRESOLVED: missing net inventory")
	}
	if err = fastpath.Decode(inventory.Result["nets"], &rows); err != nil {
		return err
	}
	names := []string{}
	known := map[string]bool{}
	for _, r := range rows {
		if r.Net != "" {
			names = append(names, r.Net)
			known[r.Net] = true
		}
	}
	for _, n := range nets {
		if !known[n] {
			return fmt.Errorf("UNKNOWN_NET: %s", n)
		}
	}
	snapshot, err := requestAction(cfg, "board.snapshot_compact", window, map[string]any{"project_uuid": project, "document_uuid": doc, "nets": nets, "include": map[string]bool{"components": false, "pads": false, "fills": false, "traces": true, "vias": true}})
	if err != nil {
		return err
	}
	var s fastpath.Snapshot
	if err = fastpath.Decode(snapshot.Result, &s); err != nil {
		return err
	}
	telemetry, err := routingTelemetry(s, names, nets, scoped)
	if err != nil {
		return err
	}
	return json.NewEncoder(stdout).Encode(map[string]any{"ok": true, "result": map[string]any{"routingTelemetry": telemetry}})
}
