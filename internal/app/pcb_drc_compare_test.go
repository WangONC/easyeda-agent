package app

import "testing"

func TestDRCComparisonIgnoresVolatileIDsButRequiresEvidence(t *testing.T) {
	x, y := 12.0, 14.0
	v := drcFlatViolation{Rule: "Clearance", ObjType: "Track", Net: "N", Layer: "1", X: &x, Y: &y, Objs: []string{"old"}, Index: "old-index"}
	a := drcBaseline{Project: "p", Document: "d", Rules: "rules", Stackup: "stackup", Trusted: true, Report: drcFlatReport{Violations: []drcFlatViolation{v}}}
	b := a
	b.Report.Violations = append([]drcFlatViolation{}, v)
	b.Report.Violations[0].Objs = []string{"recreated"}
	b.Report.Violations[0].Index = "new-index"
	r := compareDRC(a, b)
	if r["comparable"] != true || r["counts"].(map[string]int)["persistent"] != 1 {
		t.Fatal(r)
	}
	b.Report.Violations = nil
	r = compareDRC(a, b)
	if r["counts"].(map[string]int)["cleared"] != 1 {
		t.Fatal(r)
	}
	r = compareDRC(b, a)
	if r["counts"].(map[string]int)["new"] != 1 {
		t.Fatal(r)
	}
	b.Report.Violations = []drcFlatViolation{{Rule: "unlocated"}}
	r = compareDRC(a, b)
	if r["comparable"] != false {
		t.Fatal(r)
	}
	b = a
	b.Rules = "changed"
	if compareDRC(a, b)["comparable"] != false {
		t.Fatal("different rules compared")
	}
}
