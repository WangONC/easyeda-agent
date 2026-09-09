package fastpath

import (
	"math"
	"testing"
)

func roundedFixture() (Snapshot, TuningRequest) {
	return Snapshot{Revision: "r", Layers: []int{1, 2}, Traces: []Primitive{{ID: "seed", Kind: "trace", Net: "N", Layer: 1, Width: 6, Points: []Point{{0, 0}, {400, 0}}}}}, TuningRequest{Base: "r", Net: "N", SpanID: "seed", Corridor: Box{-10, -10, 410, 110}, AddedLength: 200, Pitch: 40, MinSpacing: 12, MaxAmplitude: 60, Side: 1, Style: "rounded", Radius: 6, MinRadius: 5}
}
func TestRoundedExactTargetsAndOrientation(t *testing.T) {
	for _, target := range []float64{80, 150, 200, 400, 500} {
		for _, side := range []int{-1, 1} {
			s, q := roundedFixture()
			q.AddedLength = target
			q.Side = side
			q.Corridor = Box{-10, -110, 410, 110}
			r, e := Tune(s, q)
			if e != nil {
				t.Fatal(target, e)
			}
			ops, e := HelperOperations(r.Plan)
			if e != nil {
				t.Fatal(e)
			}
			sum := 0.0
			arcs := 0
			for _, op := range ops {
				switch op.Type {
				case "add_trace":
					sum += math.Hypot(op.Points[1][0]-op.Points[0][0], op.Points[1][1]-op.Points[0][1])
				case "add_arc":
					arcs++
					sum += math.Hypot(op.Points[1][0]-op.Points[0][0], op.Points[1][1]-op.Points[0][1]) / math.Sqrt2 * math.Pi / 2
				}
			}
			if arcs != 4*r.Turns-1 || math.Abs(sum-400-r.AddedLength) > 1e-7 || math.Abs(target-r.AddedLength-r.Residual) > 1e-7 || math.Abs(r.Residual) > r.LengthTolerance+1e-7 || r.Style != "rounded" || r.Radius != 6 {
				t.Fatalf("%+v measured %v", r, sum)
			}
			r.Plan.Profile = &Rules{6, 5, 12, 24, 6}
			c, e := Preflight(s, r.Plan)
			if e != nil || !c.OK {
				t.Fatal(c, e)
			}
			if Hash(c.Operations) != Hash(ops) {
				t.Fatal("receipt/operation order mismatch")
			}
		}
	}
}
func TestRoundedLimits(t *testing.T) {
	s, q := roundedFixture()
	r, e := Tune(s, q)
	if e != nil {
		t.Fatal(e)
	}
	q.AddedLength = r.Capacity
	if _, e = Tune(s, q); e != nil {
		t.Fatal(e)
	}
	q.AddedLength += 0.1
	if _, e = Tune(s, q); e == nil {
		t.Fatal("overcapacity accepted")
	}
	for _, change := range []func(*TuningRequest){func(q *TuningRequest) { q.Radius = 3 }, func(q *TuningRequest) { q.MinRadius = 7 }, func(q *TuningRequest) { q.Radius = math.NaN() }, func(q *TuningRequest) { q.Pitch = 29 }, func(q *TuningRequest) { q.MaxAmplitude = 29 }, func(q *TuningRequest) { q.AddedLength = 1 }, func(q *TuningRequest) { q.Style = "bezier" }} {
		_, q = roundedFixture()
		change(&q)
		if _, e := Tune(s, q); e == nil {
			t.Fatalf("accepted %+v", q)
		}
	}
}
func TestRoundedArcObstacleAndReceipt(t *testing.T) {
	s, q := roundedFixture()
	r, e := Tune(s, q)
	if e != nil {
		t.Fatal(e)
	}
	ops, _ := HelperOperations(r.Plan)
	var arc Operation
	for _, o := range ops {
		if o.Type == "add_arc" {
			arc = o
			break
		}
	}
	p := OperationPrimitive(arc)
	mid := p.Points[len(p.Points)/2]
	s.Vias = []Primitive{{ID: "foreign", Kind: "via", Net: "OTHER", Layer: 12, X: mid[0], Y: mid[1], Diameter: 24, Hole: 12}}
	r.Plan.Profile = &Rules{6, 5, 12, 24, 6}
	c, e := Preflight(s, r.Plan)
	if e != nil || c.OK {
		t.Fatal("arc collision missed", c, e)
	}
	invalid := arc
	invalid.ArcAngle = 180
	if ValidateOperations([]Operation{invalid}) == nil {
		t.Fatal("unsupported arc write accepted")
	}
	changed := append([]Operation{}, ops...)
	for i := range changed {
		if changed[i].Type == "add_arc" {
			changed[i].ArcAngle *= -1
			break
		}
	}
	if Hash(changed) == Hash(ops) {
		t.Fatal("arc direction not bound to receipt")
	}
}
func TestRectangularStyleCompatibility(t *testing.T) {
	s, q := roundedFixture()
	q.Style = ""
	q.Radius = 0
	q.MinRadius = 0
	a, e := Tune(s, q)
	if e != nil {
		t.Fatal(e)
	}
	q.Style = "rectangular"
	b, e := Tune(s, q)
	if e != nil || Hash(a) != Hash(b) {
		t.Fatal("default rectangular changed", e)
	}
}

func TestRoundedSDKLatticeAndSharedJoints(t *testing.T) {
	s, q := roundedFixture()
	r, e := Tune(s, q)
	if e != nil {
		t.Fatal(e)
	}
	if r.CoordinateResolution != 0.1 || r.LengthTolerance != 0.1 || math.Abs(r.AddedLength-199.97344572538567) > 1e-7 {
		t.Fatal(r)
	}
	for i, route := range r.Plan.Routes {
		for _, p := range route.Points {
			for _, v := range p {
				if math.Abs(v*10-math.Round(v*10)) > 1e-8 {
					t.Fatal("SDK would round", p)
				}
			}
		}
		if i > 0 && r.Plan.Routes[i-1].Points[1] != route.Points[0] {
			t.Fatal("disconnected shared joint")
		}
	}
	for _, change := range []func(*Snapshot, *TuningRequest){
		func(s *Snapshot, q *TuningRequest) { q.Radius = 6.01 },
		func(s *Snapshot, q *TuningRequest) { q.Pitch = 40.01 },
		func(s *Snapshot, q *TuningRequest) { s.Traces[0].Points[0][0] = 0.01 },
	} {
		s, q = roundedFixture()
		change(&s, &q)
		if _, e = Tune(s, q); e == nil {
			t.Fatal("off-grid accepted")
		}
	}
}
