package fastpath

import (
	"fmt"
	"math"
)

type PairTransition struct {
	End        string  `json:"end"`
	To         int     `json:"to_layer"`
	Diameter   float64 `json:"diameter"`
	Hole       float64 `json:"hole"`
	Separation float64 `json:"separation"`
}
type PairRequest struct {
	Transitions []PairTransition `json:"transitions,omitempty"`
	Base        string           `json:"base_revision"`
	Positive    string           `json:"positive_net"`
	Negative    string           `json:"negative_net"`
	Layer       int              `json:"layer"`
	Width       float64          `json:"width"`
	Gap         float64          `json:"gap"`
	Centerline  []Point          `json:"centerline"`
}
type PairResult struct {
	Plan              Plan    `json:"plan"`
	PositiveLength    float64 `json:"positive_length"`
	NegativeLength    float64 `json:"negative_length"`
	Mismatch          float64 `json:"mismatch"`
	MinimumGap        float64 `json:"minimum_gap"`
	RequiresPreflight bool    `json:"requires_preflight"`
}

// Pair offsets the supplied polyline. Corners are intersections of offset
// straight lines; reversals, acute bends, collapsing legs and gap violations
// are rejected. No obstacle search, path repair, layer choice or native write.
func Pair(s Snapshot, q PairRequest) (PairResult, error) {
	fail := func(msg string) (PairResult, error) { return PairResult{}, fmt.Errorf("PAIR_REJECTED: %s", msg) }
	if q.Base == "" || q.Base != s.Revision {
		return fail("STALE_REVISION")
	}
	if q.Positive == "" || q.Negative == "" || q.Positive == q.Negative || !has(s.Layers, q.Layer) {
		return fail("explicit distinct nets and copper layer required")
	}
	if !finite(q.Width) || !finite(q.Gap) || q.Width <= 0 || q.Gap <= 0 || len(q.Centerline) < 2 || len(q.Centerline) > 128 {
		return fail("invalid geometry bounds")
	}
	directions := []Point{}
	for i, p := range q.Centerline {
		if !finite(p[0]) || !finite(p[1]) {
			return fail("nonfinite centerline")
		}
		if i == 0 {
			continue
		}
		a := q.Centerline[i-1]
		d := Point{p[0] - a[0], p[1] - a[1]}
		length := math.Hypot(d[0], d[1])
		if length < 1e-7 {
			return fail("zero length leg")
		}
		directions = append(directions, Point{d[0] / length, d[1] / length})
	}
	paths := [2][]Point{}
	for side := 0; side < 2; side++ {
		offset := (q.Width + q.Gap) / 2
		if side == 1 {
			offset = -offset
		}
		for i, p := range q.Centerline {
			d := directions[0]
			if i > 0 {
				d = directions[i-1]
			}
			n := Point{-d[1], d[0]}
			if i > 0 && i < len(q.Centerline)-1 {
				next := directions[i]
				dot := d[0]*next[0] + d[1]*next[1]
				if dot < -1e-8 {
					return fail("turn sharper than 90 degrees")
				}
				n = Point{(n[0] - next[1]) / (1 + dot), (n[1] + next[0]) / (1 + dot)}
			}
			paths[side] = append(paths[side], Point{p[0] + offset*n[0], p[1] + offset*n[1]})
		}
		for i := 1; i < len(paths[side]); i++ {
			a, b := paths[side][i-1], paths[side][i]
			d := directions[i-1]
			if (b[0]-a[0])*d[0]+(b[1]-a[1])*d[1] <= 1e-7 {
				return fail("offset collapses a centerline leg")
			}
			for j := i + 2; j < len(paths[side]); j++ {
				if segDist(a, b, paths[side][j-1], paths[side][j])-q.Width < q.Gap-1e-7 {
					return fail("nonadjacent same-side spacing")
				}
			}
		}
	}
	minimum := math.Inf(1)
	for i := 1; i < len(paths[0]); i++ {
		for j := 1; j < len(paths[1]); j++ {
			minimum = math.Min(minimum, segDist(paths[0][i-1], paths[0][i], paths[1][j-1], paths[1][j])-q.Width)
		}
	}
	if minimum+1e-7 < q.Gap {
		return fail("requested pair gap cannot be preserved")
	}
	length := func(points []Point) float64 {
		v := 0.0
		for i := 1; i < len(points); i++ {
			v += math.Hypot(points[i][0]-points[i-1][0], points[i][1]-points[i-1][1])
		}
		return v
	}
	vias := []Via{}
	seen := map[string]bool{}
	if len(q.Transitions) > 2 {
		return fail("at most one transition per endpoint")
	}
	for _, tr := range q.Transitions {
		if (tr.End != "start" && tr.End != "end") || seen[tr.End] || tr.To == q.Layer || !has(s.Layers, tr.To) || !finite(tr.Diameter) || !finite(tr.Hole) || !finite(tr.Separation) || tr.Hole <= 0 || tr.Diameter <= tr.Hole || tr.Separation < tr.Diameter+q.Gap || tr.Separation < q.Width+q.Gap {
			return fail("invalid explicit endpoint transition")
		}
		seen[tr.End] = true
		index := 0
		direction := directions[0]
		if tr.End == "end" {
			index = len(q.Centerline) - 1
			direction = directions[len(directions)-1]
		}
		center := q.Centerline[index]
		for side := 0; side < 2; side++ {
			sign := 1.0
			if side == 1 {
				sign = -1
			}
			point := Point{center[0] - direction[1]*tr.Separation/2*sign, center[1] + direction[0]*tr.Separation/2*sign}
			net := q.Positive
			if side == 1 {
				net = q.Negative
			}
			vias = append(vias, Via{Net: net, X: point[0], Y: point[1], Diameter: tr.Diameter, Hole: tr.Hole, From: q.Layer, To: tr.To})
			if tr.Separation > q.Width+q.Gap {
				if tr.End == "start" {
					paths[side] = append([]Point{point}, paths[side]...)
				} else {
					paths[side] = append(paths[side], point)
				}
			}
		}
	}
	// Explicit endpoint fanout must still preserve the requested gap against
	// all opposite-net segments and vias. No geometry repair is attempted.
	for i := 1; i < len(paths[0]); i++ {
		for j := 1; j < len(paths[1]); j++ {
			minimum = math.Min(minimum, segDist(paths[0][i-1], paths[0][i], paths[1][j-1], paths[1][j])-q.Width)
		}
	}
	for _, v := range vias {
		opposite := paths[1]
		if v.Net == q.Negative {
			opposite = paths[0]
		}
		for i := 1; i < len(opposite); i++ {
			minimum = math.Min(minimum, segDist(Point{v.X, v.Y}, Point{v.X, v.Y}, opposite[i-1], opposite[i])-v.Diameter/2-q.Width/2)
		}
	}
	for i, a := range vias {
		for _, b := range vias[i+1:] {
			if a.Net != b.Net {
				minimum = math.Min(minimum, math.Hypot(a.X-b.X, a.Y-b.Y)-(a.Diameter+b.Diameter)/2)
			}
		}
	}
	if minimum+1e-7 < q.Gap {
		return fail("explicit transition cannot preserve gap")
	}
	p, n := length(paths[0]), length(paths[1])
	return PairResult{Plan: Plan{Base: q.Base, Routes: []Route{{Net: q.Positive, Layer: q.Layer, Width: q.Width, Points: paths[0]}, {Net: q.Negative, Layer: q.Layer, Width: q.Width, Points: paths[1]}}, Vias: vias}, PositiveLength: p, NegativeLength: n, Mismatch: math.Abs(p - n), MinimumGap: minimum, RequiresPreflight: true}, nil
}
