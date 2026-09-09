package fastpath

import "math"

// Only signed quarter-circle explicit writes are supported. Projection is used
// for conservative clearance; measurement always uses the exact circular length.
const arcProjectionError = 0.05

func arcPrimitive(o Operation) Primitive {
	a, b := o.Points[0], o.Points[1]
	theta := o.ArcAngle * math.Pi / 180
	cx := (a[0]+b[0])/2 - (b[1]-a[1])/(2*math.Tan(theta/2))
	cy := (a[1]+b[1])/2 + (b[0]-a[0])/(2*math.Tan(theta/2))
	r := math.Hypot(a[0]-cx, a[1]-cy)
	count := int(math.Ceil(math.Abs(theta) / (2 * math.Acos(math.Max(-1, 1-arcProjectionError/r)))))
	if count < 1 {
		count = 1
	}
	if count > 4096 {
		return Primitive{Kind: "arc", Unsupported: true}
	}
	pts := []Point{a}
	start := math.Atan2(a[1]-cy, a[0]-cx)
	for i := 1; i < count; i++ {
		angle := start + theta*float64(i)/float64(count)
		pts = append(pts, Point{cx + r*math.Cos(angle), cy + r*math.Sin(angle)})
	}
	pts = append(pts, b)
	return Primitive{Kind: "arc", Net: o.Net, Layer: o.Layer, Width: o.Width, Points: pts, ArcLength: r * math.Abs(theta), ProjectionError: arcProjectionError}
}
