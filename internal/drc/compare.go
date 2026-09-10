package drc

import (
	"github.com/zhoushoujianwork/easyeda-agent/internal/fastpath"
	"math"
)

type Baseline struct {
	Layers   string `json:"logical_layers_hash"`
	ID       string `json:"drc_id"`
	Project  string `json:"project_uuid"`
	Document string `json:"document_uuid"`
	Revision string `json:"revision"`
	Rules    string `json:"rules_hash"`
	Stackup  string `json:"stackup_hash"`
	Trusted  bool   `json:"readback_stable"`
	Report   Report `json:"report"`
}

// Native primitive IDs and globalIndex are deliberately absent from identity.
// No stable location means comparison is not provable, not zero new findings.
func drcFindingKey(v Violation) (string, bool) {
	if v.Rule == "" || v.X == nil || v.Y == nil || math.IsNaN(*v.X) || math.IsNaN(*v.Y) || math.IsInf(*v.X, 0) || math.IsInf(*v.Y, 0) {
		return "", false
	}
	return fastpath.Hash([]any{v.Rule, v.ObjType, v.RuleName, v.Net, v.Layer, *v.X, *v.Y}), true
}
func Compare(a, b Baseline) map[string]any {
	out := map[string]any{"comparable": false, "new": []Violation{}, "cleared": []Violation{}, "persistent": []Violation{}}
	if !a.Trusted || !b.Trusted || a.Project != b.Project || a.Document != b.Document || a.Rules == "" || a.Rules != b.Rules || a.Stackup != b.Stackup || a.Layers != b.Layers {
		out["reason"] = "identity, rules, stackup or stable readback is not comparable"
		return out
	}
	buckets := map[string][]Violation{}
	for _, v := range a.Report.Violations {
		k, ok := drcFindingKey(v)
		if !ok {
			out["reason"] = "baseline contains finding without stable location"
			return out
		}
		buckets[k] = append(buckets[k], v)
	}
	for _, v := range b.Report.Violations {
		if _, ok := drcFindingKey(v); !ok {
			out["reason"] = "current contains finding without stable location"
			return out
		}
	}
	added, persistent, cleared := []Violation{}, []Violation{}, []Violation{}
	for _, v := range b.Report.Violations {
		k, _ := drcFindingKey(v)
		if len(buckets[k]) > 0 {
			persistent = append(persistent, v)
			buckets[k] = buckets[k][1:]
		} else {
			added = append(added, v)
		}
	}
	// Preserve baseline order rather than nondeterministic map iteration.
	for _, v := range a.Report.Violations {
		k, _ := drcFindingKey(v)
		if len(buckets[k]) > 0 {
			cleared = append(cleared, v)
			buckets[k] = buckets[k][1:]
		}
	}
	out["comparable"] = true
	out["new"] = added
	out["cleared"] = cleared
	out["persistent"] = persistent
	out["counts"] = map[string]int{"new": len(added), "cleared": len(cleared), "persistent": len(persistent)}
	return out
}
