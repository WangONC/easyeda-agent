package app

import (
	"encoding/json"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// These tests do not use the retained business-fixture adapter.
func TestV2WorkflowReadConsumesOnlyDaemonSucceeded(t *testing.T) {
	for _, mode := range []string{"SUCCEEDED", "NOT_APPLIED", "PARTIAL", "UNKNOWN", "foreign", "scope", "malformed", "transport"} {
		t.Run(mode, func(t *testing.T) {
			calls := 0
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/v2/operations" {
					t.Errorf("unexpected endpoint %s", r.URL.Path)
					http.Error(w, "not found", 404)
					return
				}
				calls++
				var req executionv2.Request
				if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
					t.Fatal(err)
				}
				if req.Action != "pcb.components.list" || req.Target.DocumentUUID != "fixture-document" || req.OperationID == "" {
					t.Error(req)
				}
				if mode == "transport" {
					http.Error(w, "target drift", 409)
					return
				}
				out := executionv2.Result{Protocol: executionv2.Version, OperationID: req.OperationID, EvidenceRef: req.OperationID, Effects: executionv2.Effects{Scope: "NONE"}, Outcome: executionv2.Succeeded, Value: json.RawMessage(`{"components":[],"ok":true,"verified":true,"partial":false}`)}
				switch mode {
				case "NOT_APPLIED":
					out.Outcome = executionv2.NotApplied
				case "PARTIAL":
					out.Outcome = executionv2.Partial
				case "UNKNOWN":
					out.Outcome = executionv2.Unknown
				case "foreign":
					out.OperationID = "other"
				case "scope":
					out.Effects.Scope = "DESIGN_CONTENT"
				case "malformed":
					out.Value = json.RawMessage(`null`)
				}
				_ = json.NewEncoder(w).Encode(out)
			}))
			defer srv.Close()
			value, err := fixtureReadBinding(srv.URL).read("pcb.components.list", nil)
			if (err == nil) != (mode == "SUCCEEDED") {
				t.Fatal(mode, value, err)
			}
			if calls != 1 {
				t.Fatal("read retried", calls)
			}
		})
	}
}
func TestV2WorkflowReadCannotDispatchEffects(t *testing.T) {
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { calls++ }))
	defer srv.Close()
	for _, action := range []string{"pcb.component.modify", "pcb.save", "debug.exec_js", "route.apply_batch"} {
		if _, err := fixtureReadBinding(srv.URL).read(action, nil); err == nil {
			t.Fatal(action)
		}
	}
	if calls != 0 {
		t.Fatal("effect reached transport", calls)
	}
}
func TestV2WorkflowReadBindsOnceAndDoesNotRetarget(t *testing.T) {
	for _, ambiguous := range []bool{false, true} {
		t.Run(map[bool]string{false: "bound", true: "ambiguous"}[ambiguous], func(t *testing.T) {
			healthCalls, readCalls := 0, 0
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == "/health" {
					healthCalls++
					windows := []any{map[string]any{"windowId": "w", "transportId": "w", "activationId": "a", "context": map[string]any{"projectUuid": "p", "projectName": "P", "documentUuid": "d", "documentType": "pcb", "tabId": "t"}}}
					if ambiguous {
						windows = append(windows, windows[0])
					}
					_ = json.NewEncoder(w).Encode(map[string]any{"service": "easyeda-agent", "windows": windows})
					return
				}
				readCalls++
				var req executionv2.Request
				_ = json.NewDecoder(r.Body).Decode(&req)
				if req.Target.Session != "w" || req.Target.Activation != "a" || req.Target.DocumentUUID != "d" {
					t.Error(req.Target)
				}
				if readCalls == 2 {
					http.Error(w, "V2_TARGET_MISMATCH", 409)
					return
				}
				_ = json.NewEncoder(w).Encode(executionv2.Result{Protocol: executionv2.Version, OperationID: req.OperationID, EvidenceRef: req.OperationID, Outcome: executionv2.Succeeded, Effects: executionv2.Effects{Scope: "NONE"}, Value: json.RawMessage(`{"components":[]}`)})
			}))
			defer srv.Close()
			host, port := splitHostPortForTest(t, srv.URL)
			cfg := &appConfig{host: host, ports: port + "-" + port, project: "P"}
			_, err := readStageV2(cfg, "pcb.components.list", "", nil)
			if ambiguous {
				if err == nil || !strings.Contains(err.Error(), "AMBIGUOUS") {
					t.Fatal(err)
				}
				if readCalls != 0 {
					t.Fatal(readCalls)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if _, err = readStageV2(cfg, "pcb.components.list", "", nil); err == nil || !strings.Contains(err.Error(), "TARGET_MISMATCH") {
				t.Fatal(err)
			}
			if healthCalls != 1 || readCalls != 2 {
				t.Fatal("target rediscovery/retry", healthCalls, readCalls)
			}
		})
	}
}

func TestV2WorkflowDocumentNameDiscoveryRemainsScoped(t *testing.T) {
	for _, kind := range []string{"pcb", "schematic"} {
		for _, scenario := range []string{"current", "other", "duplicate"} {
			t.Run(kind+"/"+scenario, func(t *testing.T) {
				calls := []string{}
				srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if r.URL.Path == "/health" {
						_ = json.NewEncoder(w).Encode(map[string]any{"service": "easyeda-agent", "windows": []any{map[string]any{"windowId": "w", "transportId": "w", "activationId": "a", "context": map[string]any{"projectUuid": "p", "documentUuid": "d", "documentType": kind, "tabId": "t"}}}})
						return
					}
					var q executionv2.Request
					_ = json.NewDecoder(r.Body).Decode(&q)
					calls = append(calls, q.Action)
					value := map[string]any{"uuid": "p"}
					if len(calls) == 1 {
						key, action := "pcbs", "pcb.documents.list"
						if kind == "schematic" {
							key, action = "pages", "schematic.pages.list"
						}
						if q.Action != action {
							t.Error(q.Action, action)
						}
						id := "d"
						if scenario == "other" {
							id = "elsewhere"
						}
						rows := []any{map[string]any{"uuid": id, "name": "SameName"}}
						if scenario == "duplicate" {
							rows = append(rows, map[string]any{"uuid": "elsewhere", "name": "SameName"})
						}
						value = map[string]any{key: rows}
					}
					raw, _ := json.Marshal(value)
					_ = json.NewEncoder(w).Encode(executionv2.Result{Protocol: executionv2.Version, OperationID: q.OperationID, EvidenceRef: q.OperationID, Outcome: executionv2.Succeeded, Effects: executionv2.Effects{Scope: "NONE"}, Value: raw})
				}))
				defer srv.Close()
				host, port := splitHostPortForTest(t, srv.URL)
				cfg := &appConfig{host: host, ports: port + "-" + port, doc: "SameName"}
				_, err := readStageV2(cfg, "project.current", "", nil)
				if (err == nil) != (scenario == "current") {
					t.Fatal(err)
				}
				expected := 1
				if scenario == "current" {
					expected = 2
				}
				if len(calls) != expected {
					t.Fatal(calls)
				}
			})
		}
	}
}
