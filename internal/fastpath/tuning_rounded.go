package fastpath

import (
	"fmt"
	"math"
)

func tuneRounded(span Primitive, q TuningRequest, length, amplitude float64, capacityTurns int, point func(float64, float64) Point, fits func(Point) bool) (TuningResult, error) {
	fail := func(s string) (TuningResult, error) { return TuningResult{}, fmt.Errorf("TUNING_REJECTED: %s", s) }
	r := q.Radius
	if !finite(r) || r <= span.Width/2 || !finite(q.MinRadius) || q.MinRadius < 0 || r < q.MinRadius {
		return fail("explicit radius > half width and >= min_radius required")
	}
	// Fillets lie within radius of the original legs. This conservative spacing
	// reserve covers nonlocal same-net legs without exempting them as same-net.
	// EDA 3.2 SDK Arc.get/getAll rounds endpoints to 0.1 mil. Plan shared
	// line/arc joints on that lattice, never loosen apply readback tolerance.
	const grid = 0.1
	onGrid := func(v float64) bool { return math.Abs(v*10-math.Round(v*10)) < 1e-8 }
	for _, v := range []float64{r, q.Pitch, span.Points[0][0], span.Points[0][1], span.Points[1][0], span.Points[1][1]} {
		if !onGrid(v) {
			return fail("rounded endpoints, pitch and radius require 0.1mil SDK lattice")
		}
	}
	amplitude = math.Floor(amplitude*10+1e-8) / 10
	minimum := math.Ceil((span.Width+q.MinSpacing+2*r)*10-1e-8) / 10
	if q.Pitch < minimum || amplitude < minimum {
		return fail("radius/spacing exceeds pitch or corridor capacity")
	}
	capacityTurns = min(capacityTurns, MaxOperations/8)
	loss := (2 - math.Pi/2) * r
	capacity := 2*float64(capacityTurns)*amplitude - float64(4*capacityTurns-1)*loss
	if capacityTurns < 1 || q.AddedLength > capacity+1e-7 {
		return fail("target exceeds fixed corridor capacity")
	}
	turns := 0
	var heights []float64
	for n := 1; n <= capacityTurns; n++ {
		height := (q.AddedLength + float64(4*n-1)*loss) / (2 * float64(n))
		if height <= amplitude+1e-9 && height >= minimum {
			turns = n
			// Distribute quantized total height, rather than rounding each lobe
			// independently: total added-length error stays <= one grid step.
			total := int(math.Round(height * float64(n) * 10))
			base, extra := total/n, total%n
			heights = make([]float64, n)
			for i := range heights {
				units := base
				if i < extra {
					units++
				}
				heights[i] = float64(units) / 10
			}
			if heights[0] > amplitude+1e-9 || heights[n-1] < minimum-1e-9 {
				turns = 0
				continue
			}
			break
		}
	}
	if turns == 0 {
		return fail("target cannot satisfy radius/spacing in fixed corridor")
	}
	pts := []Point{point(0, 0)}
	for i := 0; i < turns; i++ {
		x := float64(2*i) * q.Pitch
		h := heights[i]
		pts = append(pts, point(x, h), point(x+q.Pitch, h), point(x+q.Pitch, 0))
		if i < turns-1 {
			pts = append(pts, point(x+2*q.Pitch, 0))
		}
	}
	pts = append(pts, point(length, 0))
	snap := func(p Point) Point { return Point{math.Round(p[0]*10) / 10, math.Round(p[1]*10) / 10} }
	for i := range pts {
		pts[i] = snap(pts[i])
	}
	routes := []Route{}
	cursor := pts[0]
	actual := 0.0
	line := func(a, b Point) {
		if math.Hypot(b[0]-a[0], b[1]-a[1]) > 1e-9 {
			routes = append(routes, Route{Net: q.Net, Layer: span.Layer, Width: span.Width, Points: []Point{a, b}})
			actual += math.Hypot(b[0]-a[0], b[1]-a[1])
		}
	}
	for i := 1; i < len(pts)-1; i++ {
		a, b, c := pts[i-1], pts[i], pts[i+1]
		l1 := math.Hypot(b[0]-a[0], b[1]-a[1])
		l2 := math.Hypot(c[0]-b[0], c[1]-b[1])
		if l1 < 2*r || l2 < 2*r {
			return fail("adjacent fillets overlap")
		}
		u := Point{(b[0] - a[0]) / l1, (b[1] - a[1]) / l1}
		v := Point{(c[0] - b[0]) / l2, (c[1] - b[1]) / l2}
		start := snap(Point{b[0] - u[0]*r, b[1] - u[1]*r})
		end := snap(Point{b[0] + v[0]*r, b[1] + v[1]*r})
		if !fits(b) || !fits(start) || !fits(end) {
			return fail("generated geometry outside corridor")
		}
		line(cursor, start)
		angle := math.Copysign(90, u[0]*v[1]-u[1]*v[0])
		routes = append(routes, Route{Net: q.Net, Layer: span.Layer, Width: span.Width, Points: []Point{start, end}, ArcAngle: angle})
		actual += r * math.Pi / 2
		cursor = end
	}
	line(cursor, pts[len(pts)-1])
	plan := Plan{Base: q.Base, Routes: routes, Vias: []Via{}, DeleteIDs: []string{q.SpanID}}
	if _, err := HelperOperations(plan); err != nil {
		return fail(err.Error())
	}
	added := actual - length
	if math.Abs(added-q.AddedLength) > grid+1e-7 {
		return fail("exact length residual exceeds tolerance")
	}
	return TuningResult{CoordinateResolution: grid, LengthTolerance: grid, Plan: plan, AddedLength: added, Residual: q.AddedLength - added, Turns: turns, Capacity: capacity, Style: "rounded", Radius: r, RequiresPreflight: true}, nil
}
