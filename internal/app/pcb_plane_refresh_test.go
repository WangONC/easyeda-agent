package app

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestPlaneRefreshRevisionAndPartialContract(t *testing.T) {
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
