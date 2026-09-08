package fastpath

import (
	"encoding/json"
	"math"
	"os"
	"strings"
	"testing"
)

func testBoard() Snapshot {
	return Snapshot{Revision: "r1", Layers: []int{1, 2}, Components: []Primitive{{ID: "U1", Kind: "component", Layer: 1, X: 0, Y: 0}}, Pads: []Primitive{{ID: "p1", Kind: "pad", Net: "N", Layer: 1, ComponentID: "U1", BBox: &Box{-10, -10, 10, 10}}}, Traces: []Primitive{}, Vias: []Primitive{}, Fills: []Primitive{}}
}
func testPlan() Plan {
	return Plan{Base: "r1", Profile: &Rules{6, 5, 12, 24, 6}, Routes: []Route{{Net: "N", Layer: 1, Width: 6, Points: []Point{{0, 0}, {100, 0}}}}}
}
func TestCompactFiltersAndStability(t *testing.T) {
	s := testBoard()
	s.Traces = []Primitive{{ID: "z", Kind: "trace", Net: "OTHER", Layer: 2, Width: 6, Points: []Point{{500, 500}, {600, 500}}}, {ID: "a", Kind: "trace", Net: "N", Layer: 1, Width: 6, Points: []Point{{0, 0}, {100, 0}}}}
	for _, scope := range []Scope{{BBox: &Box{-20, -20, 150, 20}}, {Nets: []string{"N"}}, {Layers: []int{1}}} {
		r, e := Filter(s, scope)
		if e != nil || len(r.Traces) != 1 || r.Traces[0].ID != "a" {
			t.Fatalf("%+v %v", r, e)
		}
	}
	a, _ := Filter(s, Scope{})
	s.Traces[0], s.Traces[1] = s.Traces[1], s.Traces[0]
	b, _ := Filter(s, Scope{})
	if a.GeometryHash != b.GeometryHash {
		t.Fatal("unstable hash")
	}
	c, _ := Filter(s, Scope{Include: map[string]bool{"vias": true}})
	raw, _ := json.Marshal(c)
	if len(c.Components) != 0 || len(c.Traces) != 0 || strings.Contains(string(raw), "rules\"") {
		t.Fatal(string(raw))
	}
	if len(raw) > 700 {
		t.Fatal("unexpectedly large compact output", len(raw))
	}
	if _, e := Filter(s, Scope{BBox: &Box{2, 0, 1, 5}}); e == nil {
		t.Fatal("invalid bbox accepted")
	}
}
func TestPreflight(t *testing.T) {
	for _, tc := range []struct {
		name string
		edit func(*Snapshot, *Plan)
		want string
	}{
		{"clean", func(s *Snapshot, p *Plan) {}, ""},
		{"trace collision", func(s *Snapshot, p *Plan) {
			s.Traces = append(s.Traces, Primitive{ID: "t", Kind: "trace", Net: "B", Layer: 1, Width: 8, Points: []Point{{50, -20}, {50, 20}}})
		}, "trace_trace"},
		{"pad collision", func(s *Snapshot, p *Plan) { s.Pads[0].Net = "B" }, "trace_pad"},
		{"via trace", func(s *Snapshot, p *Plan) {
			s.Vias = append(s.Vias, Primitive{ID: "v", Kind: "via", Net: "B", Layer: 12, X: 50, Y: 0, Diameter: 24})
		}, "trace_via"},
		{"via via", func(s *Snapshot, p *Plan) {
			p.Vias = []Via{{Net: "B", X: 50, Y: 50, Diameter: 24, Hole: 12, From: 1, To: 2}}
			s.Vias = []Primitive{{ID: "v", Kind: "via", Net: "C", Layer: 12, X: 50, Y: 50, Diameter: 24}}
		}, "via_via"},
		{"via pad", func(s *Snapshot, p *Plan) {
			p.Vias = []Via{{Net: "B", X: 0, Y: 0, Diameter: 24, Hole: 12, From: 1, To: 2}}
		}, "via_pad"},
		{"width", func(s *Snapshot, p *Plan) { p.Routes[0].Width = 2 }, "width_rule"},
		{"via rule", func(s *Snapshot, p *Plan) {
			p.Vias = []Via{{Net: "N", X: 50, Y: 50, Diameter: 16, Hole: 10, From: 1, To: 2}}
		}, "via_hole_rule"},
		{"layer", func(s *Snapshot, p *Plan) { p.Routes[0].Layer = 3 }, "invalid_layer"},
		{"protected", func(s *Snapshot, p *Plan) { p.ProtectedNets = []string{"N"} }, "protected_net"},
		{"protected deletion", func(s *Snapshot, p *Plan) {
			s.Traces = []Primitive{{ID: "locked", Kind: "trace", Net: "N", Layer: 1, Width: 6, Points: []Point{{0, 0}, {100, 0}}, Locked: true}}
			p.DeleteIDs = []string{"locked"}
		}, "protected_geometry"},
		{"unknown geometry", func(s *Snapshot, p *Plan) { s.Pads[0].Unsupported = true }, "unsupported_obstacle"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s, p := testBoard(), testPlan()
			tc.edit(&s, &p)
			before := Hash(s)
			r, e := Preflight(s, p)
			if e != nil {
				t.Fatal(e)
			}
			if before != Hash(s) {
				t.Fatal("preflight mutated input")
			}
			if tc.want == "" {
				if !r.OK {
					t.Fatal(r)
				}
			} else {
				found := false
				for _, c := range r.Conflicts {
					found = found || c.Type == tc.want
				}
				if !found || r.OK {
					t.Fatalf("missing %s: %+v", tc.want, r)
				}
			}
		})
	}
}
func TestRevisionPlanBinding(t *testing.T) {
	s, p := testBoard(), testPlan()
	a, e := Preflight(s, p)
	if e != nil {
		t.Fatal(e)
	}
	p.Routes[0].Width = 8
	b, _ := Preflight(s, p)
	if a.Hash == b.Hash {
		t.Fatal("geometry not bound")
	}
	p.Base = "stale"
	if _, e := Preflight(s, p); e == nil || e.Error() != "STALE_REVISION" {
		t.Fatal(e)
	}
}
func TestExplicitOperationsRejectInvalid(t *testing.T) {
	for _, op := range []Operation{{Type: "move_component"}, {Type: "add_via", Net: "N", Hole: 12, Diameter: 24, From: 1, To: 15}, {Type: "add_trace", Net: "N", Layer: 1, Width: 6, Points: []Point{{1, 1}, {1, 1}}}} {
		if ValidateOperations([]Operation{op}) == nil {
			t.Fatal(op)
		}
	}
}
func TestCandidateCollisionAndDeletion(t *testing.T) {
	s, p := testBoard(), testPlan()
	p.Routes = append(p.Routes, Route{Net: "B", Layer: 1, Width: 6, Points: []Point{{50, -20}, {50, 20}}})
	r, e := Preflight(s, p)
	if e != nil || r.OK {
		t.Fatal(r, e)
	}
	p = testPlan()
	s.Traces = []Primitive{{ID: "del", Kind: "trace", Net: "B", Layer: 1, Width: 6, Points: []Point{{50, -20}, {50, 20}}}}
	p.DeleteIDs = []string{"del"}
	r, e = Preflight(s, p)
	if e != nil || !r.OK || r.Operations[0].Type != "delete_trace" {
		t.Fatal(r, e)
	}
}
func TestDistanceDegenerateParallelAndCrossing(t *testing.T) {
	for _, tc := range []struct {
		a, b, c, d Point
		want       float64
	}{{Point{0, 0}, Point{10, 0}, Point{5, -10}, Point{5, 10}, 0}, {Point{0, 0}, Point{10, 0}, Point{0, 10}, Point{10, 10}, 10}, {Point{0, 0}, Point{0, 0}, Point{3, 4}, Point{3, 4}, 5}} {
		if d := segDist(tc.a, tc.b, tc.c, tc.d); d != tc.want {
			t.Fatal(d, tc.want)
		}
	}
}
func TestLiveProfileAndExplicitCoordinates(t *testing.T) {
	raw := json.RawMessage(`{"config":{"Physics":{"Track":{"copperThickness1oz":{"form":{"data":[{"minValue":0.127}]}}},"Via Size":{"viaSize":{"form":{"viaInnerdiameterDefault":0.3,"viaOuterdiameterDefault":0.6}}}},"Spacing":{"Safe Spacing":{"copperThickness1oz":{"tables":{"1":{"content":[[0.1],[0.15,0.2]]}}}}}}}`)
	r := LiveProfile(raw)
	if r == nil || r.Clearance < 7.8 || r.MinWidth < 4.99 || r.MinWidth > 5.01 {
		t.Fatal(r)
	}
	s, p := testBoard(), testPlan()
	s.Rules = raw
	p.Profile = nil
	c, e := Preflight(s, p)
	if e != nil || !c.OK {
		t.Fatal(c, e)
	}
	s.Rules = nil
	if _, e = Preflight(s, p); e == nil {
		t.Fatal("missing profile should fail closed")
	}
	for _, raw := range []string{`[1]`, `[1,2,3]`, `[null,2]`} {
		var p Point
		if e = json.Unmarshal([]byte(raw), &p); e == nil {
			t.Fatal("bad point accepted", raw)
		}
	}
	if e = ExplicitViaCoordinates(map[string]any{"vias": []any{map[string]any{"x": 0}}}, "vias"); e == nil {
		t.Fatal("implicit coordinate accepted")
	}
}

// This is the actual pre-fix 1.4.4 Host response. Connector tests independently
// verify that normalization preserves these 16 boxes and supplies ownership.
func TestHostPadIdentityClearance(t *testing.T) {
	raw, err := os.ReadFile("testdata/host-pad-identity.json")
	if err != nil {
		t.Fatal(err)
	}
	var capture struct {
		Result Snapshot `json:"result"`
	}
	if err := json.Unmarshal(raw, &capture); err != nil {
		t.Fatal(err)
	}
	original := capture.Result
	plan := Plan{Base: original.Revision, Profile: original.RuleProfile,
		Routes: []Route{{Net: "PROBE", Layer: 1, Width: 6, Points: []Point{{0, -600}, {1000, -600}}}}}
	before, err := Preflight(original, plan)
	if err != nil || before.OK {
		t.Fatalf("captured failure not reproduced: %+v %v", before, err)
	}
	found := false
	for _, c := range before.Conflicts {
		if c.Type == "unsupported_obstacle" {
			found = true
		}
	}
	if !found {
		t.Fatal("expected phantom unsupported obstacle")
	}
	normalized := original
	normalized.Pads = nil
	for _, pad := range original.Pads {
		if pad.BBox == nil {
			continue
		} // expected Connector output, not a production filter
		for _, component := range original.Components {
			if strings.HasPrefix(pad.ID, component.ID) {
				pad.ComponentID = component.ID
			}
		}
		normalized.Pads = append(normalized.Pads, pad)
	}
	if len(normalized.Pads) != 16 {
		t.Fatal("Host fixture changed")
	}
	for _, pad := range normalized.Pads {
		t.Run(pad.ID, func(t *testing.T) {
			board := normalized
			board.Pads = []Primitive{pad}
			compact, err := Filter(board, Scope{Nets: []string{pad.Net}, Layers: []int{1}, Include: map[string]bool{"pads": true, "components": true}})
			if err != nil || len(compact.Pads) != 1 || len(compact.Components) != 1 || compact.Pads[0].BBox == nil || compact.Pads[0].Unsupported {
				t.Fatalf("incomplete compact: %+v %v", compact, err)
			}
			serialized, _ := json.Marshal(compact)
			var roundTrip Snapshot
			if err := json.Unmarshal(serialized, &roundTrip); err != nil {
				t.Fatal(err)
			}
			for _, layer := range []int{1, 2} {
				q := plan
				q.Routes = []Route{{Net: "PROBE", Layer: layer, Width: 6, Points: []Point{{pad.BBox[0] - 30, pad.Y}, {pad.BBox[2] + 30, pad.Y}}}}
				checked, err := Preflight(roundTrip, q)
				wantConflict := pad.Layer == 12 || pad.Layer == layer
				if err != nil || checked.OK == wantConflict {
					t.Fatalf("crossing layer %d: %+v %v", layer, checked, err)
				}
				if wantConflict && (len(checked.Conflicts) != 1 || checked.Conflicts[0].Type != "trace_pad" || checked.Conflicts[0].Obstacle != pad.ID) {
					t.Fatalf("not real clearance: %+v", checked)
				}
				y := pad.BBox[3] + 3 + plan.Profile.Clearance + 1
				q.Routes[0].Points = []Point{{pad.BBox[0] - 30, y}, {pad.BBox[2] + 30, y}}
				checked, err = Preflight(roundTrip, q)
				if err != nil || !checked.OK {
					t.Fatalf("legal bypass: %+v %v", checked, err)
				}
				if wantConflict {
					y -= 2
					q.Routes[0].Points = []Point{{pad.BBox[0] - 30, y}, {pad.BBox[2] + 30, y}}
					checked, err = Preflight(roundTrip, q)
					if err != nil || checked.OK || math.Abs(checked.Conflicts[0].Actual-(plan.Profile.Clearance-1)) > 1e-5 {
						t.Fatalf("clearance near boundary: %+v %v", checked, err)
					}
				}
			}
			roundTrip.Pads[0].Unsupported = true
			checked, err := Preflight(roundTrip, plan)
			if err != nil || checked.OK || checked.Conflicts[0].Type != "unsupported_obstacle" {
				t.Fatalf("unknown must fail closed: %+v %v", checked, err)
			}
		})
	}
}
