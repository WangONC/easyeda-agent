package fastpath

import (
	"fmt"
	"math"
)

const MaxPlacements = 256

type Placement struct {
	PrimitiveID string  `json:"primitiveId"`
	X           float64 `json:"x"`
	Y           float64 `json:"y"`
	Rotation    float64 `json:"rotation"`
	Layer       int     `json:"layer"`
	Locked      *bool   `json:"locked,omitempty"`
}

type PlacementConflict struct {
	Candidate int    `json:"candidate_index"`
	Primitive string `json:"primitiveId"`
	Obstacle  string `json:"obstacle_id,omitempty"`
	Type      string `json:"type"`
}

type PlacementCheck struct {
	OK           bool                `json:"ok"`
	BaseRevision string              `json:"base_revision"`
	PlanHash     string              `json:"plan_hash"`
	Placements   []Placement         `json:"placements"`
	Conflicts    []PlacementConflict `json:"conflicts"`
	AffectedBBox *Box                `json:"affected_bbox,omitempty"`
}

func NormalizeRotation(v float64) float64 {
	v = math.Mod(v, 360)
	if v < 0 {
		v += 360
	}
	if v == 0 {
		return 0
	}
	return v
}

func ValidatePlacements(ps []Placement) error {
	if len(ps) < 1 || len(ps) > MaxPlacements {
		return fmt.Errorf("placements must contain 1..%d items", MaxPlacements)
	}
	seen := map[string]bool{}
	for i := range ps {
		p := &ps[i]
		if p.PrimitiveID == "" || seen[p.PrimitiveID] || !finite(p.X) || !finite(p.Y) || !finite(p.Rotation) || (p.Layer != 1 && p.Layer != 2) {
			return fmt.Errorf("invalid explicit placement %d", i)
		}
		seen[p.PrimitiveID] = true
		p.Rotation = NormalizeRotation(p.Rotation)
	}
	return nil
}

func placementBox(old Primitive, p Placement) (Box, bool) {
	if old.BBox == nil || !ValidBox(old.BBox) {
		return Box{}, false
	}
	b := *old.BBox
	corners := []Point{{b[0], b[1]}, {b[2], b[1]}, {b[2], b[3]}, {b[0], b[3]}}
	a := (p.Rotation - old.Rotation) * math.Pi / 180
	ca, sa := math.Cos(a), math.Sin(a)
	out := Box{math.Inf(1), math.Inf(1), math.Inf(-1), math.Inf(-1)}
	for _, q := range corners {
		dx, dy := q[0]-old.X, q[1]-old.Y
		x, y := p.X+dx*ca-dy*sa, p.Y+dx*sa+dy*ca
		out[0] = math.Min(out[0], x)
		out[1] = math.Min(out[1], y)
		out[2] = math.Max(out[2], x)
		out[3] = math.Max(out[3], y)
	}
	return out, ValidBox(&out)
}

func pointInRing(p Point, ring []Point) bool {
	inside := false
	for i, j := 0, len(ring)-1; i < len(ring); j, i = i, i+1 {
		a, b := ring[i], ring[j]
		if ((a[1] > p[1]) != (b[1] > p[1])) && p[0] < (b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0] {
			inside = !inside
		}
	}
	return inside
}

func boxInsideRing(b Box, ring []Point) bool {
	return len(ring) >= 3 && pointInRing(Point{b[0], b[1]}, ring) && pointInRing(Point{b[2], b[1]}, ring) && pointInRing(Point{b[2], b[3]}, ring) && pointInRing(Point{b[0], b[3]}, ring)
}

// PlacementPreflight checks only caller supplied poses. It never searches for,
// snaps, rotates, moves, or selects a layer for a component.
func PlacementPreflight(s Snapshot, base string, placements []Placement) (PlacementCheck, error) {
	c := PlacementCheck{BaseRevision: s.Revision, Placements: placements, Conflicts: []PlacementConflict{}}
	if base == "" || base != s.Revision {
		return c, fmt.Errorf("STALE_REVISION")
	}
	if err := ValidatePlacements(placements); err != nil {
		return c, err
	}
	c.Placements = placements
	byID := map[string]Primitive{}
	for _, p := range s.Components {
		byID[p.ID] = p
	}
	outline := []Point(nil)
	outlineUnsupported := false
	for _, f := range s.Fills {
		if f.Kind == "board_edge" {
			if f.Unsupported || len(f.Rings) != 1 {
				outlineUnsupported = true
			} else if outline != nil {
				outlineUnsupported = true
			} else {
				outline = f.Rings[0]
			}
		}
	}
	targets := map[string]bool{}
	boxes := make([]Box, len(placements))
	valid := make([]bool, len(placements))
	add := func(i int, id, obstacle, kind string) {
		c.Conflicts = append(c.Conflicts, PlacementConflict{i, id, obstacle, kind})
	}
	touch := func(b Box) {
		if c.AffectedBBox == nil {
			x := b
			c.AffectedBBox = &x
			return
		}
		for k := 0; k < 2; k++ {
			c.AffectedBBox[k] = math.Min(c.AffectedBBox[k], b[k])
			c.AffectedBBox[k+2] = math.Max(c.AffectedBBox[k+2], b[k+2])
		}
	}
	for i, p := range placements {
		targets[p.PrimitiveID] = true
		old, ok := byID[p.PrimitiveID]
		if !ok {
			add(i, p.PrimitiveID, "", "missing_component")
			continue
		}
		if old.BBox != nil {
			touch(*old.BBox)
		}
		if old.Locked && (old.X != p.X || old.Y != p.Y || NormalizeRotation(old.Rotation) != p.Rotation || old.Layer != p.Layer || (p.Locked != nil && !*p.Locked)) {
			add(i, p.PrimitiveID, "", "locked_component")
		}
		b, ok := placementBox(old, p)
		if !ok {
			add(i, p.PrimitiveID, "", "component_bbox_unavailable")
			continue
		}
		boxes[i] = b
		valid[i] = true
		touch(b)
		if outlineUnsupported || outline == nil {
			add(i, p.PrimitiveID, "", "outline_unavailable")
		} else if !boxInsideRing(b, outline) {
			add(i, p.PrimitiveID, "", "board_boundary")
		}
	}
	for i, p := range placements {
		if !valid[i] {
			continue
		}
		for _, o := range s.Components {
			if targets[o.ID] || o.Layer != p.Layer {
				continue
			}
			if o.BBox == nil || !ValidBox(o.BBox) {
				add(i, p.PrimitiveID, o.ID, "component_bbox_unavailable")
				continue
			}
			if overlap(boxes[i], *o.BBox) {
				add(i, p.PrimitiveID, o.ID, "component_overlap")
			}
		}
		for _, o := range s.Fills {
			if o.Kind != "region" || !has(o.RuleTypes, 2) {
				continue
			}
			if o.Unsupported {
				add(i, p.PrimitiveID, o.ID, "keepout_unavailable")
				continue
			}
			if overlap(boxes[i], Bounds(o)) {
				add(i, p.PrimitiveID, o.ID, "component_keepout")
			}
		}
		for j := 0; j < i; j++ {
			if valid[j] && placements[j].Layer == p.Layer && overlap(boxes[i], boxes[j]) {
				add(i, p.PrimitiveID, placements[j].PrimitiveID, "candidate_overlap")
			}
		}
	}
	c.OK = len(c.Conflicts) == 0
	c.PlanHash = Hash(struct {
		Base       string
		Placements []Placement
	}{base, placements})
	return c, nil
}
