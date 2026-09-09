package protocol

import "testing"

func TestClosureCatalogAndAuthoringVerification(t *testing.T) {
	all := map[string]ActionSpec{}
	for _, a := range AllActions() {
		all[a.Name] = a
	}
	for _, name := range []string{"project.create", "project.open", "project.list", "schematic.create", "schematic.component.modify", "schematic.wire.create"} {
		a, ok := all[name]
		if !ok {
			t.Fatal(name)
		}
		for _, verify := range a.VerifyWith {
			if _, ok := all[verify]; !ok {
				t.Fatalf("%s points to missing %s", name, verify)
			}
		}
	}
	if all["route.apply_batch"].RequiresGate != GateRouting {
		t.Fatal("routing gate changed")
	}
}
