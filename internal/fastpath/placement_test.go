package fastpath

import "testing"

func placementFixture() Snapshot {
	boxA, boxB := Box{10, 10, 20, 20}, Box{40, 40, 50, 50}
	return Snapshot{Revision: "r1", Components: []Primitive{{ID: "a", Kind: "component", X: 15, Y: 15, Layer: 1, BBox: &boxA}, {ID: "b", Kind: "component", X: 45, Y: 45, Layer: 1, BBox: &boxB}}, Fills: []Primitive{{ID: "edge", Kind: "board_edge", Rings: [][]Point{{{0, 0}, {100, 0}, {100, 100}, {0, 100}}}}}}
}
func TestPlacementPreflightExplicitGeometry(t *testing.T) {
	s := placementFixture()
	p := []Placement{{PrimitiveID: "a", X: 25, Y: 25, Rotation: 450, Layer: 1}}
	c, e := PlacementPreflight(s, "r1", p)
	if e != nil || !c.OK || c.PlanHash == "" || c.Placements[0].Rotation != 90 {
		t.Fatal(c, e)
	}
	if _, e = PlacementPreflight(s, "stale", p); e == nil || e.Error() != "STALE_REVISION" {
		t.Fatal(e)
	}
}
func TestPlacementPreflightBoundaryOverlapAndLock(t *testing.T) {
	for name, tc := range map[string]struct {
		mutate func(*Snapshot, *[]Placement)
		want   string
	}{
		"boundary":         {func(_ *Snapshot, p *[]Placement) { (*p)[0].X = 150 }, "board_boundary"},
		"existing-overlap": {func(_ *Snapshot, p *[]Placement) { (*p)[0].X = 45; (*p)[0].Y = 45 }, "component_overlap"},
		"candidate-overlap": {func(_ *Snapshot, p *[]Placement) {
			*p = append(*p, Placement{PrimitiveID: "b", X: 25, Y: 25, Rotation: 0, Layer: 1})
		}, "candidate_overlap"},
		"locked": {func(s *Snapshot, _ *[]Placement) { s.Components[0].Locked = true }, "locked_component"},
	} {
		t.Run(name, func(t *testing.T) {
			s := placementFixture()
			p := []Placement{{PrimitiveID: "a", X: 25, Y: 25, Rotation: 0, Layer: 1}}
			tc.mutate(&s, &p)
			c, e := PlacementPreflight(s, "r1", p)
			if e != nil {
				t.Fatal(e)
			}
			found := false
			for _, x := range c.Conflicts {
				if x.Type == tc.want {
					found = true
				}
			}
			if c.OK || !found {
				t.Fatal(c)
			}
		})
	}
}
