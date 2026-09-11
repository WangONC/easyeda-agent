package app

import (
	"bytes"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
	"io"
	"strings"
	"testing"
)

func TestRetiredPublicEntrypointsRejectBeforeTransport(t *testing.T) {
	for _, args := range [][]string{
		{"sch", "sheet", "tidy", "--apply"}, {"sch", "zone-draw"}, {"sch", "frame", "apply"}, {"sch", "frame", "check"}, {"pcb", "via-bond"},
		{"--force-stale-read", "old", "action", "document.current"},
		{"call", "document.current"}, {"debug", "exec", "--code", "return 1"},
		{"pcb", "drc-rules-set", "--pour-clearance", "12"},
		{"sch", "autolayout", "--engine", "official", "--apply"},
	} {
		t.Run(strings.Join(args, " "), func(t *testing.T) {
			var out, stderr bytes.Buffer
			root := newRootCmd(&out, &stderr)
			root.SetArgs(args)
			err := root.Execute()
			if err == nil {
				t.Fatal("retired entrypoint executed")
			}
			if !strings.Contains(err.Error(), "RETIRED_ENTRYPOINT") && !strings.Contains(err.Error(), "unknown command") {
				t.Fatalf("did not fail at entry: %v", err)
			}
		})
	}
}

func TestRetiredAnnotationsRejectBeforePlacement(t *testing.T) {
	cfg := &appConfig{}
	spec := alSpec{Modules: []alSpecModule{{Name: "power", Zone: "center", Parts: []string{"U1"}}}}
	// Use a known catalog zone; refusal is before binding or any Host request.
	for zone := range pcbZoneNames {
		spec.Modules[0].Zone = zone
		break
	}
	err := runAutolayout(cfg, "", spec, autolayoutRules{}, true, false, false, true, io.Discard, io.Discard)
	if err == nil || !strings.Contains(err.Error(), "RETIRED_ENTRYPOINT") {
		t.Fatalf("autolayout: %v", err)
	}
	err = runGroupArrange(cfg, "", 10, false, true, io.Discard, io.Discard)
	if err == nil || !strings.Contains(err.Error(), "RETIRED_ENTRYPOINT") {
		t.Fatalf("group annotations: %v", err)
	}
}

func TestV2DisabledActionRejectsBeforeDiscovery(t *testing.T) {
	t.Setenv(protocol.DisabledActionsEnv, "system.health")
	var out, stderr bytes.Buffer
	root := newRootCmd(&out, &stderr)
	root.SetArgs([]string{"--ports", "invalid", "action", "system.health"})
	err := root.Execute()
	if err == nil || !strings.Contains(err.Error(), "CAPABILITY_DISABLED") {
		t.Fatal(err)
	}
	if out.Len() != 0 {
		t.Fatal("admission failure fabricated receipt", out.String())
	}
}
