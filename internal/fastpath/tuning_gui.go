package fastpath

import (
	"fmt"
	"math"
)

// GUITuningRequest mirrors EasyEDA's equal-length settings. The caller supplies
// a fixed corridor and selected span; no obstacle, layer or corridor search.
type GUITuningRequest struct {
	Base          string  `json:"base_revision"`
	Net           string  `json:"net"`
	SpanID        string  `json:"span_id"`
	Corridor      Box     `json:"corridor"`
	TargetMode    string  `json:"target_mode"`
	TargetLength  float64 `json:"target_length,omitempty"`
	Corner        string  `json:"corner"`
	Side          string  `json:"side"`
	SpacingW      float64 `json:"spacing_w"`
	MinAmplitudeH float64 `json:"min_amplitude_h"`
}

type GUITuningResult struct {
	Plan              Plan    `json:"plan"`
	CurrentLength     float64 `json:"current_length"`
	TargetLength      float64 `json:"target_length"`
	AddedLength       float64 `json:"added_length"`
	AchievedLength    float64 `json:"achieved_length"`
	Residual          float64 `json:"residual"`
	LengthTolerance   float64 `json:"length_tolerance"`
	Turns             int     `json:"turns"`
	Capacity          float64 `json:"capacity_added_length"`
	Corner            string  `json:"corner"`
	Side              string  `json:"side"`
	SpacingW          float64 `json:"spacing_w"`
	MinAmplitudeH     float64 `json:"min_amplitude_h"`
	ActualAmplitude   float64 `json:"actual_amplitude"`
	RequiresPreflight bool    `json:"requires_preflight"`
}

// TunePayload keeps old added-length payloads as a compatibility path, not a
// second advertised product vocabulary. Mixed contracts are rejected.
func TunePayload(s Snapshot, payload map[string]any) (any, error) {
	gui := false
	for _, k := range []string{"target_mode", "target_length", "corner", "spacing_w", "min_amplitude_h"} {
		if _, ok := payload[k]; ok {
			gui = true
		}
	}
	if !gui {
		var q TuningRequest
		if e := Decode(payload, &q); e != nil {
			return nil, e
		}
		return Tune(s, q)
	}
	for _, k := range []string{"style", "radius", "min_radius", "pitch", "max_amplitude", "target_added_length", "min_spacing"} {
		if _, ok := payload[k]; ok {
			return nil, fmt.Errorf("TUNING_REJECTED: mixed GUI/legacy field %s", k)
		}
	}
	var q GUITuningRequest
	if e := Decode(payload, &q); e != nil {
		return nil, e
	}
	return TuneGUI(s, q)
}

func TuneGUI(s Snapshot, q GUITuningRequest) (GUITuningResult, error) {
	fail := func(reason string) (GUITuningResult, error) {
		return GUITuningResult{}, fmt.Errorf("TUNING_REJECTED: %s", reason)
	}
	if q.Base == "" || q.Base != s.Revision {
		return fail("STALE_REVISION")
	}
	if q.TargetMode == "follow_rule" {
		// Native rules expose ranges and group assignments, not a verified unique
		// final target. Never silently choose min/max, a peer net, or a guessed rule.
		return fail("RULE_TARGET_UNRESOLVED: current Host rule projection cannot prove one final length; use specified_length after engineering review")
	}
	if q.TargetMode != "specified_length" {
		return fail("target_mode must be specified_length or follow_rule")
	}
	if q.Corner != "line_45" && q.Corner != "line_90" && q.Corner != "arc_90" {
		return fail("unsupported corner")
	}
	if q.Side != "single" && q.Side != "bilateral" {
		return fail("side must be single or bilateral")
	}
	for _, v := range []float64{q.TargetLength, q.SpacingW, q.MinAmplitudeH} {
		if !finite(v) || v <= 0 {
			return fail("positive finite target_length/W/H required")
		}
	}
	span, e := tuningSpan(s, TuningRequest{Base: q.Base, Net: q.Net, SpanID: q.SpanID, Corridor: q.Corridor, Side: 1})
	if e != nil {
		return GUITuningResult{}, e
	}
	rules := s.RuleProfile
	if rules == nil {
		rules = LiveProfile(s.Rules)
	}
	if rules == nil || !finite(rules.Clearance) || rules.Clearance <= 0 {
		return fail("live tuning spacing unavailable")
	}
	if q.SpacingW < span.Width+rules.Clearance || (q.Corner == "line_45" && q.SpacingW < 2*span.Width) {
		return fail("W violates live independent same-net spacing or corner coverage")
	}
	current := 0.0
	for _, p := range s.Traces {
		if p.Net != q.Net {
			continue
		}
		if p.Unsupported {
			return fail("net copper length incomplete")
		}
		switch p.Kind {
		case "arc":
			if !finite(p.ArcLength) || p.ArcLength <= 0 {
				return fail("exact arc length unavailable")
			}
			current += p.ArcLength
		case "trace":
			if len(p.Points) < 2 {
				return fail("trace length unavailable")
			}
			for i := 1; i < len(p.Points); i++ {
				a, b := p.Points[i-1], p.Points[i]
				v := math.Hypot(b[0]-a[0], b[1]-a[1])
				if !finite(v) {
					return fail("trace length invalid")
				}
				current += v
			}
		default:
			return fail("unsupported net copper centerline")
		}
	}
	delta := q.TargetLength - current
	if delta <= 0 {
		return fail("target must exceed current planar copper length; shortening is not tuning")
	}
	a, b := span.Points[0], span.Points[1]
	length := math.Hypot(b[0]-a[0], b[1]-a[1])
	u := Point{(b[0] - a[0]) / length, (b[1] - a[1]) / length}
	normal := Point{-u[1], u[0]}
	bound := func(sign float64) float64 {
		h := math.Inf(1)
		for axis := 0; axis < 2; axis++ {
			v := normal[axis] * sign
			if v > 0 {
				h = math.Min(h, q.Corridor[axis+2]-span.Width/2-a[axis])
			}
			if v < 0 {
				h = math.Min(h, a[axis]-q.Corridor[axis]-span.Width/2)
			}
		}
		return h
	}
	positive, negative := bound(1), bound(-1)
	direction := 1.0
	limit := positive
	minimum := math.Max(q.MinAmplitudeH, span.Width+rules.Clearance)
	if q.Corner == "line_45" {
		minimum = math.Max(minimum, math.Sqrt2*span.Width)
	}
	if q.Side == "bilateral" {
		limit = math.Min(positive, negative)
	} else {
		// The fixed corridor replaces the GUI mouse gesture. Exactly one side must
		// accommodate H; no hidden choice when both directions are feasible.
		if positive >= minimum && negative >= minimum {
			return fail("single corridor must select exactly one excursion side")
		}
		if negative >= minimum {
			direction = -1
			limit = negative
		}
	}
	if limit < minimum {
		return fail("corridor cannot satisfy H and live spacing")
	}
	if q.Corner == "arc_90" {
		onGrid := func(v float64) bool { return math.Abs(v*10-math.Round(v*10)) < 1e-7 }
		for _, v := range []float64{a[0], a[1], b[0], b[1], q.SpacingW / 2} {
			if !onGrid(v) {
				return fail("arc_90 requires endpoints on 0.1mil and W on 0.2mil SDK lattice")
			}
		}
		minimum = math.Ceil(minimum*5-1e-8) / 5
		limit = math.Floor(limit*5+1e-8) / 5
		if minimum > limit {
			return fail("arc SDK lattice exceeds corridor")
		}
	}
	point := func(x, y float64) Point {
		return Point{a[0] + u[0]*x + normal[0]*direction*y, a[1] + u[1]*x + normal[1]*direction*y}
	}
	fits := func(p Point) bool {
		r := span.Width / 2
		return p[0]-r >= q.Corridor[0]-1e-7 && p[1]-r >= q.Corridor[1]-1e-7 && p[0]+r <= q.Corridor[2]+1e-7 && p[1]+r <= q.Corridor[3]+1e-7
	}
	if !fits(a) || !fits(b) {
		return fail("span outside corridor")
	}
	result := GUITuningResult{CurrentLength: current, TargetLength: q.TargetLength, Corner: q.Corner, Side: q.Side, SpacingW: q.SpacingW, MinAmplitudeH: q.MinAmplitudeH, RequiresPreflight: true}
	found := false
	// At most 64 lobes and 512 explicit operations; this is a one-dimensional
	// bounded length solve on a fixed template, not path search.
	for n := 1; n <= MaxOperations/8; n++ {
		build := func(h float64) ([]Route, float64, bool) {
			return guiTuningGeometry(*span, q, n, h, length, point, fits)
		}
		_, hi, ok := build(limit)
		if !ok {
			continue
		}
		result.Capacity = math.Max(result.Capacity, hi)
		_, lo, ok := build(minimum)
		if !ok || found || delta < lo-1e-7 || delta > hi+1e-7 {
			continue
		}
		low, high := minimum, limit
		for i := 0; i < 60; i++ {
			mid := (low + high) / 2
			_, v, valid := build(mid)
			if !valid {
				high = mid
				continue
			}
			if v < delta {
				low = mid
			} else {
				high = mid
			}
		}
		h := (low + high) / 2
		tolerance := 0.001 * float64(n) // includes bounded 4-decimal Host line persistence per lobe
		if q.Corner == "arc_90" {
			h = math.Max(minimum, math.Min(limit, math.Round(h*5)/5))
			tolerance = 0.2 * float64(n)
		}
		routes, added, valid := build(h)
		if !valid || math.Abs(delta-added) > tolerance+1e-7 {
			continue
		}
		result.Plan = Plan{Base: q.Base, Routes: routes, Vias: []Via{}, DeleteIDs: []string{q.SpanID}}
		if _, err := HelperOperations(result.Plan); err != nil {
			continue
		}
		result.AddedLength = added
		result.AchievedLength = current + added
		result.Residual = q.TargetLength - result.AchievedLength
		result.LengthTolerance = tolerance
		result.Turns = n
		result.ActualAmplitude = h
		found = true
	}
	if !found {
		return fail("target cannot satisfy W/H, SDK lattice and fixed corridor capacity")
	}
	return result, nil
}

// Canonical EasyEDA templates: W is centerline spacing; line45 chamfer offset
// is width/sqrt(2); arc90 radius is min(H_actual,W)/2. Single repeats on one
// side; bilateral alternates with shared straight return legs. Start/end caps
// retain the baseline tangent. No native/private implementation is invoked.
func guiTuningGeometry(span Primitive, q GUITuningRequest, n int, h, length float64, point func(float64, float64) Point, fits func(Point) bool) ([]Route, float64, bool) {
	routes := []Route{}
	cursor := Point{0, 0}
	valid := true
	emit := func(end Point, angle float64) {
		if math.Hypot(end[0]-cursor[0], end[1]-cursor[1]) < 1e-8 {
			return
		}
		p1, p2 := point(cursor[0], cursor[1]), point(end[0], end[1])
		if q.Corner == "arc_90" {
			for axis := 0; axis < 2; axis++ {
				p1[axis] = math.Round(p1[axis]*10) / 10
				p2[axis] = math.Round(p2[axis]*10) / 10
			}
		}
		if !fits(p1) || !fits(p2) {
			valid = false
		}
		// Coordinates are transformed by a possible reflection; preserve sweep.
		determinant := (point(1, 0)[0]-point(0, 0)[0])*(point(0, 1)[1]-point(0, 0)[1]) - (point(1, 0)[1]-point(0, 0)[1])*(point(0, 1)[0]-point(0, 0)[0])
		angle *= determinant
		if angle == 0 && len(routes) > 0 && routes[len(routes)-1].ArcAngle == 0 {
			last := &routes[len(routes)-1]
			a, b := last.Points[0], last.Points[1]
			if math.Abs(cross(a, b, p2)) < 1e-7 && (b[0]-a[0])*(p2[0]-b[0])+(b[1]-a[1])*(p2[1]-b[1]) > 0 {
				last.Points[1] = p2
				cursor = end
				return
			}
		}
		routes = append(routes, Route{Net: span.Net, Layer: span.Layer, Width: span.Width, Points: []Point{p1, p2}, ArcAngle: angle})
		cursor = end
	}
	w := q.SpacingW
	for i := 0; i < n; i++ {
		sign := 1.0
		if q.Side == "bilateral" && i%2 == 1 {
			sign = -1
		}
		x := cursor[0]
		leftFull := q.Side == "single" || i == 0
		rightFull := q.Side == "single" || i == n-1
		if q.Corner == "line_90" {
			emit(Point{x, sign * h}, 0)
			emit(Point{x + w, sign * h}, 0)
			emit(Point{x + w, 0}, 0)
		} else {
			d := span.Width / math.Sqrt2
			angle := 0.0
			if q.Corner == "arc_90" {
				d = math.Min(h, w) / 2
				angle = 90
			}
			if h < 2*d-1e-8 || w < 2*d-1e-8 {
				return nil, 0, false
			}
			if leftFull {
				emit(Point{x + d, sign * d}, sign*angle)
				emit(Point{x + d, sign * (h - d)}, 0)
				emit(Point{x + 2*d, sign * h}, -sign*angle)
			} else {
				emit(Point{x, sign * (h - d)}, 0)
				emit(Point{x + d, sign * h}, -sign*angle)
			}
			x = cursor[0] + w - 2*d
			emit(Point{x, sign * h}, 0)
			emit(Point{x + d, sign * (h - d)}, -sign*angle)
			if rightFull {
				emit(Point{x + d, sign * d}, 0)
				emit(Point{x + 2*d, 0}, sign*angle)
			} else {
				emit(Point{x + d, 0}, 0)
			}
		}
		if q.Side == "single" && i < n-1 {
			gap := w
			if q.Corner == "line_45" {
				gap -= math.Sqrt2 * span.Width
			}
			if q.Corner == "arc_90" {
				gap -= math.Min(h, w)
			}
			emit(Point{cursor[0] + gap, 0}, 0)
		}
	}
	if cursor[0] > length+1e-7 {
		return nil, 0, false
	}
	emit(Point{length, 0}, 0)
	if !valid || len(routes)+1 > MaxOperations {
		return nil, 0, false
	}
	actual := 0.0
	for _, r := range routes {
		a, b := r.Points[0], r.Points[1]
		chord := math.Hypot(b[0]-a[0], b[1]-a[1])
		if r.ArcAngle != 0 {
			actual += chord / math.Sqrt2 * math.Pi / 2
		} else {
			actual += chord
		}
	}
	return routes, actual - length, true
}
