package fastpath

import (
	"encoding/json"
	"os"
	"testing"
)

// Captured through formal snapshot_compact on the isolated eight-layer Closure
// fixture, Host 3.2.186 / Connector 1.4.9. Contains actual poured holes and region rules.
func TestHostPouredVoidRegionAndBoardEdge(t *testing.T) {
	b, e := os.ReadFile("testdata/host-3.2.186-regions-pour.json")
	if e != nil {
		t.Fatal(e)
	}
	var s Snapshot
	if e = json.Unmarshal(b, &s); e != nil {
		t.Fatal(e)
	}
	cases := []struct {
		name   string
		layer  int
		points []Point
		pass   bool
		kind   string
	}{
		{"native void", 1, []Point{{20, -150}, {80, -150}}, true, ""},
		{"native copper", 1, []Point{{20, -300}, {80, -300}}, false, "trace_fill"},
		{"routing keepout", 16, []Point{{830, 300}, {940, 300}}, false, "trace_region"},
		{"outside keepout", 16, []Point{{830, 380}, {940, 380}}, true, ""},
		{"board edge", 16, []Point{{950, 500}, {1020, 500}}, false, "trace_board_edge"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			p := Plan{Base: s.Revision, Profile: s.RuleProfile, Routes: []Route{{Net: "CLOSURE_PROBE", Layer: c.layer, Width: 6, Points: c.points}}}
			r, e := Preflight(s, p)
			if e != nil || r.OK != c.pass {
				t.Fatal(r, e)
			}
			if !c.pass && (len(r.Conflicts) == 0 || r.Conflicts[0].Type != c.kind) {
				t.Fatal(r.Conflicts)
			}
		})
	}
}
