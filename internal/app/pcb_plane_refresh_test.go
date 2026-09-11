package app

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestPlaneRefreshRevisionAndPartialContract(t *testing.T) {
	t.Skip("ARCHIVED: retired CLI reducer contract; TestPlaneRefreshUsesSingleV2Receipt covers the public path")
	for _, mode := range []string{"complete", "stale", "partial", "unchanged"} {
		t.Run(mode, func(t *testing.T) {
			calls := []string{}
			reads := 0
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == "/health" {
					fmt.Fprint(w, `{"service":"easyeda-agent","windows":[{"windowId":"w"}]}`)
					return
				}
				var q struct {
					Action  string         `json:"action"`
					Payload map[string]any `json:"payload"`
				}
				json.NewDecoder(r.Body).Decode(&q)
				calls = append(calls, q.Action)
				result := map[string]any{}
				switch q.Action {
				case "board.snapshot_compact":
					reads++
					rev := "R1"
					if mode == "stale" || reads > 1 && mode != "unchanged" {
						rev = "R2"
					}
					result["board_revision"] = rev
				case "pcb.pour.rebuild":
					result["status"] = "complete"
					if mode == "partial" {
						result["status"] = "partial"
					}
					result["item_results"] = []any{map[string]any{"logical_id": "GND@L1", "current_native_id": "new", "previous_native_id": "old", "recreated": true}}
				default:
					t.Errorf("unexpected action %s", q.Action)
				}
				json.NewEncoder(w).Encode(map[string]any{"ok": true, "result": result})
			}))
			defer srv.Close()
			host, port, _ := strings.Cut(strings.TrimPrefix(srv.URL, "http://"), ":")
			var out, errOut bytes.Buffer
			cmd := newPcbCmd(&appConfig{host: host, ports: port + "-" + port}, &out, &errOut)
			cmd.SetArgs([]string{"plane-refresh", "--window", "w", "--payload", `{"project_uuid":"p","document_uuid":"d","base_revision":"R1","logical_ids":["GND@L1"]}`})
			err := cmd.Execute()
			if mode == "stale" {
				if err == nil || len(calls) != 1 {
					t.Fatal(calls, err)
				}
				return
			}
			if len(calls) != 3 || calls[1] != "pcb.pour.rebuild" {
				t.Fatal(calls)
			}
			var value struct {
				OK     bool           `json:"ok"`
				Result map[string]any `json:"result"`
			}
			if e := json.Unmarshal(out.Bytes(), &value); e != nil {
				t.Fatal(out.String(), e)
			}
			if value.OK != (mode == "complete") || (err == nil) != (mode == "complete") {
				t.Fatal(value, err)
			}
			if value.Result["connectivity"] != "unknown" {
				t.Fatal(value)
			}
			if mode == "unchanged" && value.Result["status"] != "uncertain" {
				t.Fatal(value)
			}
		})
	}
}

func TestPlaneRefreshUsesSingleV2Receipt(t *testing.T) {
	for _, outcome := range []executionv2.Outcome{executionv2.Succeeded, executionv2.Partial, executionv2.Unknown, executionv2.NotApplied} {
		t.Run(string(outcome), func(t *testing.T) {
			calls := 0
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls++
				if r.URL.Path != "/v2/operations" {
					t.Errorf("unexpected path %s", r.URL.Path)
					http.NotFound(w, r)
					return
				}
				var q executionv2.Request
				if err := json.NewDecoder(r.Body).Decode(&q); err != nil {
					t.Error(err)
				}
				if q.Action != "pcb.plane.refresh" || q.Input["base_revision"] != "R1" {
					t.Errorf("request %+v", q)
				}
				json.NewEncoder(w).Encode(executionv2.Result{Protocol: executionv2.Version, OperationID: q.OperationID, EvidenceRef: q.OperationID, Outcome: outcome, Effects: executionv2.Effects{Scope: "NATIVE_RECOMPUTE", Settled: true}, Value: json.RawMessage(`{"status":"complete","connectivity":"unknown"}`)})
			}))
			defer srv.Close()
			cfg := &appConfig{v2Read: fixtureReadBinding(srv.URL)}
			var out, stderr bytes.Buffer
			cmd := newPcbCmd(cfg, &out, &stderr)
			cmd.SetArgs([]string{"plane-refresh", "--payload", `{"base_revision":"R1"}`})
			err := cmd.Execute()
			var result executionv2.Result
			if e := json.Unmarshal(out.Bytes(), &result); e != nil {
				t.Fatal(e, out.String())
			}
			if calls != 1 || result.Outcome != outcome || (err == nil) != (outcome == executionv2.Succeeded) {
				t.Fatal(calls, result, err)
			}
		})
	}
}
