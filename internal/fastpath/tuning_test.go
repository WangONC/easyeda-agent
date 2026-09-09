package fastpath

import (
	"math"
	"testing"
)

func TestTuningExplicitSpan(t *testing.T) {
	s := testBoard()
	s.Traces = []Primitive{{ID: "span", Kind: "trace", Net: "N", Layer: 1, Width: 6, Points: []Point{{0, 0}, {400, 0}}}}
	q := TuningRequest{Base: "r1", Net: "N", SpanID: "span", Corridor: Box{-10, -10, 410, 110}, AddedLength: 200, Pitch: 25, MinSpacing: 6, MaxAmplitude: 50, Side: 1}
	r, e := Tune(s, q)
	if e != nil {
		t.Fatal(e)
	}
	if math.Abs(r.Residual) > 1e-7 || r.Turns != 2 || !r.RequiresPreflight || r.Plan.DeleteIDs[0] != "span" {
		t.Fatalf("%+v", r)
	}
	if s.Traces[0].Points[1] != (Point{400, 0}) {
		t.Fatal("mutated snapshot")
	}
	r.Plan.Profile = &Rules{6, 5, 12, 24, 6}
	c, e := Preflight(s, r.Plan)
	if e != nil || !c.OK {
		t.Fatalf("%+v %v", c, e)
	}
	for _, alter := range []func(*TuningRequest){func(q *TuningRequest) { q.Base = "old" }, func(q *TuningRequest) { q.AddedLength = 1e6 }, func(q *TuningRequest) { q.Pitch = 8 }, func(q *TuningRequest) { q.Corridor = Box{0, 0, 10, 10} }, func(q *TuningRequest) { q.Side = 0 }, func(q *TuningRequest) { q.AddedLength = 2 }} {
		bad := q
		alter(&bad)
		if _, e := Tune(s, bad); e == nil {
			t.Fatalf("accepted %+v", bad)
		}
	}
	s.Traces[0].Locked = true
	if _, e := Tune(s, q); e == nil {
		t.Fatal("locked trace accepted")
	}
}

func TestTuningAvoidsNativeCollinearIDRecreation(t *testing.T) {
	s := Snapshot{Revision: "r", Layers: []int{15}, Traces: []Primitive{{ID: "seed", Kind: "trace", Layer: 15, Net: "GND", Width: 6, Points: []Point{{400, 0}, {800, 0}}}}}
	q := TuningRequest{Base: "r", Net: "GND", SpanID: "seed", Corridor: Box{380, -20, 820, 100}, AddedLength: 200, Pitch: 40, MinSpacing: 12, MaxAmplitude: 60, Side: 1}
	r, e := Tune(s, q)
	if e != nil {
		t.Fatal(e)
	}
	points := r.Plan.Routes[0].Points
	for i := 2; i < len(points); i++ {
		if cross(points[i-2], points[i-1], points[i]) == 0 {
			t.Fatal("Host would merge consecutive collinear primitives", points)
		}
	}
	ops, e := HelperOperations(r.Plan)
	if e != nil || len(ops) != 9 || r.AddedLength != 200 {
		t.Fatal(r, ops, e)
	}
}

func TestTuningRejectsInteriorBranch(t *testing.T) {
	s := Snapshot{Revision: "r", Layers: []int{1}, Traces: []Primitive{{ID: "seed", Kind: "trace", Layer: 1, Net: "N", Width: 6, Points: []Point{{0, 0}, {400, 0}}}, {ID: "branch", Kind: "trace", Layer: 1, Net: "N", Width: 6, Points: []Point{{200, 0}, {200, 100}}}}}
	q := TuningRequest{Base: "r", Net: "N", SpanID: "seed", Corridor: Box{-10, -10, 410, 100}, AddedLength: 200, Pitch: 40, MinSpacing: 12, MaxAmplitude: 60, Side: 1}
	if _, e := Tune(s, q); e == nil {
		t.Fatal("interior branch topology changed")
	}
}
