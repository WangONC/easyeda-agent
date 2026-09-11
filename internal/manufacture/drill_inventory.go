package manufacture

// DrillInventory is authored by native getters before serialization. It proves
// observed zero categories only; it is not a general DFM or positive-hole mapping.
type DrillInventory struct {
	Complete         bool `json:"complete"`
	PadCount         *int `json:"pad_count"`
	PadsWithoutHoles *int `json:"pads_without_holes"`
	ViaCount         *int `json:"via_count"`
	PTHCount         *int `json:"pth_count"`
	NPTHCount        *int `json:"npth_count"`
}

func (d *DrillInventory) Valid() bool {
	if d == nil || !d.Complete {
		return false
	}
	for _, n := range []*int{d.PadCount, d.PadsWithoutHoles, d.ViaCount, d.PTHCount, d.NPTHCount} {
		if n == nil || *n < 0 || *n > 10000000 {
			return false
		}
	}
	return *d.PadsWithoutHoles <= *d.PadCount && *d.ViaCount <= *d.PTHCount && *d.PadsWithoutHoles+*d.PTHCount+*d.NPTHCount == *d.PadCount+*d.ViaCount
}
