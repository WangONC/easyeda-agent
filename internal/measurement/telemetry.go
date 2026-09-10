package measurement

import (
	"fmt"
	"github.com/zhoushoujianwork/easyeda-agent/internal/fastpath"
	"math"
	"sort"
)

type Distribution struct {
	Count  int      `json:"count"`
	Min    *float64 `json:"min"`
	Median *float64 `json:"median"`
	P90    *float64 `json:"p90"`
	Max    *float64 `json:"max"`
}

func Quantiles(values []float64) Distribution {
	d := Distribution{Count: len(values)}
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

type Bucket struct {
	Center int     `json:"centerDeg"`
	Count  int     `json:"count"`
	Length float64 `json:"length"`
}
type Layer struct {
	Layer       int     `json:"layer"`
	TraceLength float64 `json:"TraceLength"`
	TraceCount  int     `json:"traceCount"`
}
type Stats struct {
	Net         string       `json:"net,omitempty"`
	Total       float64      `json:"totalCopperLength"`
	Traces      int          `json:"traceCount"`
	Lines       int          `json:"lineCount"`
	LineLength  float64      `json:"lineLength"`
	ArcLength   float64      `json:"arcLength"`
	Arcs        int          `json:"arcCount"`
	Vias        int          `json:"viaCount"`
	Segments    Distribution `json:"segmentLengthDistribution"`
	Orientation []Bucket     `json:"orientationHistogram"`
	Layers      []Layer      `json:"layerUsage"`
	lengths     []float64
	layers      map[int]*Layer
}

func newRoutingStats(net string) *Stats {
	r := &Stats{Net: net, Layers: []Layer{}, layers: map[int]*Layer{}}
	for i := 0; i < 180; i += 15 {
		r.Orientation = append(r.Orientation, Bucket{Center: i})
	}
	return r
}
func (r *Stats) add(p fastpath.Primitive, length float64) {
	// Total is the sum of in-plane line and arc centerline lengths only.
	l := r.layers[p.Layer]
	if l == nil {
		l = &Layer{Layer: p.Layer}
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
func (r *Stats) finish() {
	r.Segments = Quantiles(r.lengths)
	for _, l := range r.layers {
		r.Layers = append(r.Layers, *l)
	}
	sort.Slice(r.Layers, func(i, j int) bool { return r.Layers[i].Layer < r.Layers[j].Layer })
}
func Telemetry(s fastpath.Snapshot, inventory, selected []string, scoped bool) (map[string]any, error) {
	known := map[string]bool{}
	for _, n := range inventory {
		known[n] = true
	}
	names := inventory
	if scoped {
		names = selected
	}
	byNet := map[string]*Stats{}
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
		length, ok := TraceLength(p)
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
		rows := []*Stats{}
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
		result["netLengthDistribution"] = Quantiles(lengths)
	}
	return result, nil
}
