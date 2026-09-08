package app

import (
	"bytes"
	"strings"
	"testing"
)

func TestFastPCBCommandsAndCatalog(t *testing.T) {
	cfg := &appConfig{}
	var out, errOut bytes.Buffer
	pcb := newPcbCmd(cfg, &out, &errOut)
	for _, name := range []string{"snapshot-compact", "route-preflight", "route-apply-batch"} {
		cmd, _, err := pcb.Find([]string{name})
		if err != nil || cmd.Name() != name || cmd.Flags().Lookup("payload") == nil || cmd.Flags().Lookup("timeout") == nil {
			t.Fatal(name, err)
		}
	}
	if !actionMutates("route.apply_batch") || actionMutates("route.preflight") || actionMutates("board.snapshot_compact") {
		t.Fatal("incorrect catalog mutation flags")
	}
	cfg.doc = "required-doc"
	_, err := postAction(cfg, "route.apply_batch", "", map[string]any{"document_uuid": "other-doc"}, 0)
	if err == nil || !strings.Contains(err.Error(), "conflicts") {
		t.Fatal("doc conflict must reject without networking", err)
	}
}
