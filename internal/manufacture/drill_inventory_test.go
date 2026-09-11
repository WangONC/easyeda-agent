package manufacture

import (
	"path/filepath"
	"testing"
)

func TestActualNoDrillArchiveRequiresObservedZero(t *testing.T) {
	n := func(v int) *int { return &v }
	for _, mode := range []string{"absent", "zero", "incomplete", "missing-field", "missing-pad", "positive-pth", "positive-npth"} {
		t.Run(mode, func(t *testing.T) {
			d := &DrillInventory{Complete: true, PadCount: n(4), PadsWithoutHoles: n(4), ViaCount: n(0), PTHCount: n(0), NPTHCount: n(0)}
			switch mode {
			case "absent":
				d = nil
			case "incomplete":
				d.Complete = false
			case "missing-field":
				d.ViaCount = nil
			case "missing-pad":
				d.PadCount = n(5)
			case "positive-pth":
				d.PadsWithoutHoles = n(3)
				d.PTHCount = n(1)
			case "positive-npth":
				d.PadsWithoutHoles = n(3)
				d.NPTHCount = n(1)
			}
			result, err := Inspect(ArtifactRef{Kind: "manufacturing_gerber", Path: filepath.Join("testdata", "round3-host", "gerber.zip"), ObservedDrills: d})
			if mode == "zero" {
				if err != nil || result["structure_verified"] != true || result["pth_hole_count"] != 0 || result["npth_hole_count"] != 0 {
					t.Fatal(result, err)
				}
			} else if err == nil {
				t.Fatal("missing drill accepted without complete zero", result)
			}
		})
	}
}
