package fastpath

import (
	"math"
	"testing"
)

func TestNonzeroHolesAndBoardEdge(t *testing.T) {
	outer := []Point{{0, 0}, {200, 0}, {200, 200}, {0, 200}}
	hole := []Point{{40, 40}, {40, 160}, {160, 160}, {160, 40}}
	obstacle := Primitive{ID: "plane", Kind: "fill", Net: "GND", Layer: 1, Rings: [][]Point{outer, hole}, ProjectionError: .05, Coverage: "conservative"}
	if filledAt(Point{100, 100}, obstacle.Rings) || !filledAt(Point{20, 20}, obstacle.Rings) {
		t.Fatal("nonzero hole semantics")
	}
	a := Primitive{Kind: "trace", Points: []Point{{70, 100}, {130, 100}}, Width: 6}
	if d := clearance(a, obstacle); d < 26.9 || d > 27 {
		t.Fatalf("hole clearance %v", d)
	}
	a.Points = []Point{{10, 20}, {190, 20}}
	if clearance(a, obstacle) >= 0 {
		t.Fatal("copper ignored")
	}
	obstacle.Kind = "board_edge"
	obstacle.Rings = [][]Point{outer}
	if clearance(a, obstacle) < 6.9 {
		t.Fatal("inside board rejected")
	}
	a.Points = []Point{{-10, 100}, {190, 100}}
	if clearance(a, obstacle) >= 0 {
		t.Fatal("off board allowed")
	}
}
func TestPolygonPreflightFailClosed(t *testing.T) {
	s := testBoard()
	s.Pads = nil
	s.Fills = []Primitive{{ID: "plane", Kind: "fill", Layer: 1, Net: "GND", Rings: [][]Point{{{20, -20}, {80, -20}, {80, 20}, {20, 20}}}, Coverage: "conservative"}}
	c, e := Preflight(s, testPlan())
	if e != nil || c.OK {
		t.Fatalf("collision not rejected: %+v %v", c, e)
	}
	s.Fills[0].Unsupported = true
	c, e = Preflight(s, testPlan())
	if e != nil || c.OK || c.Conflicts[0].Type != "unsupported_obstacle" {
		t.Fatalf("%+v %v", c, e)
	}
	s.Fills[0].Unsupported = false
	s.Fills[0].Rings[0][0][0] = math.NaN()
	c, e = Preflight(s, testPlan())
	if e != nil || c.OK {
		t.Fatal("invalid polygon accepted")
	}
}
func TestThroughViaSignalLayerPair(t *testing.T) {
	s := testBoard()
	s.Layers = []int{1, 15, 16, 2}
	p := testPlan()
	p.Routes = nil
	p.Vias = []Via{{Net: "N", X: 300, Y: 300, Diameter: 24, Hole: 12, From: 1, To: 15}}
	c, e := Preflight(s, p)
	if e != nil || !c.OK {
		t.Fatalf("explicit inner signal transition rejected %+v %v", c, e)
	}
	if OperationPrimitive(c.Operations[0]).Layer != 12 {
		t.Fatal("physical through span narrowed")
	}
	p.Vias[0].To = 3
	c, e = Preflight(s, p)
	if e != nil || c.OK {
		t.Fatalf("noncopper pair accepted %+v %v", c, e)
	}
}

func TestPourOnlyRegionDoesNotBecomeRoutingKeepout(t *testing.T) {
	s := testBoard()
	s.Pads = nil
	blocked := false
	s.Fills = []Primitive{{ID: "void-rule", Kind: "region", Layer: 1, Rings: [][]Point{{{0, -30}, {100, -30}, {100, 30}, {0, 30}}}, RoutingBlocked: &blocked, RuleTypes: []int{7}}}
	r, e := Preflight(s, testPlan())
	if e != nil || !r.OK {
		t.Fatal(r, e)
	}
	blocked = true
	r, e = Preflight(s, testPlan())
	if e != nil || r.OK {
		t.Fatal("routing keepout ignored", r, e)
	}
	blocked = false
	s.Fills[0].Unsupported = true
	r, e = Preflight(s, testPlan())
	if e != nil || r.OK {
		t.Fatal("unknown rule ignored", r, e)
	}
}
