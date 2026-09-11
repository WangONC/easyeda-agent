package daemon

import (
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestV2StartupFenceAllNativeEffectScopes(t *testing.T) {
	path := filepath.Join(t.TempDir(), "receipts.json")
	if err := os.WriteFile(path+".active", []byte("unclean"), 0600); err != nil {
		t.Fatal(err)
	}
	s := New(Options{V2ReceiptFile: path})
	tested := 0
	for _, action := range protocol.AllActions() {
		v := action.V2
		if v == nil {
			continue
		}
		input := map[string]any{}
		for key, typ := range v.Input {
			if !strings.HasPrefix(typ, "!") {
				continue
			}
			switch strings.TrimPrefix(typ, "!") {
			case "boolean":
				input[key] = true
			case "number":
				input[key] = float64(1)
			case "object":
				input[key] = map[string]any{}
			case "array", "string[]":
				input[key] = []any{"value"}
			default:
				input[key] = "value"
			}
		}
		target := executionv2.Target{Scope: "DOCUMENT", Session: "s", Activation: "a", ProjectUUID: "p", DocumentUUID: "d", DocumentType: v.Target, TabID: "t"}
		if v.Target == "HOME" || v.Target == "ANY" {
			target = executionv2.Target{Scope: "HOME", Session: "s", Activation: "a"}
		}
		if v.Target == "PROJECT" {
			target = executionv2.Target{Scope: "PROJECT", Session: "s", Activation: "a", ProjectUUID: "p"}
		}
		if v.Target == "LIBRARY" {
			target = executionv2.Target{Scope: "LIBRARY", Session: "s", Activation: "a", LibraryUUID: "lib"}
		}
		r := executionv2.Request{Protocol: executionv2.Version, Action: action.Name, ActionRevision: v.Revision, Schema: v.SchemaID(), RequestID: "r", OperationID: "op", Target: target, Input: input, BudgetMS: 100}
		if _, err := protocol.ValidateV2(r); err != nil {
			t.Fatalf("fixture %s: %v", action.Name, err)
		}
		_, err := s.validateV2(r)
		if v.EffectScope != "NONE" {
			tested++
			if err == nil || err.Error() != "V2_HOST_STARTUP_RECONCILIATION_REQUIRED" {
				t.Fatalf("%s crossed startup fence: %v", action.Name, err)
			}
		} else if err != nil && strings.Contains(err.Error(), "STARTUP") {
			t.Fatalf("read fenced: %s", action.Name)
		}
	}
	if tested == 0 {
		t.Fatal("no effects tested")
	}
	// A second daemon lifetime cannot inherit an old operator assertion.
	ready := New(Options{V2HostStartupConfirmed: true})
	restarted := New(Options{V2ReceiptFile: path})
	if !ready.opts.V2HostStartupConfirmed || restarted.opts.V2HostStartupConfirmed {
		t.Fatal("startup trust inherited")
	}
	t.Logf("%d native Host effects fenced after unclean exit, reads remain admissible", tested)
}
