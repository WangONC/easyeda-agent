package fastpath

// Fast Path V0.1 checks caller-supplied geometry; it never generates a path.
import (
	"encoding/json"
	"fmt"
	"github.com/zhoushoujianwork/easyeda-agent/internal/workflow"
	"math"
	"sort"
)

const Capability = "pcb.fast_manual.v0.1"
const MaxOperations = 512

type Point [2]float64
type Box [4]float64

// Primitive is an observation, not a native EasyEDA object. Layer 12 means all copper.
type Primitive struct {
	ID          string  `json:"id"`
	Kind        string  `json:"kind"`
	Net         string  `json:"net,omitempty"`
	Layer       int     `json:"layer,omitempty"`
	Points      []Point `json:"points,omitempty"`
	Width       float64 `json:"width,omitempty"`
	X           float64 `json:"x,omitempty"`
	Y           float64 `json:"y,omitempty"`
	Diameter    float64 `json:"diameter,omitempty"`
	Hole        float64 `json:"hole,omitempty"`
	BBox        *Box    `json:"bbox,omitempty"`
	Locked      bool    `json:"locked,omitempty"`
	Unsupported bool    `json:"unsupported,omitempty"`
	Designator  string  `json:"designator,omitempty"`
	Rotation    float64 `json:"rotation,omitempty"`
	ComponentID string  `json:"component_id,omitempty"`
}
type Snapshot struct {
	RuleProfile  *Rules          `json:"rule_profile,omitempty"`
	Outline      map[string]any  `json:"outline_fingerprint_input,omitempty"`
	Revision     string          `json:"board_revision"`
	Components   []Primitive     `json:"components"`
	Pads         []Primitive     `json:"pads"`
	Traces       []Primitive     `json:"traces"`
	Vias         []Primitive     `json:"vias"`
	Fills        []Primitive     `json:"fills"`
	Layers       []int           `json:"copper_layers,omitempty"`
	Rules        json.RawMessage `json:"rules,omitempty"`
	GeometryHash string          `json:"geometry_hash"`
	Scope        Scope           `json:"scope"`
	Warnings     []string        `json:"warnings,omitempty"`
}
type Scope struct {
	Nets    []string        `json:"nets,omitempty"`
	BBox    *Box            `json:"bbox,omitempty"`
	Layers  []int           `json:"layers,omitempty"`
	Include map[string]bool `json:"include,omitempty"`
}
type Route struct {
	Net    string  `json:"net"`
	Layer  int     `json:"layer"`
	Width  float64 `json:"width"`
	Points []Point `json:"points"`
}
type Via struct {
	Net      string  `json:"net"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Diameter float64 `json:"diameter"`
	Hole     float64 `json:"hole"`
	From     int     `json:"from_layer"`
	To       int     `json:"to_layer"`
}
type Operation struct {
	Type     string  `json:"type"`
	ID       string  `json:"id,omitempty"`
	Net      string  `json:"net,omitempty"`
	Layer    int     `json:"layer,omitempty"`
	Width    float64 `json:"width,omitempty"`
	Points   []Point `json:"points,omitempty"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Diameter float64 `json:"diameter,omitempty"`
	Hole     float64 `json:"hole,omitempty"`
	From     int     `json:"from_layer,omitempty"`
	To       int     `json:"to_layer,omitempty"`
}
type Rules struct {
	Clearance   float64 `json:"clearance"`
	MinWidth    float64 `json:"min_width"`
	MinHole     float64 `json:"min_hole"`
	MinDiameter float64 `json:"min_diameter"`
	MinAnnulus  float64 `json:"min_annulus"`
}
type Plan struct {
	Base          string   `json:"base_revision"`
	Routes        []Route  `json:"routes"`
	Vias          []Via    `json:"vias"`
	DeleteIDs     []string `json:"delete_ids,omitempty"`
	ProtectedNets []string `json:"protected_nets,omitempty"`
	Profile       *Rules   `json:"clearance_profile,omitempty"`
}
type Conflict struct {
	Candidate int     `json:"candidate_index"`
	Obstacle  string  `json:"obstacle_id"`
	Net       string  `json:"obstacle_net"`
	Layer     int     `json:"layer"`
	Type      string  `json:"type"`
	Required  float64 `json:"required_clearance"`
	Actual    float64 `json:"actual_clearance"`
}
type Check struct {
	OK         bool        `json:"ok"`
	Revision   string      `json:"board_revision"`
	Hash       string      `json:"plan_hash"`
	BBox       *Box        `json:"affected_bbox"`
	Nets       []string    `json:"touched_nets"`
	Conflicts  []Conflict  `json:"conflicts"`
	Truncated  bool        `json:"conflicts_truncated,omitempty"`
	Warnings   []string    `json:"warnings,omitempty"`
	Operations []Operation `json:"-"`
}

func Hash(v any) string {
	h, e := workflow.HashJSON(v)
	if e != nil {
		panic(e)
	}
	return h
}
func Decode(v any, out any) error {
	b, e := json.Marshal(v)
	if e != nil {
		return e
	}
	return json.Unmarshal(b, out)
}
func has[T comparable](xs []T, v T) bool {
	for _, x := range xs {
		if x == v {
			return true
		}
	}
	return false
}
func finite(v float64) bool { return !math.IsNaN(v) && !math.IsInf(v, 0) && math.Abs(v) < 1e8 }
func ValidBox(b *Box) bool {
	return b == nil || (finite(b[0]) && finite(b[1]) && finite(b[2]) && finite(b[3]) && b[0] <= b[2] && b[1] <= b[3])
}
func Bounds(p Primitive) Box {
	if p.BBox != nil {
		return *p.BBox
	}
	r := p.Diameter / 2
	b := Box{p.X - r, p.Y - r, p.X + r, p.Y + r}
	if len(p.Points) > 0 {
		b = Box{p.Points[0][0], p.Points[0][1], p.Points[0][0], p.Points[0][1]}
		for _, pt := range p.Points {
			b[0] = math.Min(b[0], pt[0])
			b[1] = math.Min(b[1], pt[1])
			b[2] = math.Max(b[2], pt[0])
			b[3] = math.Max(b[3], pt[1])
		}
		for i := 0; i < 2; i++ {
			b[i] -= p.Width / 2
			b[i+2] += p.Width / 2
		}
	}
	return b
}
func overlap(a, b Box) bool   { return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1] }
func sameLayer(a, b int) bool { return a == b || a == 12 || b == 12 }
func Filter(s Snapshot, scope Scope) (Snapshot, error) {
	if !ValidBox(scope.BBox) {
		return Snapshot{}, fmt.Errorf("invalid bbox [minX,minY,maxX,maxY]")
	}
	out := s
	out.Scope = scope
	out.RuleProfile = LiveProfile(s.Rules)
	out.Rules = nil
	out.Outline = nil
	groups := []struct {
		name string
		src  []Primitive
		dst  *[]Primitive
	}{{"components", s.Components, &out.Components}, {"pads", s.Pads, &out.Pads}, {"traces", s.Traces, &out.Traces}, {"vias", s.Vias, &out.Vias}, {"fills", s.Fills, &out.Fills}}
	for _, g := range groups {
		*g.dst = []Primitive{}
		if len(scope.Include) > 0 && !scope.Include[g.name] {
			continue
		}
		for _, p := range g.src {
			netOK := len(scope.Nets) == 0 || has(scope.Nets, p.Net)
			if p.Kind == "component" && !netOK {
				for _, pad := range s.Pads {
					if pad.ComponentID == p.ID && has(scope.Nets, pad.Net) {
						netOK = true
						break
					}
				}
			}
			if !netOK {
				continue
			}
			if len(scope.Layers) > 0 && p.Layer != 12 && !has(scope.Layers, p.Layer) {
				continue
			}
			if scope.BBox != nil && !p.Unsupported && !overlap(Bounds(p), *scope.BBox) {
				continue
			}
			*g.dst = append(*g.dst, p)
		}
		sort.Slice(*g.dst, func(i, j int) bool { return (*g.dst)[i].ID < (*g.dst)[j].ID })
	}
	out.GeometryHash = Hash([]any{out.Components, out.Pads, out.Traces, out.Vias, out.Fills})
	return out, nil
}
func ValidateOperations(ops []Operation) error {
	if len(ops) == 0 || len(ops) > MaxOperations {
		return fmt.Errorf("operations must contain 1..%d items", MaxOperations)
	}
	ids := map[string]bool{}
	for i, o := range ops {
		bad := func() error { return fmt.Errorf("invalid explicit operation %d (%s)", i, o.Type) }
		switch o.Type {
		case "add_trace":
			if o.Net == "" || o.Layer <= 0 || !finite(o.Width) || o.Width <= 0 || len(o.Points) != 2 || o.Points[0] == o.Points[1] || o.ID != "" || o.Diameter != 0 || o.Hole != 0 || o.From != 0 || o.To != 0 || o.X != 0 || o.Y != 0 {
				return bad()
			}
			for _, p := range o.Points {
				if !finite(p[0]) || !finite(p[1]) {
					return bad()
				}
			}
		case "add_via":
			if o.Net == "" || !finite(o.X) || !finite(o.Y) || !finite(o.Diameter) || !finite(o.Hole) || o.Hole <= 0 || o.Diameter <= o.Hole || !((o.From == 1 && o.To == 2) || (o.From == 2 && o.To == 1)) || o.Layer != 0 || o.Width != 0 || len(o.Points) != 0 || o.ID != "" {
				return bad()
			}
		case "delete_trace", "delete_via":
			if o.ID == "" || ids[o.ID] || o.Net != "" || o.Layer != 0 || o.Width != 0 || len(o.Points) != 0 || o.Diameter != 0 || o.Hole != 0 || o.X != 0 || o.Y != 0 || o.From != 0 || o.To != 0 {
				return bad()
			}
			ids[o.ID] = true
		default:
			return bad()
		}
	}
	return nil
}
func OperationPrimitive(o Operation) Primitive {
	if o.Type == "add_trace" {
		return Primitive{Kind: "trace", Net: o.Net, Layer: o.Layer, Width: o.Width, Points: o.Points}
	}
	return Primitive{Kind: "via", Net: o.Net, Layer: 12, X: o.X, Y: o.Y, Diameter: o.Diameter, Hole: o.Hole}
}

// Distances use the existing pcb_check capsule/segment and conservative pad-box model.
func pointSeg(p, a, b Point) float64 {
	dx, dy := b[0]-a[0], b[1]-a[1]
	d := dx*dx + dy*dy
	t := 0.0
	if d > 0 {
		t = math.Max(0, math.Min(1, ((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d))
	}
	return math.Hypot(p[0]-a[0]-t*dx, p[1]-a[1]-t*dy)
}
func cross(a, b, c Point) float64 { return (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0]) }
func segDist(a, b, c, d Point) float64 {
	if cross(a, b, c)*cross(a, b, d) <= 0 && cross(c, d, a)*cross(c, d, b) <= 0 && overlap(Box{math.Min(a[0], b[0]), math.Min(a[1], b[1]), math.Max(a[0], b[0]), math.Max(a[1], b[1])}, Box{math.Min(c[0], d[0]), math.Min(c[1], d[1]), math.Max(c[0], d[0]), math.Max(c[1], d[1])}) {
		return 0
	}
	return math.Min(math.Min(pointSeg(a, c, d), pointSeg(b, c, d)), math.Min(pointSeg(c, a, b), pointSeg(d, a, b)))
}
func centerLine(p Primitive) (Point, Point, float64) {
	if p.Kind == "trace" && len(p.Points) == 2 {
		return p.Points[0], p.Points[1], p.Width / 2
	}
	q := Point{p.X, p.Y}
	return q, q, p.Diameter / 2
}
func clearance(a, b Primitive) float64 {
	a1, a2, r := centerLine(a)
	if b.Kind == "trace" || b.Kind == "via" {
		b1, b2, rb := centerLine(b)
		return segDist(a1, a2, b1, b2) - r - rb
	}
	box := Bounds(b)
	pts := []Point{{box[0], box[1]}, {box[2], box[1]}, {box[2], box[3]}, {box[0], box[3]}}
	if (a1[0] >= box[0] && a1[0] <= box[2] && a1[1] >= box[1] && a1[1] <= box[3]) || (a2[0] >= box[0] && a2[0] <= box[2] && a2[1] >= box[1] && a2[1] <= box[3]) {
		return -r
	}
	d := math.Inf(1)
	for i := range pts {
		d = math.Min(d, segDist(a1, a2, pts[i], pts[(i+1)%4]))
	}
	return d - r
}
func Preflight(s Snapshot, p Plan) (Check, error) {
	c := Check{Revision: s.Revision, Nets: []string{}, Conflicts: []Conflict{}, Warnings: []string{"Local explicit-geometry check only; pad/fill boxes are conservative; no native DRC, plane connectivity or electrical proof."}}
	if p.Base == "" || p.Base != s.Revision {
		return c, fmt.Errorf("STALE_REVISION")
	}
	// V0.1 deliberately requires a selected numeric profile if live rule selection cannot be proven.
	if p.Profile == nil {
		p.Profile = LiveProfile(s.Rules)
	}
	if p.Profile == nil {
		return c, fmt.Errorf("RULE_PROFILE_REQUIRED: supply clearance_profile in mil from the selected board rules")
	}
	rule := *p.Profile
	for _, v := range []float64{rule.Clearance, rule.MinWidth, rule.MinHole, rule.MinDiameter, rule.MinAnnulus} {
		if !finite(v) || v <= 0 {
			return c, fmt.Errorf("invalid clearance_profile")
		}
	}
	obstacles := append(append(append(append([]Primitive{}, s.Traces...), s.Pads...), s.Vias...), s.Fills...)
	for i := range obstacles {
		o := &obstacles[i]
		if o.Kind == "trace" && (len(o.Points) != 2 || o.Width <= 0) {
			o.Unsupported = true
		}
		if o.Kind == "via" && o.Diameter <= 0 {
			o.Unsupported = true
		}
		if (o.Kind == "pad" || o.Kind == "fill") && (o.BBox == nil || !ValidBox(o.BBox)) {
			o.Unsupported = true
		}
	}
	byID := map[string]Primitive{}
	for _, o := range obstacles {
		byID[o.ID] = o
	}
	deleted := map[string]bool{}
	for _, id := range p.DeleteIDs {
		o, ok := byID[id]
		if !ok || (o.Kind != "trace" && o.Kind != "via") {
			return c, fmt.Errorf("delete id is not a trace/via: %s", id)
		}
		deleted[id] = true
		c.Operations = append(c.Operations, Operation{Type: "delete_" + o.Kind, ID: id})
	}
	for _, r := range p.Routes {
		if len(r.Points) < 2 {
			return c, fmt.Errorf("route requires >=2 points")
		}
		for i := 1; i < len(r.Points); i++ {
			c.Operations = append(c.Operations, Operation{Type: "add_trace", Net: r.Net, Layer: r.Layer, Width: r.Width, Points: []Point{r.Points[i-1], r.Points[i]}})
		}
	}
	for _, v := range p.Vias {
		c.Operations = append(c.Operations, Operation{Type: "add_via", Net: v.Net, X: v.X, Y: v.Y, Diameter: v.Diameter, Hole: v.Hole, From: v.From, To: v.To})
	}
	if err := ValidateOperations(c.Operations); err != nil {
		return c, err
	}
	addConflict := func(i int, o Primitive, kind string, required, actual float64) {
		if len(c.Conflicts) < 128 {
			c.Conflicts = append(c.Conflicts, Conflict{i, o.ID, o.Net, o.Layer, kind, required, math.Round(actual*1e6) / 1e6})
		} else {
			c.Truncated = true
		}
	}
	touch := func(o Primitive) {
		if o.Net != "" && !has(c.Nets, o.Net) {
			c.Nets = append(c.Nets, o.Net)
		}
		b := Bounds(o)
		if c.BBox == nil {
			c.BBox = &b
		} else {
			for k := 0; k < 2; k++ {
				c.BBox[k] = math.Min(c.BBox[k], b[k])
				c.BBox[k+2] = math.Max(c.BBox[k+2], b[k+2])
			}
		}
	}
	candidates := []Primitive{}
	indexes := []int{}
	for i, op := range c.Operations {
		if op.Type == "delete_trace" || op.Type == "delete_via" {
			o := byID[op.ID]
			touch(o)
			if o.Locked || has(p.ProtectedNets, o.Net) {
				addConflict(i, o, "protected_geometry", 0, 0)
			}
			if o.Kind == "trace" && !has(s.Layers, o.Layer) {
				addConflict(i, o, "invalid_layer", 0, 0)
			}
			continue
		}
		o := OperationPrimitive(op)
		touch(o)
		if has(p.ProtectedNets, o.Net) {
			addConflict(i, o, "protected_net", 0, 0)
		}
		if op.Type == "add_trace" {
			if !has(s.Layers, op.Layer) {
				addConflict(i, o, "invalid_layer", 0, 0)
			}
			if op.Width < rule.MinWidth {
				addConflict(i, o, "width_rule", rule.MinWidth, op.Width)
			}
		} else {
			if !has(s.Layers, 1) || !has(s.Layers, 2) {
				addConflict(i, o, "invalid_layer", 0, 0)
			}
			if op.Hole < rule.MinHole {
				addConflict(i, o, "via_hole_rule", rule.MinHole, op.Hole)
			}
			if op.Diameter < rule.MinDiameter {
				addConflict(i, o, "via_diameter_rule", rule.MinDiameter, op.Diameter)
			}
			if (op.Diameter-op.Hole)/2 < rule.MinAnnulus {
				addConflict(i, o, "via_annulus_rule", rule.MinAnnulus, (op.Diameter-op.Hole)/2)
			}
		}
		for _, b := range obstacles {
			if deleted[b.ID] || !sameLayer(o.Layer, b.Layer) || (!has(s.Layers, b.Layer) && b.Layer != 12) {
				continue
			}
			if b.Unsupported {
				addConflict(i, b, "unsupported_obstacle", rule.Clearance, 0)
				continue
			}
			d := clearance(o, b)
			if b.Net == o.Net && b.Net != "" {
				continue
			}
			if d+1e-7 < rule.Clearance {
				addConflict(i, b, o.Kind+"_"+b.Kind, rule.Clearance, d)
			}
		}
		for j, b := range candidates {
			if sameLayer(o.Layer, b.Layer) && o.Net != b.Net {
				d := clearance(o, b)
				if d+1e-7 < rule.Clearance {
					b.ID = fmt.Sprintf("candidate:%d", indexes[j])
					addConflict(i, b, o.Kind+"_"+b.Kind, rule.Clearance, d)
				}
			}
		}
		candidates = append(candidates, o)
		indexes = append(indexes, i)
	}
	// Endpoint evidence is intentionally advisory: an explicit isolated segment is legal.
	for j, o := range candidates {
		a, b, _ := centerLine(o)
		for _, pt := range []Point{a, b} {
			anchored := false
			q := Primitive{Kind: "via", Net: o.Net, Layer: o.Layer, X: pt[0], Y: pt[1]}
			for _, ob := range obstacles {
				if !deleted[ob.ID] && !ob.Unsupported && ob.Net == o.Net && sameLayer(o.Layer, ob.Layer) && (ob.Kind == "trace" || ob.Kind == "via" || ob.Kind == "pad") && clearance(q, ob) <= 1e-7 {
					anchored = true
					break
				}
			}
			for k, ob := range candidates {
				if k != j && ob.Net == o.Net && sameLayer(o.Layer, ob.Layer) && clearance(q, ob) <= 1e-7 {
					anchored = true
					break
				}
			}
			if !anchored {
				c.Warnings = append(c.Warnings, "Some explicit endpoints have no obvious same-net geometric anchor; this does not establish connectivity.")
				break
			}
		}
		if len(c.Warnings) > 1 {
			break
		}
	}
	sort.Strings(c.Nets)
	c.OK = len(c.Conflicts) == 0
	c.Hash = Hash(struct {
		Base       string
		Operations []Operation
		Profile    Rules
		Protected  []string
	}{p.Base, c.Operations, rule, p.ProtectedNets})
	return c, nil
}
