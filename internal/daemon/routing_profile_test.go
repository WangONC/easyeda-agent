package daemon

import (
	"encoding/json"
	"github.com/zhoushoujianwork/easyeda-agent/internal/fastpath"
	"github.com/zhoushoujianwork/easyeda-agent/internal/workflow"
	"testing"
)

func TestRoutingProfileIdentityAndStaleness(t *testing.T) {
	t.Setenv(workflow.EnvDir, t.TempDir())
	s := fastpath.Snapshot{Revision: "r1", Layers: []int{1, 2}, PhysicalStackup: json.RawMessage(`{"thickness":62}`), Rules: json.RawMessage(`{"width":6}`)}
	_, rh := fastpath.ProfileTokens(s)
	p := fastpath.RoutingProfile{ID: "SE50", Manufacturer: "test", StackupID: "test-only", RulesHash: rh, BoardThickness: 62, LayerOrder: []int{1, 2}, SignalLayer: 1, ReferenceLayer: 2, CopperThickness: 1.4, DielectricThickness: 8, Material: "test", Source: "reviewed fixture", SourceKind: "manufacturer", EvidenceBasis: "manufacturer", Evidence: "synthetic fixture", Units: "mil", Kind: "single-ended", TargetImpedance: 50, Width: 6, Tolerance: 10, Reviewed: true}
	p.StackupHash = p.ManufacturerStackupHash()
	p.ObservedLayersHash = fastpath.ProfileLayersHash(s)
	r, e := profileOperation(s, "project", "doc", map[string]any{"operation": "put", "profile": p})
	if e != nil || r["state"] != "MANUFACTURER_VERIFIED" {
		t.Fatalf("%v %v", r, e)
	}

	plan := fastpath.Plan{Routes: []fastpath.Route{{Net: "N", Layer: 1, Width: 6}}}
	if _, e = checkHelperProfile(s, "project", "doc", "route.tuning_plan", map[string]any{"profile_id": "SE50"}, plan); e != nil {
		t.Fatal(e)
	}
	plan.Routes[0].Width = 8
	if _, e = checkHelperProfile(s, "project", "doc", "route.tuning_plan", map[string]any{"profile_id": "SE50"}, plan); e == nil {
		t.Fatal("helper accepted unreviewed width")
	}
	plan.Routes[0].Width = 6
	pair := p
	pair.ID = "DIFF90"
	pair.Kind = "differential"
	pair.Gap = 10
	if e = storeRoutingProfile("project", "doc", pair); e != nil {
		t.Fatal(e)
	}
	if _, e = checkHelperProfile(s, "project", "doc", "route.pair_plan", map[string]any{"profile_id": "DIFF90", "gap": 10.0}, plan); e != nil {
		t.Fatal(e)
	}
	if _, e = checkHelperProfile(s, "project", "doc", "route.pair_plan", map[string]any{"profile_id": "DIFF90", "gap": 8.0}, plan); e == nil {
		t.Fatal("helper accepted wrong pair gap")
	}
	s.Revision = "r2"
	r, e = profileOperation(s, "project", "doc", map[string]any{"operation": "get", "profile_id": "SE50"})
	if e != nil || r["state"] != "MANUFACTURER_VERIFIED" {
		t.Fatal("geometry revision incorrectly invalidated profile", r, e)
	}
	s.Rules = json.RawMessage(`{"width":7}`)
	r, e = profileOperation(s, "project", "doc", map[string]any{"operation": "get", "profile_id": "SE50"})
	if e != nil || r["state"] != "STALE" {
		t.Fatal(r, e)
	}
	if _, e = loadRoutingProfile("project", "other", "SE50"); e == nil {
		t.Fatal("profile leaked across document")
	}
	p.Width = 7
	if e = storeRoutingProfile("project", "doc", p); e == nil {
		t.Fatal("immutable review overwritten")
	}
	s.PhysicalStackup = nil
	r, e = profileOperation(s, "project", "doc", map[string]any{"operation": "get", "profile_id": "SE50"})
	if e != nil || r["state"] != "STALE" {
		t.Fatal(r, e)
	}
}
