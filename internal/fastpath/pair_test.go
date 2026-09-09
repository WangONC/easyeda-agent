package fastpath

import (
	"math"
	"testing"
)

func TestPairExplicitOffset(t *testing.T) {
	s := testBoard()
	q := PairRequest{Base: "r1", Positive: "P", Negative: "M", Layer: 1, Width: 6, Gap: 8, Centerline: []Point{{0, 100}, {200, 100}, {200, 300}}}
	r, e := Pair(s, q)
	if e != nil {
		t.Fatal(e)
	}
	if math.Abs(r.MinimumGap-8) > 1e-7 || !r.RequiresPreflight || r.Plan.Routes[0].Net != "P" || r.Plan.Routes[1].Net != "M" {
		t.Fatalf("%+v", r)
	}
	r.Plan.Profile = &Rules{6, 5, 12, 24, 6}
	c, e := Preflight(s, r.Plan)
	if e != nil || !c.OK {
		t.Fatalf("%+v %v", c, e)
	}
	for _, path := range [][]Point{{{0, 0}, {0, 0}}, {{0, 0}, {10, 0}, {10, 1}, {0, 1}}, {{0, 0}, {10, 0}, {0, 0}}} {
		q.Centerline = path
		if _, e := Pair(s, q); e == nil {
			t.Fatalf("accepted %+v", path)
		}
	}
	q.Base = "old"
	if _, e := Pair(s, q); e == nil {
		t.Fatal("stale accepted")
	}
}

func TestPairExplicitSymmetricEndpointTransition(t *testing.T) {
	s := Snapshot{Revision: "r", Layers: []int{1, 15, 2}}
	q := PairRequest{Base: "r", Positive: "P", Negative: "N", Layer: 1, Width: 6, Gap: 6, Centerline: []Point{{0, 0}, {100, 0}}, Transitions: []PairTransition{{End: "end", To: 15, Diameter: 20, Hole: 10, Separation: 30}}}
	r, e := Pair(s, q)
	if e != nil {
		t.Fatal(e)
	}
	if len(r.Plan.Vias) != 2 || r.Plan.Vias[0].From != 1 || r.Plan.Vias[0].To != 15 || r.Plan.Vias[0].X != 100 || r.Plan.Vias[0].Y != 15 || r.Plan.Vias[1].Y != -15 || r.Mismatch != 0 {
		t.Fatal(r)
	}
	q.Transitions[0].Separation = 12
	if _, e = Pair(s, q); e == nil {
		t.Fatal("overlapping via transition accepted")
	}
}
