package app

import (
	"bytes"
	"encoding/json"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCheckpointProjectionAndSessionGuard(t *testing.T) {
	for _, mode := range []string{"normal", "semantic-mismatch", "old-accepted", "foreign-receipt", "unknown"} {
		t.Run(mode, func(t *testing.T) {
			target := executionv2.Target{Scope: "DOCUMENT", Session: "old", Activation: "a", ProjectUUID: "p", DocumentUUID: "d", DocumentType: "schematic", TabID: "t"}
			reloaded := false
			effects := 0
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == "/health" {
					json.NewEncoder(w).Encode(map[string]any{"windows": []any{map[string]any{"windowId": "new", "activationId": "a", "context": map[string]any{"projectUuid": "p", "documentUuid": "d", "documentType": "schematic", "tabId": "t"}}}})
					return
				}
				if r.URL.Path == "/v2/bind" {
					w.Write([]byte(`{}`))
					return
				}
				var req executionv2.Request
				json.NewDecoder(r.Body).Decode(&req)
				if reloaded && req.Target.Session == "old" && mode != "old-accepted" {
					http.Error(w, "V2_SESSION_LOST", 409)
					return
				}
				scope := "NONE"
				outcome := "SUCCEEDED"
				var value any = map[string]any{}
				if req.Action == "schematic.save" {
					effects++
					scope = "SAVE"
				}
				if req.Action == "document.open" {
					effects++
					scope = "NAVIGATION_SELECTION"
					reloaded = true
					if mode == "unknown" {
						outcome = "UNKNOWN"
					}
				}
				if req.Action == "schematic.read" {
					x := 1
					if reloaded && mode == "semantic-mismatch" {
						x = 2
					}
					value = map[string]any{"components": []any{map[string]any{"primitiveId": "c", "x": x}}, "nets": []any{}}
				}
				id := req.OperationID
				if mode == "foreign-receipt" {
					id = "foreign"
				}
				json.NewEncoder(w).Encode(map[string]any{"protocol": "execution.v2", "operation_id": id, "evidence_ref": id, "outcome": outcome, "effects": map[string]any{"effect_scope": scope, "native_settled": true}, "value": value})
			}))
			defer server.Close()
			raw, _ := json.Marshal(target)
			var out bytes.Buffer
			c := newV2Cmd(&out)
			c.SetArgs([]string{"--endpoint", server.URL, "checkpoint", string(raw)})
			e := c.Execute()
			if mode == "normal" {
				if e != nil || !strings.Contains(out.String(), `"checkpoint_proven":true`) {
					t.Fatalf("%v %s", e, out.String())
				}
			} else if e == nil {
				t.Fatal("unsafe checkpoint accepted")
			}
			if effects > 2 {
				t.Fatalf("effect replay: %d", effects)
			}
		})
	}
}
func TestCheckpointExactIdentity(t *testing.T) {
	for _, mode := range []string{"wrong-project", "wrong-document", "wrong-type", "old-session", "ambiguous"} {
		t.Run(mode, func(t *testing.T) {
			old := executionv2.Target{ProjectUUID: "p", DocumentUUID: "d", DocumentType: "pcb", Session: "old"}
			s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				project, doc, kind, session := "p", "d", "pcb", "new"
				switch mode {
				case "wrong-project":
					project = "foreign"
				case "wrong-document":
					doc = "foreign"
				case "wrong-type":
					kind = "schematic"
				case "old-session":
					session = "old"
				}
				item := map[string]any{"windowId": session, "activationId": "a", "context": map[string]any{"projectUuid": project, "documentUuid": doc, "documentType": kind, "tabId": "t", "documentName": "same-name"}}
				rows := []any{item}
				if mode == "ambiguous" {
					rows = append(rows, item)
				}
				json.NewEncoder(w).Encode(map[string]any{"windows": rows})
			}))
			defer s.Close()
			target, e := checkpointBinding(s.URL, old)
			if mode == "ambiguous" && e == nil {
				t.Fatal("ambiguous accepted")
			}
			if target.Session != "" {
				t.Fatal("wrong identity accepted")
			}
		})
	}
}
