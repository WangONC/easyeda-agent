package fastpath

import (
	"encoding/json"
	"fmt"
)

func (p *Point) UnmarshalJSON(data []byte) error {
	var nullable []*float64
	if err := json.Unmarshal(data, &nullable); err != nil {
		return err
	}
	for _, n := range nullable {
		if n == nil {
			return fmt.Errorf("null coordinate")
		}
	}
	var xs []float64
	if err := json.Unmarshal(data, &xs); err != nil {
		return err
	}
	if len(xs) != 2 || !finite(xs[0]) || !finite(xs[1]) {
		return fmt.Errorf("point must contain exactly two finite coordinates")
	}
	*p = Point{xs[0], xs[1]}
	return nil
}
func (b *Box) UnmarshalJSON(data []byte) error {
	var nullable []*float64
	if err := json.Unmarshal(data, &nullable); err != nil {
		return err
	}
	for _, n := range nullable {
		if n == nil {
			return fmt.Errorf("null coordinate")
		}
	}
	var xs []float64
	if err := json.Unmarshal(data, &xs); err != nil {
		return err
	}
	if len(xs) != 4 {
		return fmt.Errorf("bbox must contain four coordinates")
	}
	*b = Box{xs[0], xs[1], xs[2], xs[3]}
	if !ValidBox(b) {
		return fmt.Errorf("invalid bbox")
	}
	return nil
}

// Require explicitly supplied zero-valued via coordinates too. Numeric zero is
// geometry, not an invitation to default a missing coordinate.
func ExplicitViaCoordinates(payload map[string]any, field string) error {
	b, e := json.Marshal(payload[field])
	if e != nil {
		return e
	}
	var items []map[string]any
	if e = json.Unmarshal(b, &items); e != nil {
		return e
	}
	for i, o := range items {
		if field == "operations" && o["type"] != "add_via" {
			continue
		}
		for _, k := range []string{"x", "y", "diameter", "hole", "from_layer", "to_layer", "net"} {
			if o[k] == nil {
				return fmt.Errorf("%s[%d].%s must be explicit", field, i, k)
			}
		}
	}
	return nil
}
