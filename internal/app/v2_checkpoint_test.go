package app

import (
	"bytes"
	"encoding/json"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"net/http"
	"net/http/httptest"
	"os"
	"reflect"
	"strings"
	"testing"
)

func TestCheckpointProjectionAndSessionGuard(t *testing.T) {
	for _, mode := range []string{"normal", "pcb", "semantic-mismatch", "old-accepted", "foreign-receipt", "unknown"} {
		t.Run(mode, func(t *testing.T) {
			target := executionv2.Target{Scope: "DOCUMENT", Session: "old", Activation: "a", ProjectUUID: "p", DocumentUUID: "d", DocumentType: "schematic", TabID: "t"}
			if mode == "pcb" {
				target.DocumentType = "pcb"
			}
			reloaded := false
			effects := 0
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == "/health" {
					json.NewEncoder(w).Encode(map[string]any{"windows": []any{map[string]any{"windowId": "new", "activationId": "a", "context": map[string]any{"projectUuid": "p", "documentUuid": "d", "documentType": target.DocumentType, "tabId": "t"}}}})
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
				if req.Action == "schematic.save" || req.Action == "pcb.save" {
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
				if req.Action == "pcb.snapshot" {
					t.Error("checkpoint used screenshot instead of semantic read")
				}
				if req.Action == "board.snapshot_compact" {
					value = map[string]any{"components": []any{}, "pads": []any{}, "traces": []any{}, "vias": []any{}, "fills": []any{}, "copper_layers": []any{1, 2}, "rule_profile": map[string]any{"clearance": 6}}
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
			if mode == "normal" || mode == "pcb" {
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

func TestCheckpointHostIdentityMaterialization(t *testing.T) {
	load := func(name string) map[string]any {
		data, e := os.ReadFile("testdata/checkpoint/" + name + ".json")
		if e != nil {
			t.Fatal(e)
		}
		var r struct {
			Evidence struct {
				Value map[string]any `json:"value"`
			} `json:"evidence"`
		}
		if e = json.Unmarshal(data, &r); e != nil {
			t.Fatal(e)
		}
		v, e := checkpointSemantic("schematic", r.Evidence.Value)
		if e != nil {
			t.Fatal(e)
		}
		return v
	}
	for _, mode := range []string{"host-equivalent", "lost-component", "lost-net", "changed-net", "changed-position", "changed-existing-id", "missing-id", "null-id", "duplicate-id", "foreign-primitive", "duplicate-primitive"} {
		t.Run(mode, func(t *testing.T) {
			b, a := load("before"), load("after")
			rows := a["components"].([]any)
			c := rows[2].(map[string]any)
			switch mode {
			case "lost-component":
				a["components"] = rows[:len(rows)-1]
			case "lost-net":
				a["nets"] = []any{}
			case "changed-net":
				rows[1].(map[string]any)["pins"].([]any)[0].(map[string]any)["net"] = "foreign"
			case "changed-position":
				c["x"] = float64(801)
			case "changed-existing-id":
				rows[1].(map[string]any)["uniqueId"] = "foreign"
			case "missing-id":
				delete(b["components"].([]any)[2].(map[string]any), "uniqueId")
			case "null-id":
				b["components"].([]any)[2].(map[string]any)["uniqueId"] = nil
			case "duplicate-id":
				c["uniqueId"] = "gge1"
			case "foreign-primitive":
				c["primitiveId"] = "foreign"
			case "duplicate-primitive":
				c["primitiveId"] = rows[1].(map[string]any)["primitiveId"]
			}
			original, _ := json.Marshal(b)
			normalized, changes, ok := checkpointEquivalent("schematic", b, a)
			if ok != (mode == "host-equivalent") {
				t.Fatalf("accepted=%v", ok)
			}
			untouched, _ := json.Marshal(b)
			if !bytes.Equal(original, untouched) {
				t.Fatal("modified original evidence")
			}
			if ok && (!reflect.DeepEqual(normalized, a) || len(changes) != 1 || changes[0]["after"] != "gge4") {
				t.Fatal("materialization proof missing")
			}
		})
	}
}
