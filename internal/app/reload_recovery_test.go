package app

import (
	"bytes"
	"fmt"
	"strings"
	"testing"
)

func TestReloadRecoveryIdentityEnumerationWorkflow(t *testing.T) {
	t.Skip("ARCHIVED: debug-close/legacy stale gate path is unavailable; V2 checkpoint and public navigation suites cover current identity/recovery")
	t.Setenv("EASYEDA_WORKFLOW_DIR", t.TempDir())
	stale := true
	reopened := false
	closed := false
	context := `"context":{"projectUuid":"project1","projectName":"P","documentUuid":"pcb1","documentType":"pcb","tabId":"tab1"}`
	cfg, _, done := newAutolayoutTestDaemon(t, func(_ int, c autolayoutTestCall) string {
		switch c.Action {
		case "document.current":
			return `{ "ok":true,"result":{},` + context + `}`
		case "schematic.pages.list":
			return `{"ok":true,"result":{"pages":[]}}`
		case "pcb.documents.list":
			return `{"ok":true,"result":{"pcbs":[{"uuid":"pcb1","name":"PCB1","parentProjectUuid":"project1"}]}}`
		case "debug.exec_js":
			closed = true
			stale = false
		case "document.open":
			reopened = closed
		case "pcb.components.list":
			if stale {
				return `{"ok":false,"error":{"code":"STALE_READ","message":"STALE_READ R1"}}`
			}
			return `{ "ok":true,"result":{"components":[],"freshness":"R2"},` + context + `}`
		}
		return `{ "ok":true,"result":{},` + context + `}`
	})
	defer done()
	docs, id, _, err := discoverDocs(cfg, "w1")
	if err != nil || id != "pcb1" || len(docs) != 1 {
		t.Fatal(docs, id, err)
	}
	if _, err = requestAction(cfg, "pcb.components.list", "w1", nil); err == nil {
		t.Fatal("R1 should be stale")
	}
	typ, err := reloadDocumentByUUID(cfg, "w1", "pcb1")
	if err != nil || typ != "pcb" || !reopened {
		t.Fatal(typ, reopened, err)
	}
	read, err := requestAction(cfg, "pcb.components.list", "w1", nil)
	if err != nil || read.Result["freshness"] != "R2" {
		t.Fatal(read, err)
	}
	docs, id, _, err = discoverDocs(cfg, "w1")
	if err != nil || id != "pcb1" || len(docs) != 1 || docs[0].Parent != "project1" {
		t.Fatal(docs, id, err)
	}
	var out bytes.Buffer
	w := "w1"
	cmd := newWorkflowStatusCmd(cfg, &w, &out, &out)
	cmd.SetArgs([]string{"--json", "--reconcile"})
	if err = cmd.Execute(); err != nil {
		t.Fatal(err, out.String())
	}
	if !strings.Contains(out.String(), `"routeAllowed": false`) {
		t.Fatal(out.String())
	}
	stale = true
	if _, err = requestAction(cfg, "pcb.components.list", "w1", nil); err == nil {
		t.Fatal("new mutation must reject old freshness")
	}
}
func TestDiscoveryPreservesEnumerationFailure(t *testing.T) {
	cfg, _, done := newAutolayoutTestDaemon(t, func(_ int, c autolayoutTestCall) string {
		if c.Action == "pcb.documents.list" {
			return `{"ok":false,"error":{"code":"STALE_READ","message":"STALE_READ enumeration"}}`
		}
		return `{"ok":true,"result":{},"context":{"documentUuid":"pcb1"}}`
	})
	defer done()
	cfg.v2Read.target.DocumentType = "pcb"
	cfg.v2Read.target.DocumentUUID = "pcb1"
	_, _, _, err := discoverDocs(cfg, "w1")
	if err == nil || !strings.Contains(err.Error(), "STALE_READ") || strings.Contains(err.Error(), "not found") {
		t.Fatal(err)
	}
}
func TestReloadRejectsWrongIdentityAndStaleReadback(t *testing.T) {
	t.Skip("ARCHIVED: debug-close/legacy stale gate path is unavailable; V2 checkpoint and public navigation suites cover current identity/recovery")
	for _, mode := range []string{"project", "type", "stale"} {
		t.Run(mode, func(t *testing.T) {
			closed := false
			cfg, _, done := newAutolayoutTestDaemon(t, func(_ int, c autolayoutTestCall) string {
				project, typ := "project1", "pcb"
				if closed && mode == "project" {
					project = "other"
				}
				if closed && mode == "type" {
					typ = "schematic"
				}
				if c.Action == "debug.exec_js" {
					closed = true
				}
				if c.Action == "pcb.components.list" && mode == "stale" {
					return `{"ok":false,"error":{"code":"STALE_READ","message":"STALE_READ unsynchronized"}}`
				}
				return fmt.Sprintf(`{"ok":true,"result":{},"context":{"projectUuid":%q,"documentUuid":"pcb1","documentType":%q,"tabId":"tab1"}}`, project, typ)
			})
			defer done()
			_, err := reloadDocumentByUUID(cfg, "w1", "pcb1")
			if err == nil {
				t.Fatal("unverified reload accepted")
			}
			if mode == "stale" && !strings.Contains(err.Error(), "STALE_READ") {
				t.Fatal(err)
			}
		})
	}
}
