package protocol

import (
	"reflect"
	"testing"
)

func TestDisabledActions(t *testing.T) {
	t.Setenv(DisabledActionsEnv, "")
	if !reflect.DeepEqual(AllActions(), AvailableActions()) {
		t.Fatal("empty config changed catalog")
	}
	t.Setenv(DisabledActionsEnv, " pcb.import_autoroute, , system.health,pcb.import_autoroute ,")
	if len(disabledActions()) != 2 {
		t.Fatal(disabledActions())
	}
	for _, name := range []string{"pcb.import_autoroute", "system.health"} {
		if !ActionDisabled(name) {
			t.Fatal(name)
		}
		for _, a := range AvailableActions() {
			if a.Name == name {
				t.Fatal("disabled action visible", name)
			}
		}
	}
	for _, name := range []string{"pcb.import", "PCB.import_autoroute", "pcb.import_autoroute.extra"} {
		if ActionDisabled(name) {
			t.Fatal("non-exact match", name)
		}
	}
	t.Setenv(DisabledActionsEnv, "pcb.*")
	if ActionDisabled("pcb.import_autoroute") {
		t.Fatal("wildcard interpreted")
	}
}
