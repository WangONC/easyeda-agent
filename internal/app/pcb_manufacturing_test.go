package app

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"unicode/utf16"
)

func TestManufacturingInspectsActualFiles(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "gerber.zip")
	f, e := os.Create(path)
	if e != nil {
		t.Fatal(e)
	}
	w := zip.NewWriter(f)
	for name, text := range map[string]string{"Top.GTL": "%FSLAX46Y46*%\nM02*", "PTH.drl": "M48\nMETRIC,LZ,0000.000000\nT01C0.33\n%\nT01\nX1.0Y2.0\nM30", "NPTH.drl": "M48\nMETRIC,LZ,0000.000000\nT01C2.54\n%\nT01\nX9.0Y0\nM30"} {
		entry, e := w.Create(name)
		if e != nil {
			t.Fatal(e)
		}
		entry.Write([]byte(text))
	}
	w.Close()
	f.Close()
	r, e := inspectManufacturingFile(artifactRef{Path: path, Kind: "manufacturing_gerber"})
	if e != nil || r["structure_verified"] != true {
		t.Fatal(r, e)
	}
	data, _ := os.ReadFile(path)
	if r["pth_hole_count"] != 1 || r["npth_hole_count"] != 1 {
		t.Fatal("plating counts", r)
	}
	if r["sha256"] != fmt.Sprintf("%x", sha256.Sum256(data)) {
		t.Fatal("hash is not file SHA256")
	}
	path = filepath.Join(dir, "bom.csv")
	os.WriteFile(path, []byte("Designator,Quantity\nR1 R2,2\nC1,1\n"), 0600)
	r, e = inspectManufacturingFile(artifactRef{Path: path, Kind: "manufacturing_bom"})
	if e != nil || r["component_count"] != 3 || r["row_count"] != 2 {
		t.Fatal(r, e)
	}
	os.WriteFile(path, []byte("not a real CSV"), 0600)
	if _, e = inspectManufacturingFile(artifactRef{Path: path, Kind: "manufacturing_bom"}); e == nil {
		t.Fatal("unstructured data accepted")
	}
}

func TestHostUTF16TabExport(t *testing.T) {
	text := "Designator\tQuantity\nR1,R2\t2\n"
	units := utf16.Encode([]rune(text))
	b := make([]byte, 2+len(units)*2)
	b[0] = 255
	b[1] = 254
	for i, u := range units {
		binary.LittleEndian.PutUint16(b[2+i*2:], u)
	}
	path := filepath.Join(t.TempDir(), "bom.csv")
	os.WriteFile(path, b, 0600)
	r, e := inspectManufacturingFile(artifactRef{Path: path, Kind: "manufacturing_bom"})
	if e != nil || r["component_count"] != 2 || r["encoding"] != "UTF-16LE" || r["delimiter"] != "tab" {
		t.Fatal(r, e)
	}
}

func TestNativeDrillCountsFailClosed(t *testing.T) {
	prefix := "M48\nMETRIC,LZ,0000.000000\nT01C2.540000\n%\nG05\nG90\nT01\n"
	hits, e := nativeDrillHits(prefix + "X22.86Y0\nM30")
	if e != nil || len(hits) != 1 {
		t.Fatal(hits, e)
	}
	for _, bad := range []string{"X22860Y0", "G85X2.0Y3.0", "X22.86Y0\nX22.86Y0", "R2X1.0Y0"} {
		if _, e = nativeDrillHits(prefix + bad + "\nM30"); e == nil {
			t.Fatalf("accepted %s", bad)
		}
	}
	hits, e = nativeDrillHits(prefix + "M30")
	if e != nil || len(hits) != 0 {
		t.Fatal("empty program invented holes")
	}
}

func TestManufacturingDrillSubsetDedupAndEmptyRefusal(t *testing.T) {
	for _, empty := range []bool{false, true} {
		path := filepath.Join(t.TempDir(), "native.zip")
		f, _ := os.Create(path)
		w := zip.NewWriter(f)
		pth := ";TYPE=PLATED\nM48\nMETRIC,LZ,0000.000000\nT01C0.330200\n%\nG05\nG90\nT01\nX17.145Y10.16\nX18.415Y10.16\nM30"
		npth := "M48\nMETRIC,LZ,0000.000000\nT01C2.540000\n%\nG05\nG90\nT01\n"
		if !empty {
			npth += "X22.86Y0\n"
		}
		npth += "M30"
		for name, data := range map[string]string{"Top.GTL": "%FS*%\nM02*", "Drill_PTH_Through.DRL": pth, "Drill_PTH_Through_Via.DRL": pth, "Drill_NPTH_Through.DRL": npth} {
			e, _ := w.Create(name)
			e.Write([]byte(data))
		}
		w.Close()
		f.Close()
		r, e := inspectManufacturingFile(artifactRef{Path: path, Kind: "manufacturing_gerber"})
		if empty {
			if e == nil || r["structure_verified"] == true {
				t.Fatal("empty NPTH certified", r)
			}
		} else if e != nil || r["pth_hole_count"] != 2 || r["npth_hole_count"] != 1 {
			t.Fatal(r, e)
		}
	}
}
