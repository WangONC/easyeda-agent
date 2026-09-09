package app

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"sort"

	"github.com/zhoushoujianwork/easyeda-agent/internal/fastpath"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
)

type routingDistribution struct {
	Count  int      `json:"count"`
	Min    *float64 `json:"min"`
	Median *float64 `json:"median"`
	P90    *float64 `json:"p90"`
	Max    *float64 `json:"max"`
}

func routingQuantiles(values []float64) routingDistribution {
	d := routingDistribution{Count: len(values)}
	if len(values) == 0 {
		return d
	}
	v := append([]float64(nil), values...)
	sort.Float64s(v)
	at := func(p float64) *float64 { x := v[int(math.Ceil(p*float64(len(v))))-1]; return &x }
	minimum := v[0]
	d.Min = &minimum
	d.Median = at(.5)
	d.P90 = at(.9)
	d.Max = at(1)
	return d
}

type routingBucket struct {
	Center int     `json:"centerDeg"`
	Count  int     `json:"count"`
	Length float64 `json:"length"`
}
type routingLayer struct {
	Layer       int     `json:"layer"`
	TraceLength float64 `json:"traceLength"`
	TraceCount  int     `json:"traceCount"`
}
type routingStats struct {
	Net         string              `json:"net,omitempty"`
	Total       float64             `json:"totalCopperLength"`
	Traces      int                 `json:"traceCount"`
	Lines       int                 `json:"lineCount"`
	LineLength  float64             `json:"lineLength"`
	ArcLength   float64             `json:"arcLength"`
	Arcs        int                 `json:"arcCount"`
	Vias        int                 `json:"viaCount"`
	Segments    routingDistribution `json:"segmentLengthDistribution"`
	Orientation []routingBucket     `json:"orientationHistogram"`
	Layers      []routingLayer      `json:"layerUsage"`
	lengths     []float64
	layers      map[int]*routingLayer
}

func newRoutingStats(net string) *routingStats {
	r := &routingStats{Net: net, Layers: []routingLayer{}, layers: map[int]*routingLayer{}}
	for i := 0; i < 180; i += 15 {
		r.Orientation = append(r.Orientation, routingBucket{Center: i})
	}
	return r
}
func (r *routingStats) add(p fastpath.Primitive, length float64) {
	// Total is the sum of in-plane line and arc centerline lengths only.
	l := r.layers[p.Layer]
	if l == nil {
		l = &routingLayer{Layer: p.Layer}
		r.layers[p.Layer] = l
	}
	l.TraceLength += length
	l.TraceCount++
	if p.Kind == "arc" {
		r.Arcs++
		r.ArcLength += length
		r.Total = r.LineLength + r.ArcLength
		r.lengths = append(r.lengths, length)
		return
	}
	r.Traces++
	r.Lines++
	r.LineLength += length
	r.Total = r.LineLength + r.ArcLength
	for i := 1; i < len(p.Points); i++ {
		dx, dy := p.Points[i][0]-p.Points[i-1][0], p.Points[i][1]-p.Points[i-1][1]
		length := math.Hypot(dx, dy)
		r.lengths = append(r.lengths, length)
		if length == 0 {
			continue
		}
		angle := math.Mod(math.Atan2(dy, dx)*180/math.Pi, 180)
		if angle < 0 {
			angle += 180
		}
		if angle >= 180 {
			angle = 0
		}
		b := &r.Orientation[int(math.Floor((angle+7.5)/15))%12]
		b.Count++
		b.Length += length
	}
}
func (r *routingStats) finish() {
	r.Segments = routingQuantiles(r.lengths)
	for _, l := range r.layers {
		r.Layers = append(r.Layers, *l)
	}
	sort.Slice(r.Layers, func(i, j int) bool { return r.Layers[i].Layer < r.Layers[j].Layer })
}
func routingTelemetry(s fastpath.Snapshot, inventory, selected []string, scoped bool) (map[string]any, error) {
	known := map[string]bool{}
	for _, n := range inventory {
		known[n] = true
	}
	names := inventory
	if scoped {
		names = selected
	}
	byNet := map[string]*routingStats{}
	order := []string{}
	for _, n := range names {
		if !known[n] {
			return nil, fmt.Errorf("UNKNOWN_NET: %s", n)
		}
		if byNet[n] == nil {
			byNet[n] = newRoutingStats(n)
			order = append(order, n)
		}
	}
	copper := map[int]bool{}
	for _, l := range s.Layers {
		copper[l] = true
	}
	board := newRoutingStats("")
	for _, p := range s.Traces {
		if scoped && byNet[p.Net] == nil {
			continue
		}
		if len(copper) == 0 {
			return nil, fmt.Errorf("TELEMETRY_UNRESOLVED: missing copper layer inventory")
		}
		if !copper[p.Layer] {
			continue
		}
		length, ok := traceLength(p)
		if !ok {
			return nil, fmt.Errorf("TELEMETRY_UNRESOLVED: unsupported trace %s", p.ID)
		}
		board.add(p, length)
		if r := byNet[p.Net]; r != nil {
			r.add(p, length)
		}
	}
	for _, p := range s.Vias {
		if scoped && byNet[p.Net] == nil {
			continue
		}
		board.Vias++
		if r := byNet[p.Net]; r != nil {
			r.Vias++
		}
	}
	result := map[string]any{"units": "mil", "board_revision": s.Revision, "percentileMethod": "nearest-rank", "orientationInterval": "[centerDeg-7.5,centerDeg+7.5) modulo 180", "scope": "board"}
	if scoped {
		result["scope"] = "nets"
		rows := []*routingStats{}
		for _, n := range order {
			r := byNet[n]
			r.finish()
			rows = append(rows, r)
		}
		result["nets"] = rows
	} else {
		board.finish()
		result["summary"] = board
		lengths := []float64{}
		for _, n := range order {
			if byNet[n].Total > 0 {
				lengths = append(lengths, byNet[n].Total)
			}
		}
		result["netCount"] = len(order)
		result["routedNetCount"] = len(lengths)
		result["unroutedNetCount"] = len(order) - len(lengths)
		result["netLengthDistribution"] = routingQuantiles(lengths)
	}
	return result, nil
}
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
