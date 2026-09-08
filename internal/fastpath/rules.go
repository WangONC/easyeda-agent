package fastpath

import "encoding/json"

// Selected live-rule projection follows the same EasyEDA paths and mm->mil
// conversion as app/pcb_rules.go. Unlike planner defaults it fails closed when
// incomplete. Taking the matrix maximum and default via size is conservative.
// Per-net/class constraints are not inferred; supply a reviewed profile for them.
func LiveProfile(raw json.RawMessage) *Rules {
	var root any
	if json.Unmarshal(raw, &root) != nil {
		return nil
	}
	nav := func(v any, keys ...string) any {
		for _, k := range keys {
			m, ok := v.(map[string]any)
			if !ok {
				return nil
			}
			v = m[k]
		}
		return v
	}
	number := func(v any) float64 { n, _ := v.(float64); return n * 39.37007874 }
	cfg := nav(root, "config")
	data := nav(cfg, "Physics", "Track", "copperThickness1oz", "form", "data")
	var entry any
	if rows, ok := data.([]any); ok && len(rows) > 0 {
		entry = rows[0]
	}
	if rows, ok := data.(map[string]any); ok {
		entry = rows["1"]
	}
	r := &Rules{MinWidth: number(nav(entry, "minValue"))}
	form := nav(cfg, "Physics", "Via Size", "viaSize", "form")
	r.MinHole = number(nav(form, "viaInnerdiameterDefault"))
	r.MinDiameter = number(nav(form, "viaOuterdiameterDefault"))
	r.MinAnnulus = (r.MinDiameter - r.MinHole) / 2
	if rows, ok := nav(cfg, "Spacing", "Safe Spacing", "copperThickness1oz", "tables", "1", "content").([]any); ok {
		for _, row := range rows {
			if cols, ok := row.([]any); ok {
				for _, v := range cols {
					if n := number(v); n > r.Clearance {
						r.Clearance = n
					}
				}
			}
		}
	}
	for _, v := range []float64{r.Clearance, r.MinWidth, r.MinHole, r.MinDiameter, r.MinAnnulus} {
		if !finite(v) || v <= 0 {
			return nil
		}
	}
	return r
}
