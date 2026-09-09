package fastpath

import (
	"fmt"
	"math"
)

// TuningRequest selects one existing straight span. It does not search for a
// corridor, target, layer or topology. Dimensions and added length are in mil.
type TuningRequest struct {
	Style        string  `json:"style,omitempty"`
	Radius       float64 `json:"radius,omitempty"`
	MinRadius    float64 `json:"min_radius,omitempty"`
	Base         string  `json:"base_revision"`
	Net          string  `json:"net"`
	SpanID       string  `json:"span_id"`
	Corridor     Box     `json:"corridor"`
	AddedLength  float64 `json:"target_added_length"`
	Pitch        float64 `json:"pitch"`
	MinSpacing   float64 `json:"min_spacing"`
	MaxAmplitude float64 `json:"max_amplitude"`
	Side         int     `json:"side"`
}

type TuningResult struct {
	CoordinateResolution float64 `json:"coordinate_resolution,omitempty"`
	LengthTolerance      float64 `json:"length_tolerance,omitempty"`
	Radius               float64 `json:"radius,omitempty"`
	Plan                 Plan    `json:"plan"`
	AddedLength          float64 `json:"added_length"`
	Residual             float64 `json:"residual"`
	Turns                int     `json:"turns"`
	Capacity             float64 `json:"capacity_added_length"`
	Style                string  `json:"style"`
	RequiresPreflight    bool    `json:"requires_preflight"`
}

// Tune generates rectangular or rounded lobes on an explicitly selected straight trace.
// Non-adjacent segments are checked separately even though they share a net.
func Tune(s Snapshot, q TuningRequest) (TuningResult, error) {
	fail := func(reason string) (TuningResult, error) {
		return TuningResult{}, fmt.Errorf("TUNING_REJECTED: %s", reason)
	}
	if q.Style == "" {
		q.Style = "rectangular"
	}
	if q.Style != "rectangular" && q.Style != "rounded" {
		return fail("unknown style")
	}
	if q.Style == "rectangular" && (q.Radius != 0 || q.MinRadius != 0) {
		return fail("radius requires rounded style")
	}
	for _, v := range []float64{q.AddedLength, q.Pitch, q.MinSpacing, q.MaxAmplitude} {
		if !finite(v) || v <= 0 {
			return fail("positive finite target/pitch/spacing/amplitude required")
		}
	}
	span, err := tuningSpan(s, q)
	if err != nil {
		return TuningResult{}, err
	}
	a, b := span.Points[0], span.Points[1]
	length := math.Hypot(b[0]-a[0], b[1]-a[1])
	if q.Pitch-span.Width < q.MinSpacing {
		return fail("pitch violates same-net tuning spacing")
	}
	u := Point{(b[0] - a[0]) / length, (b[1] - a[1]) / length}
	n := Point{-u[1] * float64(q.Side), u[0] * float64(q.Side)}
	point := func(x, y float64) Point { return Point{a[0] + u[0]*x + n[0]*y, a[1] + u[1]*x + n[1]*y} }
	fits := func(p Point) bool {
		r := span.Width / 2
		return p[0]-r >= q.Corridor[0] && p[1]-r >= q.Corridor[1] && p[0]+r <= q.Corridor[2] && p[1]+r <= q.Corridor[3]
	}
	if !fits(a) || !fits(b) {
		return fail("span outside fixed corridor")
	}
	amplitude := q.MaxAmplitude
	for axis := 0; axis < 2; axis++ {
		if n[axis] > 0 {
			amplitude = math.Min(amplitude, q.Corridor[axis+2]-span.Width/2-a[axis])
		}
		if n[axis] < 0 {
			amplitude = math.Min(amplitude, a[axis]-q.Corridor[axis]-span.Width/2)
		}
	}
	capacityTurns := int(math.Floor(length / (2 * q.Pitch)))
	if capacityTurns < 1 || amplitude <= 0 {
		return fail("corridor has no capacity")
	}
	if q.Style == "rounded" {
		return tuneRounded(*span, q, length, amplitude, capacityTurns, point, fits)
	}
	turns := int(math.Ceil(q.AddedLength / (2 * amplitude)))
	if turns > capacityTurns || turns*4+2 > MaxOperations {
		return fail("target exceeds fixed corridor or operation capacity")
	}
	height := q.AddedLength / (2 * float64(turns))
	if height < span.Width+q.MinSpacing {
		return fail("target too small for independent tuning spacing")
	}
	points := []Point{a}
	for i := 0; i < turns; i++ {
		x := float64(2*i) * q.Pitch
		for _, p := range []Point{point(x, height), point(x+q.Pitch, height), point(x+q.Pitch, 0), point(x+2*q.Pitch, 0)} {
			if !fits(p) {
				return fail("generated geometry exceeds fixed corridor")
			}
			points = append(points, p)
		}
	}
	if points[len(points)-1] != b {
		points = append(points, b)
	}
	// Native Host merges adjacent collinear primitives and changes their IDs.
	// Emit maximal straight spans from our own generated pattern so readback
	// can retain the original strict per-operation ID/geometry contract.
	clean := []Point{}
	for _, point := range points {
		for len(clean) >= 2 {
			a, b := clean[len(clean)-2], clean[len(clean)-1]
			if math.Abs(cross(a, b, point)) > 1e-9 || (b[0]-a[0])*(point[0]-b[0])+(b[1]-a[1])*(point[1]-b[1]) <= 0 {
				break
			}
			clean = clean[:len(clean)-1]
		}
		clean = append(clean, point)
	}
	points = clean
	for i := 1; i < len(points); i++ {
		for j := i + 2; j < len(points); j++ {
			if segDist(points[i-1], points[i], points[j-1], points[j])-span.Width+1e-7 < q.MinSpacing {
				return fail("non-adjacent same-net segment spacing")
			}
		}
	}
	actual := 0.0
	for i := 1; i < len(points); i++ {
		actual += math.Hypot(points[i][0]-points[i-1][0], points[i][1]-points[i-1][1])
	}
	return TuningResult{Plan: Plan{Base: q.Base, Routes: []Route{{Net: q.Net, Layer: span.Layer, Width: span.Width, Points: points}}, Vias: []Via{}, DeleteIDs: []string{q.SpanID}}, AddedLength: actual - length, Residual: q.AddedLength - (actual - length), Turns: turns, Capacity: 2 * float64(capacityTurns) * amplitude, Style: "rectangular", RequiresPreflight: true}, nil
}

// Shared selection/topology guard for legacy and GUI tuning contracts.
func tuningSpan(s Snapshot, q TuningRequest) (*Primitive, error) {
	if q.Base == "" || q.Base != s.Revision {
		return nil, fmt.Errorf("TUNING_REJECTED: %s", "STALE_REVISION")
	}
	if q.Net == "" || q.SpanID == "" || !ValidBox(&q.Corridor) || (q.Side != 1 && q.Side != -1) {
		return nil, fmt.Errorf("TUNING_REJECTED: %s", "explicit net, span, corridor and side (+1/-1) required")
	}
	var span *Primitive
	for i := range s.Traces {
		if s.Traces[i].ID == q.SpanID {
			if span != nil {
				return nil, fmt.Errorf("TUNING_REJECTED: %s", "ambiguous span")
			}
			span = &s.Traces[i]
		}
	}
	if span == nil || span.Kind != "trace" || span.Unsupported || span.Locked || span.Net != q.Net || len(span.Points) != 2 || span.Width <= 0 {
		return nil, fmt.Errorf("TUNING_REJECTED: %s", "span must be an unlocked supported trace on the selected net")
	}
	a, b := span.Points[0], span.Points[1]
	length := math.Hypot(b[0]-a[0], b[1]-a[1])
	if length <= 0 {
		return nil, fmt.Errorf("TUNING_REJECTED: %s", "zero length span")
	}
	// A span with an interior same-net attachment cannot be replaced without
	// an explicit topology decision. End-point attachments remain unchanged.
	obstacles := append(append(append([]Primitive{}, s.Traces...), s.Pads...), s.Vias...)
	for _, o := range obstacles {
		if o.ID == span.ID || o.Net != q.Net || !sameLayer(o.Layer, span.Layer) {
			continue
		}
		if o.Unsupported {
			return nil, fmt.Errorf("TUNING_REJECTED: %s", "same-net attachment geometry unavailable")
		}
		if clearance(*span, o) > 1e-7 {
			continue
		}
		if o.Kind == "arc" {
			return nil, fmt.Errorf("TUNING_REJECTED: %s", "arc attachment to selected span requires explicit topology review")
		}
		if o.Kind == "trace" && len(o.Points) == 2 {
			c, d := o.Points[0], o.Points[1]
			for _, pt := range o.Points {
				t := ((pt[0]-a[0])*(b[0]-a[0]) + (pt[1]-a[1])*(b[1]-a[1])) / (length * length)
				if t > 1e-7 && t < 1-1e-7 && pointSeg(pt, a, b) <= span.Width/2+o.Width/2 {
					return nil, fmt.Errorf("TUNING_REJECTED: %s", "interior branch attachment")
				}
			}
			denominator := (b[0]-a[0])*(d[1]-c[1]) - (b[1]-a[1])*(d[0]-c[0])
			if math.Abs(denominator) > 1e-9 {
				t := ((c[0]-a[0])*(d[1]-c[1]) - (c[1]-a[1])*(d[0]-c[0])) / denominator
				if t > 1e-7 && t < 1-1e-7 {
					return nil, fmt.Errorf("TUNING_REJECTED: %s", "interior branch attachment")
				}
			}
		} else {
			t := ((o.X-a[0])*(b[0]-a[0]) + (o.Y-a[1])*(b[1]-a[1])) / (length * length)
			if t > 1e-7 && t < 1-1e-7 {
				return nil, fmt.Errorf("TUNING_REJECTED: %s", "interior pad/via attachment")
			}
		}
	}
	// V1 intentionally excludes diagonal corridors: no polygon clipping kernel.
	if a[0] != b[0] && a[1] != b[1] {
		return nil, fmt.Errorf("TUNING_REJECTED: %s", "only horizontal/vertical spans supported")
	}
	return span, nil
}
