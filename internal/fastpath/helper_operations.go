package fastpath

// HelperOperations mechanically expands a helper's explicit plan for apply.
// These helpers can only replace selected straight traces, never delete vias.
// It does not create a receipt: the same plan still requires normal preflight.
func HelperOperations(p Plan) ([]Operation, error) {
	ops := []Operation{}
	for _, id := range p.DeleteIDs {
		ops = append(ops, Operation{Type: "delete_trace", ID: id})
	}
	for _, r := range p.Routes {
		if r.ArcAngle != 0 {
			ops = append(ops, Operation{Type: "add_arc", Net: r.Net, Layer: r.Layer, Width: r.Width, Points: r.Points, ArcAngle: r.ArcAngle})
			continue
		}
		for i := 1; i < len(r.Points); i++ {
			ops = append(ops, Operation{Type: "add_trace", Net: r.Net, Layer: r.Layer, Width: r.Width, Points: []Point{r.Points[i-1], r.Points[i]}})
		}
	}
	for _, v := range p.Vias {
		ops = append(ops, Operation{Type: "add_via", Net: v.Net, X: v.X, Y: v.Y, Diameter: v.Diameter, Hole: v.Hole, From: v.From, To: v.To})
	}
	return ops, ValidateOperations(ops)
}
