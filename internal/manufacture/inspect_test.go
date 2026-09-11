package manufacture

import (
	"archive/zip"
	"os"
	"path/filepath"
	"testing"
)

func TestMissingDrillInventoryIsNotObservedZero(t *testing.T) {
	for _, present := range []bool{false, true} {
		t.Run(map[bool]string{false: "missing", true: "explicit_empty"}[present], func(t *testing.T) {
			name := filepath.Join(t.TempDir(), "native.zip")
			f, err := os.Create(name)
			if err != nil {
				t.Fatal(err)
			}
			z := zip.NewWriter(f)
			entries := map[string]string{"Gerber_TopLayer.GTL": "%FSLAX46Y46*%\nM02*"}
			if present {
				entries["PTH.drl"] = "M48\nMETRIC,LZ,0000.000000\n%\nM30"
				entries["NPTH.drl"] = entries["PTH.drl"]
			}
			for k, v := range entries {
				w, e := z.Create(k)
				if e != nil {
					t.Fatal(e)
				}
				if _, e = w.Write([]byte(v)); e != nil {
					t.Fatal(e)
				}
			}
			if e := z.Close(); e != nil {
				t.Fatal(e)
			}
			if e := f.Close(); e != nil {
				t.Fatal(e)
			}
			got, err := Inspect(ArtifactRef{Kind: "manufacturing_gerber", Path: name, FileName: "native.zip"})
			if err == nil || got["structure_verified"] != false {
				t.Fatal("unproven absence certified", got, err)
			}
			for _, key := range []string{"pth_hole_count", "npth_hole_count"} {
				if present {
					if got[key] != 0 {
						t.Fatal(key, got[key])
					}
				} else if got[key] != nil {
					t.Fatal("missing became zero", key, got[key])
				}
			}
		})
	}
}

func TestActualRound3HostManufacturingArtifacts(t *testing.T) {
	for _, item := range []struct {
		kind, name, sha string
		valid           bool
	}{
		{"manufacturing_gerber", "gerber.zip", "84c67d1b72bdb1e6d68596190e67f6204e5d419bf218111cfeee7dcf3da2ed3f", false},
		{"manufacturing_bom", "bom.csv", "4b59302fed694376f27ae1e8160838a05919124a68667ccc85fff4de292cfa83", true},
		{"manufacturing_pnp", "pnp.csv", "2c905ffe20b299e5fff9266127d2367030e34c4efbaf77d4d1fb59c9ed01b5f1", true},
	} {
		t.Run(item.kind, func(t *testing.T) {
			got, err := Inspect(ArtifactRef{Kind: item.kind, Path: filepath.Join("testdata", "round3-host", item.name), FileName: item.name})
			if (err == nil) != item.valid || got["structure_verified"] != item.valid || got["sha256"] != item.sha {
				t.Fatal(got, err)
			}
			switch item.kind {
			case "manufacturing_gerber":
				if got["pth_hole_count"] != nil || got["npth_hole_count"] != nil {
					t.Fatal("missing is not zero", got)
				}
			case "manufacturing_bom":
				if got["component_count"] != 2 || got["row_count"] != 1 {
					t.Fatal(got)
				}
			case "manufacturing_pnp":
				if got["placement_count"] != 2 || got["units"] != "mm" {
					t.Fatal(got)
				}
			}
		})
	}
}
