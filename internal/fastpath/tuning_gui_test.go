package fastpath

import (
	"math"
	"strings"
	"testing"
)

func guiFixture() (Snapshot, GUITuningRequest) {
	s, q := roundedFixture()
	s.RuleProfile = &Rules{Clearance: 12, MinWidth: 5, MinHole: 12, MinDiameter: 24, MinAnnulus: 6}
	return s, GUITuningRequest{Base: q.Base, Net: q.Net, SpanID: q.SpanID, Corridor: Box{-5, -5, 405, 103}, TargetMode: "specified_length", TargetLength: 600, Corner: "line_90", Side: "single", SpacingW: 40, MinAmplitudeH: 20}
}
func TestGUITuningCornerSideExactLength(t *testing.T) {
	for _, corner := range []string{"line_45", "line_90", "arc_90"} {
		for _, side := range []string{"single", "bilateral"} {
			for _, target := range []float64{480, 600, 800} {
				for _, reverse := range []bool{false, true} {
					s, q := guiFixture()
					q.Corner = corner
					q.Side = side
					q.TargetLength = target
					if side == "bilateral" {
						q.Corridor[1] = -103
					}
					if reverse {
						s.Traces[0].Points = []Point{{400, 0}, {0, 0}}
					}
					before := Hash(s)
					r, e := TuneGUI(s, q)
					if e != nil {
						t.Fatal(corner, side, target, reverse, e)
					}
					if Hash(s) != before {
						t.Fatal("mutated snapshot")
					}
					if math.Abs(r.Residual) > r.LengthTolerance+1e-7 || math.Abs(r.AchievedLength-r.TargetLength+r.Residual) > 1e-7 {
						t.Fatal(r)
					}
					ops, e := HelperOperations(r.Plan)
					if e != nil {
						t.Fatal(e)
					}
					sum := 0.0
					arcs := 0
					positive, negative := false, false
					for _, op := range ops {
						if op.Type == "delete_trace" {
							continue
						}
						a, b := op.Points[0], op.Points[1]
						l := math.Hypot(b[0]-a[0], b[1]-a[1])
						if op.Type == "add_arc" {
							arcs++
							l = l / math.Sqrt2 * math.Pi / 2
							for _, p := range op.Points {
								for _, v := range p {
									if math.Abs(v*10-math.Round(v*10)) > 1e-7 {
										t.Fatal("off SDK lattice")
									}
								}
							}
						}
						sum += l
						for _, p := range op.Points {
							positive = positive || p[1] > 1e-7
							negative = negative || p[1] < -1e-7
						}
					}
					if math.Abs(sum-r.AchievedLength) > 1e-7 || (corner == "arc_90") != (arcs > 0) {
						t.Fatal(sum, r)
					}
					if side == "single" && positive && negative {
						t.Fatal("single crossed baseline")
					}
					if side == "bilateral" && r.Turns > 1 && !(positive && negative) {
						t.Fatal("not bilateral")
					}
					r.Plan.Profile = s.RuleProfile
					check, e := Preflight(s, r.Plan)
					if e != nil || !check.OK {
						t.Fatal(check, e)
					}
				}
			}
		}
	}
}
func TestGUITuningTargetUsesCurrentExactCopper(t *testing.T) {
	s, q := guiFixture()
	s.Traces = append(s.Traces, Primitive{ID: "arc", Kind: "arc", Net: q.Net, Layer: 2, ArcLength: 15 * math.Pi, Points: []Point{{0, 200}, {30, 230}}})
	r, e := TuneGUI(s, q)
	if e != nil {
		t.Fatal(e)
	}
	if r.CurrentLength != 400+15*math.Pi || math.Abs(r.AchievedLength-600) > r.LengthTolerance {
		t.Fatal(r)
	}
}
func TestGUITuningRejectsUnprovenAndInfeasible(t *testing.T) {
	for _, change := range []func(*Snapshot, *GUITuningRequest){
		func(s *Snapshot, q *GUITuningRequest) { q.Base = "old" }, func(s *Snapshot, q *GUITuningRequest) { q.TargetMode = "follow_rule" }, func(s *Snapshot, q *GUITuningRequest) { q.TargetLength = 1e9 }, func(s *Snapshot, q *GUITuningRequest) { q.TargetLength = 400 }, func(s *Snapshot, q *GUITuningRequest) { q.SpacingW = 10 }, func(s *Snapshot, q *GUITuningRequest) { q.MinAmplitudeH = 200 }, func(s *Snapshot, q *GUITuningRequest) { q.Corridor[1] = -103 }, func(s *Snapshot, q *GUITuningRequest) { q.Side = "bilateral" }, func(s *Snapshot, q *GUITuningRequest) { q.Corner = "arc_90"; q.SpacingW = 40.1 }, func(s *Snapshot, q *GUITuningRequest) { s.RuleProfile = nil }, func(s *Snapshot, q *GUITuningRequest) { s.Traces[0].Locked = true }, func(s *Snapshot, q *GUITuningRequest) {
			s.Traces = append(s.Traces, Primitive{Net: q.Net, Unsupported: true})
		},
	} {
		s, q := guiFixture()
		change(&s, &q)
		if _, e := TuneGUI(s, q); e == nil {
			t.Fatalf("accepted %+v", q)
		}
	}
	s, q := guiFixture()
	q.TargetMode = "follow_rule"
	if _, e := TuneGUI(s, q); e == nil || !strings.Contains(e.Error(), "RULE_TARGET_UNRESOLVED") {
		t.Fatal(e)
	}
}
func TestGUITuningNativeTemplateDimensions(t *testing.T) {
	for _, corner := range []string{"line_45", "line_90", "arc_90"} {
		s, q := guiFixture()
		q.Corner = corner
		q.TargetLength = 600
		r, e := TuneGUI(s, q)
		if e != nil {
			t.Fatal(e)
		}
		if corner == "line_45" {
			a := r.Plan.Routes[0].Points[1]
			if math.Abs(a[0]-6/math.Sqrt2) > 1e-8 || a[0] != a[1] {
				t.Fatal("45-degree chamfer offset", a)
			}
		}
		if corner == "arc_90" {
			for _, route := range r.Plan.Routes {
				if route.ArcAngle != 0 {
					a, b := route.Points[0], route.Points[1]
					radius := math.Hypot(b[0]-a[0], b[1]-a[1]) / math.Sqrt2
					if math.Abs(radius-math.Min(r.ActualAmplitude, q.SpacingW)/2) > 1e-7 {
						t.Fatal("native derived radius", radius)
					}
				}
			}
		}
	}
}
func TestGUITuningPayloadCompatibility(t *testing.T) {
	s, q := guiFixture()
	var p map[string]any
	_ = Decode(q, &p)
	for _, key := range []string{"radius", "pitch", "style", "target_added_length"} {
		p[key] = 1
		if _, e := TunePayload(s, p); e == nil {
			t.Fatal(key)
		}
		delete(p, key)
	}
	if _, e := TunePayload(s, p); e != nil {
		t.Fatal(e)
	}
	s, legacy := roundedFixture()
	_ = Decode(legacy, &p)
	p = map[string]any{}
	_ = Decode(legacy, &p)
	if _, e := TunePayload(s, p); e != nil {
		t.Fatal(e)
	}
}
