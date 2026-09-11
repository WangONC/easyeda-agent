package app

import (
	"bytes"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
	"strings"
	"testing"
)

func TestNameOnlyPersonalCreateAcquiresGuardsWithoutOwner(t *testing.T) {
	cfg, d, done := newAutolayoutTestDaemon(t, func(_ int, c autolayoutTestCall) string {
		switch c.Action {
		case "project.current":
			return `{"ok":true,"result":{"uuid":"old","teamUuid":"personal-owner"}}`
		case "project.list":
			return `{"ok":true,"result":{"project_uuids":[],"session_token":"session"}}`
		case "project.create":
			return `{"ok":true,"result":{"status":"uncertain"}}`
		}
		return ""
	})
	defer done()
	var out, errout bytes.Buffer
	if err := dispatch(cfg, "project.create", "w1", map[string]any{"name": "Personal"}, &out, &errout); err != nil {
		t.Fatal(err)
	}
	calls := d.snapshot()
	if len(calls) != 1 || calls[0].Action != "project.create" {
		t.Fatal(calls)
	}
	p := calls[0].Payload
	if p["expected_project_uuid"] != "fixture-project" || p["session_token"] != "fixture-activation" || p["client_transaction_id"] == "" || p["client_transaction_id"] == nil {
		t.Fatal(p)
	}
	if _, ok := p["team_uuid"]; ok {
		t.Fatal("owner leaked", p)
	}
	// Binding supplies guards; no owner/team lookup or extra native query.
	if !strings.Contains(out.String(), "uncertain") {
		t.Fatal("uncertain hidden")
	}
}
func TestNameOnlyCreateDisabledBeforeDiscovery(t *testing.T) {
	t.Setenv(protocol.DisabledActionsEnv, "project.create")
	var out, errout bytes.Buffer
	err := dispatch(&appConfig{ports: "invalid"}, "project.create", "", map[string]any{"name": "N"}, &out, &errout)
	if err == nil || !strings.Contains(err.Error(), "CAPABILITY_DISABLED") {
		t.Fatal(err, out.String())
	}
}
func TestGuardedProjectCreatePreservesExplicitScope(t *testing.T) {
	p := map[string]any{"name": "T", "team_uuid": "team", "folder_uuid": "folder", "expected_project_uuid": "old", "session_token": "s", "client_transaction_id": "t"}
	got, err := prepareProjectCreate(&appConfig{ports: "invalid"}, "", p)
	if err != nil || got["team_uuid"] != "team" || got["folder_uuid"] != "folder" || got["client_transaction_id"] != "t" {
		t.Fatal(got, err)
	}
}

func TestNameOnlyCreateFromHome(t *testing.T) {
	cfg, d, done := newAutolayoutTestDaemon(t, func(_ int, c autolayoutTestCall) string {
		switch c.Action {
		case "project.current":
			return `{"ok":false,"error":{"code":"EDA_CALL_FAILED","message":"No current project is open."}}`
		case "document.current":
			return `{"ok":true,"result":{"documentType":"home","uuid":"tab_page1"}}`
		case "project.list":
			return `{"ok":true,"result":{"session_token":"session"}}`
		}
		return ""
	})
	defer done()
	cfg.v2Read.target.Scope = "HOME"
	cfg.v2Read.target.ProjectUUID = ""
	cfg.v2Read.target.DocumentUUID = ""
	cfg.v2Read.target.DocumentType = ""
	cfg.v2Read.target.TabID = ""

	var out, stderr bytes.Buffer
	if err := dispatch(cfg, "project.create", "w1", map[string]any{"name": "New"}, &out, &stderr); err != nil {
		t.Fatal(err)
	}
	calls := d.snapshot()
	if len(calls) != 1 || calls[0].Action != "project.create" {
		t.Fatal(calls)
	}
	p := calls[0].Payload
	if p["expected_project_uuid"] != "" || p["session_token"] != "fixture-activation" {
		t.Fatal(p)
	}
}
func TestNameOnlyCreateRejectsUnprovenEmptyIdentity(t *testing.T) {
	for _, tc := range []struct{ name, current, doc string }{
		{"other error", `{"ok":false,"error":{"code":"EDA_CALL_FAILED","message":"read failed"}}`, ""},
		{"stale", `{"ok":false,"error":{"code":"STALE_READ","message":"No current project is open."}}`, ""},
		{"missing UUID", `{"ok":true,"result":{}}`, ""},
		{"PCB", `{"ok":false,"error":{"code":"EDA_CALL_FAILED","message":"No current project is open."}}`, `{"ok":true,"result":{"documentType":"pcb"}}`},
		{"home parent", `{"ok":false,"error":{"code":"EDA_CALL_FAILED","message":"No current project is open."}}`, `{"ok":true,"result":{"documentType":"home","parentProjectUuid":"p"}}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg, d, done := newAutolayoutTestDaemon(t, func(_ int, c autolayoutTestCall) string {
				if c.Action == "project.current" {
					return tc.current
				}
				return tc.doc
			})
			defer done()
			if _, err := prepareProjectCreate(cfg, "w1", map[string]any{"name": "New"}); err == nil {
				t.Fatal("accepted unproven identity")
			}
			for _, c := range d.snapshot() {
				if c.Action == "project.list" || c.Action == "project.create" {
					t.Fatal(c)
				}
			}
		})
	}
}
