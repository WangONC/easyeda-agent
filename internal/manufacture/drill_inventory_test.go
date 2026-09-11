package manufacture

import (
	"encoding/json"
	"os"
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

func TestHostZeroHoleReadbackQualifiesOriginalArchive(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("testdata", "round3-host", "zero-hole-readback.json"))
	if err != nil {
		t.Fatal(err)
	}
	var h struct {
		Protocol    string `json:"protocol"`
		OperationID string `json:"operation_id"`
		Target      struct {
			Project  string `json:"project_uuid"`
			Document string `json:"document_uuid"`
			Type     string `json:"document_type"`
		} `json:"target_ref"`
		Evidence struct {
			Snapshot struct {
				Drills *DrillInventory `json:"drill_inventory"`
			} `json:"snapshot"`
		} `json:"evidence"`
	}
	if err = json.Unmarshal(raw, &h); err != nil {
		t.Fatal(err)
	}
	if h.Protocol != "execution.v2" || h.OperationID != "cc323647-a10e-411c-b54c-b4760ee3349c" || h.Target.Project != "e7c288be345149da97a48a8b908c2049" || h.Target.Document != "a61d7f82ce7bb900" || h.Target.Type != "pcb" {
		t.Fatal("foreign fixture")
	}
	result, err := Inspect(ArtifactRef{Kind: "manufacturing_gerber", Path: filepath.Join("testdata", "round3-host", "gerber.zip"), ObservedDrills: h.Evidence.Snapshot.Drills})
	if err != nil || result["structure_verified"] != true || result["sha256"] != "84c67d1b72bdb1e6d68596190e67f6204e5d419bf218111cfeee7dcf3da2ed3f" {
		t.Fatal(result, err)
	}
}
