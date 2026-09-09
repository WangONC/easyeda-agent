package fastpath

import (
	"bytes"
	"encoding/json"
	"fmt"
	"sort"
)

// Reviewed manufacturer inputs are independent of unavailable Host physical getters.
// This record is not an impedance solver or a fabrication certificate.
type RoutingProfile struct {
	EvidenceBasis       string  `json:"evidence_basis,omitempty"`
	ObservedLayersHash  string  `json:"observed_layers_hash,omitempty"`
	Evidence            string  `json:"evidence,omitempty"`
	ID                  string  `json:"id"`
	Manufacturer        string  `json:"manufacturer"`
	StackupID           string  `json:"stackup_id"`
	StackupHash         string  `json:"stackup_hash"`
	RulesHash           string  `json:"rules_hash"`
	BoardThickness      float64 `json:"board_thickness"`
	LayerOrder          []int   `json:"layer_order"`
	SignalLayer         int     `json:"signal_layer"`
	ReferenceLayer      int     `json:"reference_layer"`
	CopperThickness     float64 `json:"copper_thickness"`
	DielectricThickness float64 `json:"dielectric_thickness"`
	Material            string  `json:"material"`
	Source              string  `json:"source"`
	SourceKind          string  `json:"source_kind"`
	Units               string  `json:"units"`
	Kind                string  `json:"kind"`
	TargetImpedance     float64 `json:"target_impedance_ohm"`
	Width               float64 `json:"width"`
	Gap                 float64 `json:"gap,omitempty"`
	Tolerance           float64 `json:"tolerance_percent"`
	UnitDelay           float64 `json:"unit_delay_ps_per_mil,omitempty"`
	Reviewed            bool    `json:"reviewed"`
}

func (p RoutingProfile) Validate() error {
	if p.EvidenceBasis != "" && p.EvidenceBasis != "manufacturer" {
		return fmt.Errorf("evidence_basis must be manufacturer; Host verification is not yet accepted")
	}
	if p.ID == "" || len(p.ID) > 100 || p.Manufacturer == "" || p.StackupID == "" || p.StackupHash == "" || p.RulesHash == "" || p.Source == "" {
		return fmt.Errorf("profile requires complete identity, source, material and live hashes")
	}
	if p.Units != "mil" || (p.Kind != "single-ended" && p.Kind != "differential") {
		return fmt.Errorf("profile units must be mil; kind must be single-ended or differential")
	}
	if !has(p.LayerOrder, p.SignalLayer) || !has(p.LayerOrder, p.ReferenceLayer) || p.SignalLayer == p.ReferenceLayer {
		return fmt.Errorf("explicit distinct signal/reference layers required")
	}
	seen := map[int]bool{}
	for _, layer := range p.LayerOrder {
		if seen[layer] || layer <= 0 {
			return fmt.Errorf("invalid layer order")
		}
		seen[layer] = true
	}
	for _, v := range []float64{p.BoardThickness, p.CopperThickness, p.DielectricThickness, p.TargetImpedance, p.Width, p.Tolerance} {
		if !finite(v) || v <= 0 {
			return fmt.Errorf("positive finite profile geometry/target required")
		}
	}
	if !finite(p.UnitDelay) || p.UnitDelay < 0 || !finite(p.Gap) || p.Gap < 0 || (p.Kind == "differential" && p.Gap <= 0) {
		return fmt.Errorf("invalid gap/delay")
	}
	if p.SourceKind != "manufacturer" && p.SourceKind != "reviewed-calculation" && p.SourceKind != "estimate" {
		return fmt.Errorf("source_kind must identify manufacturer, reviewed-calculation or estimate")
	}
	return nil
}
func (p RoutingProfile) State(stackup, rules string) string {
	if stackup == "" || rules == "" {
		return "UNKNOWN"
	}
	if stackup != p.StackupHash || rules != p.RulesHash {
		return "STALE"
	}
	if !p.Reviewed || p.SourceKind == "estimate" {
		return "UNVERIFIED"
	}
	return "UNVERIFIED" // Host verification requires separate real-version acceptance.
}

// ManufacturerStackupHash binds reviewed manufacturing fields, not private Host data.
func (p RoutingProfile) ManufacturerStackupHash() string {
	return Hash(struct {
		Manufacturer, ID, Units, Material string
		Thickness, Copper, Dielectric     float64
		Layers                            []int
	}{p.Manufacturer, p.StackupID, p.Units, p.Material, p.BoardThickness, p.CopperThickness, p.DielectricThickness, p.LayerOrder})
}
func ProfileLayersHash(s Snapshot) string {
	layers := append([]int(nil), s.Layers...)
	sort.Ints(layers)
	return Hash(layers)
}
func ProfileUsable(state string) bool {
	return state == "MANUFACTURER_VERIFIED" || state == "HOST_VERIFIED"
}
func (p RoutingProfile) EvidenceState(s Snapshot) (string, string) {
	sh, rh := ProfileTokens(s)
	if p.EvidenceBasis != "manufacturer" {
		return p.State(sh, rh), "HOST_VERIFICATION_NOT_ACCEPTED"
	}
	if p.StackupHash != p.ManufacturerStackupHash() {
		return "STALE", "REVIEWED_STACKUP_CHANGED"
	}
	if rh == "" {
		return "UNKNOWN", "ROUTING_RULES_UNAVAILABLE"
	}
	if p.RulesHash != rh {
		return "STALE", "ROUTING_RULES_CHANGED"
	}
	if p.ObservedLayersHash == "" || len(s.Layers) == 0 {
		return "UNKNOWN", "COPPER_LAYER_INVENTORY_UNAVAILABLE"
	}
	if ProfileLayersHash(Snapshot{Layers: p.LayerOrder}) != ProfileLayersHash(s) {
		return "STALE", "REVIEWED_LAYER_INVENTORY_MISMATCH"
	}
	if p.ObservedLayersHash != ProfileLayersHash(s) {
		return "STALE", "COPPER_LAYER_INVENTORY_CHANGED"
	}
	if !p.Reviewed || p.SourceKind != "manufacturer" || p.Evidence == "" {
		return "UNVERIFIED", "MANUFACTURER_REVIEW_REQUIRED"
	}
	return "MANUFACTURER_VERIFIED", ""
}
func (p RoutingProfile) CheckRoute(r Route) error {
	if r.Layer != p.SignalLayer || r.Width != p.Width {
		return fmt.Errorf("route layer/width differs from reviewed profile")
	}
	return nil
}

// Tokens contain physical stackup and routing rules, never the board revision.
// Missing authoritative data is UNKNOWN; an empty object is not evidence.
func ProfileTokens(s Snapshot) (string, string) {
	token := func(raw json.RawMessage) string {
		raw = bytes.TrimSpace(raw)
		if len(raw) == 0 || bytes.Equal(raw, []byte("null")) || bytes.Equal(raw, []byte("{}")) || bytes.Equal(raw, []byte("[]")) {
			return ""
		}
		var v any
		if json.Unmarshal(raw, &v) != nil {
			return ""
		}
		return Hash(v)
	}
	physical := token(s.PhysicalStackup)
	if physical != "" {
		physical = Hash(struct {
			Physical string
			Layers   []int
		}{physical, s.Layers})
	}
	return physical, token(s.Rules)
}
