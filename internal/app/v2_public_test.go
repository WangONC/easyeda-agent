package app

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
)

func TestPublicV2HomeCommandsBindInternally(t *testing.T) {
	requests := []executionv2.Request{}
	legacy := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health" {
			fmt.Fprint(w, `{"service":"easyeda-agent","version":"dev","windows":[{"windowId":"physical","transportId":"transport","activationId":"activation","context":{"documentType":"home","documentUuid":"tab_page1","tabId":"tab_page1"}}]}`)
			return
		}
		if r.URL.Path != "/v2/operations" {
			legacy++
			http.NotFound(w, r)
			return
		}
		var q executionv2.Request
		if err := json.NewDecoder(r.Body).Decode(&q); err != nil {
			t.Error(err)
		}
		requests = append(requests, q)
		if q.Target.Session != "transport" || q.Target.Activation != "activation" || q.Target.Scope != "HOME" {
			t.Errorf("target: %+v", q.Target)
		}
		scope := "NONE"
		if q.Action == "project.create" {
			scope = "PROJECT_TOPOLOGY"
		}
		json.NewEncoder(w).Encode(executionv2.Result{Protocol: executionv2.Version, OperationID: q.OperationID, Outcome: executionv2.Succeeded, Effects: executionv2.Effects{Scope: scope, Settled: true}, Value: json.RawMessage(`{"uuid":"p"}`), EvidenceRef: q.OperationID})
	}))
	defer server.Close()
	for _, args := range [][]string{{"project", "doc"}, {"action", "project.list"}, {"action", "project.create", "--input", `{"name":"new"}`}} {
		var out, stderr bytes.Buffer
		root := newRootCmd(&out, &stderr)
		hostPort := strings.TrimPrefix(server.URL, "http://")
		i := strings.LastIndex(hostPort, ":")
		root.SetArgs(append([]string{"--host", hostPort[:i], "--ports", hostPort[i+1:] + "-" + hostPort[i+1:], "--skip-version-check"}, args...))
		if e := root.Execute(); e != nil {
			t.Fatal(e, out.String(), stderr.String())
		}
		if !strings.Contains(out.String(), `"outcome":"SUCCEEDED"`) {
			t.Fatal(out.String())
		}
	}
	if legacy != 0 || len(requests) != 3 {
		t.Fatal(legacy, len(requests))
	}
	create := requests[2]
	if create.Input["session_token"] != "activation" || create.Input["expected_project_uuid"] != "" || create.OperationID == "" || create.Input["client_transaction_id"] != create.OperationID {
		t.Fatal(create)
	}
}

func TestPublicV2NeverRetriesOrInfersNativeSuccess(t *testing.T) {
	for _, outcome := range []executionv2.Outcome{executionv2.Succeeded, executionv2.NotApplied, executionv2.Partial, executionv2.Unknown} {
		t.Run(string(outcome), func(t *testing.T) {
			count := 0
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				count++
				if r.URL.Path != "/v2/operations" {
					t.Errorf("unexpected route %s", r.URL.Path)
				}
				var req executionv2.Request
				json.NewDecoder(r.Body).Decode(&req)
				json.NewEncoder(w).Encode(executionv2.Result{Protocol: executionv2.Version, OperationID: req.OperationID, EvidenceRef: req.OperationID, Outcome: outcome, Effects: executionv2.Effects{Scope: "NONE", Settled: true}, Value: json.RawMessage(`{"ok":true,"verified":true}`)})
			}))
			defer server.Close()
			cfg := &appConfig{v2Read: fixtureReadBinding(server.URL)}
			result, err := requestAction(cfg, "document.current", "", nil)
			if count != 1 {
				t.Fatalf("replayed %d times", count)
			}
			if result == nil || result.OK != (outcome == executionv2.Succeeded) || (err == nil) != (outcome == executionv2.Succeeded) {
				t.Fatalf("wrong projection %+v %v", result, err)
			}
		})
	}
}

func TestPublicImmediateResponsePreservesValueOver8KiB(t *testing.T) {
	large := json.RawMessage(`{"component":"STM32G474CBT6","pins":"` + strings.Repeat("complete-pin-data-", 700) + `"}`)
	if len(large) <= 8192 {
		t.Fatalf("fixture is only %d bytes", len(large))
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req executionv2.Request
		_ = json.NewDecoder(r.Body).Decode(&req)
		_ = json.NewEncoder(w).Encode(executionv2.Result{Protocol: executionv2.Version, OperationID: req.OperationID, EvidenceRef: req.OperationID, Outcome: executionv2.Succeeded, Effects: executionv2.Effects{Scope: "NONE", Settled: true}, Value: large})
	}))
	defer server.Close()
	cfg := &appConfig{v2Read: fixtureSchematicBinding(server.URL)}
	raw, err := publicActionV2(cfg, "schematic.read", "", nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	var result executionv2.Result
	if err := json.Unmarshal(raw, &result); err != nil {
		t.Fatal(err)
	}
	if result.Outcome != executionv2.Succeeded || string(result.Value) != string(large) {
		t.Fatalf("public response lost large value: outcome=%s got=%d want=%d", result.Outcome, len(result.Value), len(large))
	}
}

func TestPublicV2NavigationPinsNewDocumentWithoutReplay(t *testing.T) {
	for _, mode := range []string{"normal", "wrong-project", "wrong-document", "new-transport"} {
		t.Run(mode, func(t *testing.T) {
			target := executionv2.Target{Scope: "DOCUMENT", Session: "socket", Activation: "activation", ProjectUUID: "project", DocumentUUID: "old", DocumentType: "schematic", TabID: "old-tab"}
			opens := 0
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == "/health" {
					project, doc, session := "project", "new", "socket"
					if mode == "wrong-project" {
						project = "foreign"
					}
					if mode == "wrong-document" {
						doc = "foreign"
					}
					if mode == "new-transport" {
						session = "new-socket"
					}
					fmt.Fprintf(w, `{"windows":[{"windowId":"physical","transportId":%q,"activationId":"activation","context":{"projectUuid":%q,"documentUuid":%q,"documentType":"schematic","tabId":"new-tab"}}]}`, session, project, doc)
					return
				}
				var req executionv2.Request
				json.NewDecoder(r.Body).Decode(&req)
				scope := "NONE"
				if req.Action == "document.open" {
					opens++
					scope = "NAVIGATION_SELECTION"
				} else if req.Target.DocumentUUID != "new" {
					t.Errorf("read used old target %+v", req.Target)
				}
				json.NewEncoder(w).Encode(executionv2.Result{Protocol: executionv2.Version, OperationID: req.OperationID, EvidenceRef: req.OperationID, Outcome: executionv2.Succeeded, Effects: executionv2.Effects{Scope: scope, Settled: true}, Value: json.RawMessage(`{"uuid":"new"}`)})
			}))
			defer server.Close()
			cfg := &appConfig{v2Read: &v2ReadBinding{endpoint: server.URL, window: "physical", target: target}}
			if _, err := publicActionV2(cfg, "document.open", "physical", map[string]any{"uuid": "new"}, 0); err != nil {
				t.Fatal(err)
			}
			_, err := requestAction(cfg, "document.current", "physical", nil)
			if (err == nil) != (mode == "normal") {
				t.Fatalf("mode %s: %v", mode, err)
			}
			if opens != 1 {
				t.Fatalf("navigation replayed %d", opens)
			}
		})
	}
}

func TestPublicV2ReloadKeepsExactDocumentAndAdoptsFreshActivation(t *testing.T) {
	for _, documentType := range []string{"pcb", "schematic"} {
		for _, mode := range []string{"ok", "wrong-project", "wrong-document", "wrong-type"} {
			t.Run(documentType+"/"+mode, func(t *testing.T) {
				target := executionv2.Target{Scope: "DOCUMENT", Session: "old-transport", Activation: "old-activation", ProjectUUID: "project", DocumentUUID: "document", DocumentType: documentType, TabID: "old-tab"}
				requests := []executionv2.Request{}
				server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if r.URL.Path == "/health" {
						project, document, kind := "project", "document", documentType
						if mode == "wrong-project" {
							project = "foreign"
						}
						if mode == "wrong-document" {
							document = "foreign"
						}
						if mode == "wrong-type" {
							if kind == "pcb" {
								kind = "schematic"
							} else {
								kind = "pcb"
							}
						}
						fmt.Fprintf(w, `{"windows":[{"windowId":"physical","transportId":"new-transport","activationId":"new-activation","context":{"projectUuid":%q,"documentUuid":%q,"documentType":%q,"tabId":"new-tab"}}]}`, project, document, kind)
						return
					}
					var request executionv2.Request
					if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
						t.Error(err)
					}
					requests = append(requests, request)
					scope := "NONE"
					if request.Action == "document.open" {
						scope = "NAVIGATION_SELECTION"
						if request.Target != target || request.Input["reload"] != true || request.Input["uuid"] != "document" {
							t.Errorf("reload lost exact pre-target: %+v", request)
						}
					} else if request.Target.Session != "new-transport" || request.Target.Activation != "new-activation" || request.Target.DocumentUUID != "document" {
						t.Errorf("fresh read did not use rebound target: %+v", request.Target)
					}
					_ = json.NewEncoder(w).Encode(executionv2.Result{Protocol: executionv2.Version, OperationID: request.OperationID, EvidenceRef: request.OperationID, Outcome: executionv2.Succeeded, Effects: executionv2.Effects{Scope: scope, Settled: true}, Value: json.RawMessage(`{"uuid":"document"}`)})
				}))
				defer server.Close()
				cfg := &appConfig{v2Read: &v2ReadBinding{endpoint: server.URL, window: "physical", target: target}}
				_, err := publicActionV2(cfg, "document.open", "physical", map[string]any{"uuid": "document", "reload": true}, 0)
				if err == nil {
					_, err = requestAction(cfg, "document.current", "physical", nil)
				}
				if (err == nil) != (mode == "ok") {
					t.Fatalf("mode=%s err=%v", mode, err)
				}
				if mode == "ok" && (len(requests) != 3 || cfg.v2Read.target.TabID != "new-tab") {
					t.Fatalf("requests=%d binding=%+v", len(requests), cfg.v2Read.target)
				}
			})
		}
	}
}
func TestPublicV2LibraryDefaultIsResolvedBeforeEffect(t *testing.T) {
	calls := []string{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req executionv2.Request
		json.NewDecoder(r.Body).Decode(&req)
		calls = append(calls, req.Action)
		scope, value := "NONE", `{"personalLibraryUuid":"personal-library"}`
		if req.Action == "library.footprint.create" {
			scope = "LIBRARY_ASSET"
			value = `{"uuid":"created"}`
			if req.Target.Scope != "LIBRARY" || req.Target.LibraryUUID != "personal-library" {
				t.Errorf("unbound library %+v", req.Target)
			}
		}
		json.NewEncoder(w).Encode(executionv2.Result{Protocol: executionv2.Version, OperationID: req.OperationID, EvidenceRef: req.OperationID, Outcome: executionv2.Succeeded, Effects: executionv2.Effects{Scope: scope, Settled: true}, Value: json.RawMessage(value)})
	}))
	defer server.Close()
	cfg := &appConfig{v2Read: fixtureReadBinding(server.URL)}
	if _, err := publicActionV2(cfg, "library.footprint.create", "", map[string]any{"name": "test"}, 0); err != nil {
		t.Fatal(err)
	}
	if strings.Join(calls, ",") != "library.list,library.footprint.create" {
		t.Fatal(calls)
	}
}

func TestPublicV2DaemonHealthWithoutConnector(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health" {
			fmt.Fprint(w, `{"service":"easyeda-agent","version":"dev","v2_session":"daemon-only","windows":[]}`)
			return
		}
		if r.URL.Path != "/v2/operations" {
			t.Errorf("unexpected route %s", r.URL.Path)
			http.NotFound(w, r)
			return
		}
		calls++
		var q executionv2.Request
		if err := json.NewDecoder(r.Body).Decode(&q); err != nil {
			t.Error(err)
		}
		if q.Action != "system.health" || q.Target.Scope != "HOME" || q.Target.Session != "daemon-only" || q.Target.Activation != "daemon-only" {
			t.Errorf("wrong request: %+v", q)
		}
		json.NewEncoder(w).Encode(executionv2.Result{Protocol: executionv2.Version, OperationID: q.OperationID, EvidenceRef: q.OperationID, Outcome: executionv2.Succeeded, Effects: executionv2.Effects{Scope: "NONE", Settled: true}, Value: json.RawMessage(`{"healthy":true}`)})
	}))
	defer server.Close()
	var out, stderr bytes.Buffer
	root := newRootCmd(&out, &stderr)
	hp := strings.TrimPrefix(server.URL, "http://")
	i := strings.LastIndex(hp, ":")
	root.SetArgs([]string{"--host", hp[:i], "--ports", hp[i+1:] + "-" + hp[i+1:], "--skip-version-check", "action", "system.health"})
	if err := root.Execute(); err != nil {
		t.Fatal(err, stderr.String())
	}
	if calls != 1 || !strings.Contains(out.String(), `"outcome":"SUCCEEDED"`) {
		t.Fatal(calls, out.String())
	}
}

func TestV2WireReadPreservesIdentityAndRejectsMissingData(t *testing.T) {
	segment := func(id string, x float64) any {
		return map[string]any{"primitiveId": id, "x0": x, "y0": 0., "x1": x + 10, "y1": 0.}
	}
	rows, err := parseV2WirePolylines(map[string]any{"wires": []any{segment("w1", 0), segment("w2", 100), segment("w1", 10)}})
	if err != nil || len(rows) != 2 || rows[0].ID != "w1" || len(rows[0].Points) != 8 || rows[0].Points[4] != 10 {
		t.Fatal(rows, err)
	}
	for _, v := range []map[string]any{{}, {"wires": nil}, {"wires": []any{segment("", 0)}}, {"wires": []any{map[string]any{"primitiveId": "w1"}}}} {
		if _, err := parseV2WirePolylines(v); err == nil {
			t.Fatal("malformed accepted", v)
		}
	}
	if rows, err := parseV2WirePolylines(map[string]any{"wires": []any{}}); err != nil || len(rows) != 0 {
		t.Fatal(rows, err)
	}
}

func TestPublicCatalogOmitsInternalRequestSchema(t *testing.T) {
	for _, a := range publicActionCatalog() {
		if _, ok := a["v2"]; ok {
			t.Fatal("internal schema", a)
		}
		in := a["inputs"].(map[string]string)
		if _, ok := in["session_token"]; ok {
			t.Fatal(a)
		}
		if _, ok := in["expected_project_uuid"]; ok {
			t.Fatal(a)
		}
		if a["name"] == "project.create" {
			if _, ok := in["client_transaction_id"]; ok {
				t.Fatal(a)
			}
		}
	}
}

func TestProjectCreateRejectsInternalFieldsAtPublicBoundary(t *testing.T) {
	for _, field := range []string{"expected_project_uuid", "session_token", "client_transaction_id", "activation", "daemon_session", "target_ref"} {
		input := map[string]any{"name": "Personal", field: "injected"}
		_, err := publicActionV2(&appConfig{ports: "invalid"}, "project.create", "", input, 0)
		if err == nil || !strings.Contains(err.Error(), "INVALID_PUBLIC_INPUT") {
			t.Fatalf("%s: %v", field, err)
		}
	}
}

func TestSnapshotBBoxShapeRejectedBeforeDaemon(t *testing.T) {
	for _, bbox := range []any{[]any{}, []any{1., 2., 3.}, []any{1., 2., 3., "4"}} {
		_, err := publicActionV2(&appConfig{ports: "invalid"}, "board.snapshot_compact", "", map[string]any{"bbox": bbox}, 0)
		if err == nil || !strings.Contains(err.Error(), "INVALID_PUBLIC_INPUT") {
			t.Fatalf("bbox=%#v err=%v", bbox, err)
		}
	}
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		var q executionv2.Request
		json.NewDecoder(r.Body).Decode(&q)
		json.NewEncoder(w).Encode(executionv2.Result{Protocol: executionv2.Version, OperationID: q.OperationID, EvidenceRef: q.OperationID, Outcome: executionv2.Succeeded, Effects: executionv2.Effects{Scope: "NONE", Settled: true}, Value: json.RawMessage(`{"board_revision":"r"}`)})
	}))
	defer server.Close()
	if _, err := publicActionV2(&appConfig{v2Read: fixtureReadBinding(server.URL)}, "board.snapshot_compact", "", map[string]any{"bbox": []any{1., 2., 3., 4.}}, 0); err != nil || requests != 1 {
		t.Fatal(err, requests)
	}
}

func TestBatchTransactionIdentityIsInternal(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var q executionv2.Request
		json.NewDecoder(r.Body).Decode(&q)
		if q.Input["client_transaction_id"] != q.OperationID {
			t.Errorf("not internally bound: %+v", q.Input)
		}
		json.NewEncoder(w).Encode(executionv2.Result{Protocol: executionv2.Version, OperationID: q.OperationID, EvidenceRef: q.OperationID, Outcome: executionv2.Succeeded, Effects: executionv2.Effects{Scope: "DESIGN_CONTENT", Settled: true}})
	}))
	defer server.Close()
	cfg := &appConfig{v2Read: fixtureReadBinding(server.URL)}
	_, err := publicActionV2(cfg, "placement.apply_batch", "", map[string]any{"base_revision": "r", "plan_hash": "h", "placements": []any{map[string]any{"primitiveId": "c", "x": 1., "y": 2., "rotation": 0., "layer": 1.}}}, 0)
	if err != nil {
		t.Fatal(err)
	}
}

func TestEffectScopeNoneReadNeverImplicitlyNavigates(t *testing.T) {
	var opened atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var q executionv2.Request
		json.NewDecoder(r.Body).Decode(&q)
		if q.Action == "document.open" {
			opened.Add(1)
		}
		value := `{}`
		if q.Action == "schematic.pages.list" {
			value = `{"pages":[]}`
		}
		if q.Action == "pcb.documents.list" {
			value = `{"pcbs":[{"uuid":"new-a","name":"new-a"},{"uuid":"new-b","name":"new-b"}]}`
		}
		json.NewEncoder(w).Encode(executionv2.Result{Protocol: executionv2.Version, OperationID: q.OperationID, EvidenceRef: q.OperationID, Outcome: executionv2.Succeeded, Effects: executionv2.Effects{Scope: "NONE", Settled: true}, Value: json.RawMessage(value)})
	}))
	defer server.Close()
	b := fixtureReadBinding(server.URL)
	b.target.DocumentUUID = "old"
	b.target.TabID = "old-tab"
	errors := make(chan error, 2)
	var wg sync.WaitGroup
	for _, doc := range []string{"new-a", "new-b"} {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := publicActionV2(&appConfig{doc: doc, v2Read: b}, "pcb.nets.list", "", nil, 0)
			errors <- err
		}()
	}
	wg.Wait()
	close(errors)
	for err := range errors {
		if err == nil || !strings.Contains(err.Error(), "V2_READ_TARGET_NOT_ACTIVE") {
			t.Fatal(err)
		}
	}
	if opened.Load() != 0 {
		t.Fatal("read raced through implicit navigation", opened.Load())
	}
}
