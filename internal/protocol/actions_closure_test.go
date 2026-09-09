package protocol

import (
	"strings"
	"testing"
)

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

func TestPersonalProjectScopeContract(t *testing.T) {
	all := map[string]ActionSpec{}
	for _, a := range AllActions() {
		all[a.Name] = a
	}
	for name, phrases := range map[string][]string{
		"project.create":  {"Personal/Root: omit team_uuid and folder_uuid", "personal owner UUID", "explicitly selected real team"},
		"project.current": {"personal owner", "not evidence of a real team"},
		"project.list":    {"[]", "does not require team_uuid for Personal creation"},
	} {
		for _, phrase := range phrases {
			if !strings.Contains(all[name].Description, phrase) {
				t.Fatalf("%s missing scope contract: %s", name, phrase)
			}
		}
	}
}
