package fastpath

import "math"

// Native IPCB_ComplexPolygon uses nonzero winding, not even/odd parity.
func filledAt(p Point, rings [][]Point) bool {
	winding := 0
	for _, ring := range rings {
		for i, a := range ring {
			b := ring[(i+1)%len(ring)]
			if a[1] <= p[1] {
				if b[1] > p[1] && cross(a, b, p) > 0 {
					winding++
				}
			} else if b[1] <= p[1] && cross(a, b, p) < 0 {
				winding--
			}
		}
	}
	return winding != 0
}
func validRings(rings [][]Point) bool {
	if len(rings) == 0 || len(rings) > 1024 {
		return false
	}
	total := 0
	for _, ring := range rings {
		if len(ring) < 3 {
			return false
		}
		total += len(ring)
		if total > 32768 {
			return false
		}
		area := 0.0
		for i, p := range ring {
			q := ring[(i+1)%len(ring)]
			area += p[0]*q[1] - q[0]*p[1]
			if !finite(p[0]) || !finite(p[1]) {
				return false
			}
		}
		if !finite(area) || math.Abs(area) < 1e-12 {
			return false
		}
	}
	return true
}
func polygonClearance(a, b Primitive) float64 {
	a1, a2, r := centerLine(a)
	inside1, inside2 := filledAt(a1, b.Rings), filledAt(a2, b.Rings)
	if b.Kind == "board_edge" {
		if !inside1 || !inside2 {
			return -r
		}
	} else if inside1 || inside2 {
		return -r
	}
	d := math.Inf(1)
	for _, ring := range b.Rings {
		for i, p := range ring {
			d = math.Min(d, segDist(a1, a2, p, ring[(i+1)%len(ring)]))
		}
	}
	// A chord approximation can move either boundary (outer or hole); reserve
	// the error on both sides. This deliberately shrinks usable gaps.
	return d - r - b.Width/2 - b.ProjectionError
}

type GeometryCoverage struct {
	Supported    int  `json:"supported"`
	Conservative int  `json:"conservative"`
	Unsupported  int  `json:"unsupported"`
	Complete     bool `json:"complete"`
}

func coverage(s Snapshot) GeometryCoverage {
	c := GeometryCoverage{Complete: true}
	for _, group := range [][]Primitive{s.Pads, s.Traces, s.Vias, s.Fills} {
		for _, p := range group {
			if p.Layer != 12 && !has(s.Layers, p.Layer) {
				continue
			}
			if p.Unsupported {
				c.Unsupported++
				c.Complete = false
			} else if p.Coverage == "conservative" || p.ProjectionError > 0 {
				c.Conservative++
			} else {
				c.Supported++
			}
		}
	}
	return c
}
