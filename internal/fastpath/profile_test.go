package fastpath

import "testing"

func TestReviewedProfileStaleness(t *testing.T) {
	p := RoutingProfile{ID: "SE50_L1", Manufacturer: "fixture", StackupID: "eight", StackupHash: "stack", RulesHash: "rules", BoardThickness: 63, LayerOrder: []int{1, 15, 16, 2}, SignalLayer: 1, ReferenceLayer: 15, CopperThickness: 1.4, DielectricThickness: 4, Material: "reviewed FR4", Source: "fixture only", SourceKind: "reviewed-calculation", Units: "mil", Kind: "single-ended", TargetImpedance: 50, Width: 6, Tolerance: 10, Reviewed: true}
	if e := p.Validate(); e != nil {
		t.Fatal(e)
	}
	if p.State("stack", "rules") != "UNVERIFIED" || p.State("changed", "rules") != "STALE" || p.State("stack", "changed") != "STALE" || p.State("", "rules") != "UNKNOWN" {
		t.Fatal("bad profile validity")
	}
	p.SourceKind = "estimate"
	if p.State("stack", "rules") != "UNVERIFIED" {
		t.Fatal("estimate certified")
	}
	if p.CheckRoute(Route{Layer: 2, Width: 6}) == nil {
		t.Fatal("wrong signal layer accepted")
	}
}

func TestManufacturerEvidenceWithoutHostPhysical(t *testing.T) {
	p := RoutingProfile{ID: "test", Manufacturer: "fixture", StackupID: "fixture", Units: "mil", LayerOrder: []int{1, 2}, BoardThickness: 62, CopperThickness: 1.4, DielectricThickness: 8, SignalLayer: 1, ReferenceLayer: 2, Kind: "single-ended", Width: 6, TargetImpedance: 50, Tolerance: 10, Source: "test evidence", SourceKind: "manufacturer", EvidenceBasis: "manufacturer", Evidence: "synthetic unit fixture only", Reviewed: true}
	s := Snapshot{Layers: []int{1, 2}, Rules: []byte(`{"width":6}`)}
	_, p.RulesHash = ProfileTokens(s)
	p.StackupHash = p.ManufacturerStackupHash()
	p.ObservedLayersHash = ProfileLayersHash(s)
	check := func(want string) {
		t.Helper()
		state, reason := p.EvidenceState(s)
		if state != want {
			t.Fatalf("%s %s, want %s", state, reason, want)
		}
	}
	check("MANUFACTURER_VERIFIED")
	s.Revision = "changed"
	check("MANUFACTURER_VERIFIED")
	p.ReferenceLayer = 2
	p.Width = 7 // New review record must use a new immutable ID.
	p.BoardThickness = 63
	check("STALE")
	p.BoardThickness = 62
	s.Rules = []byte(`{"width":7}`)
	check("STALE")
	_, p.RulesHash = ProfileTokens(s)
	check("MANUFACTURER_VERIFIED")
	s.Layers = []int{1, 15, 2}
	check("STALE")
	s.Layers = []int{1, 2}
	p.Reviewed = false
	check("UNVERIFIED")
	p.Reviewed = true
	p.Evidence = ""
	check("UNVERIFIED")
}
