package app

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/zhoushoujianwork/easyeda-agent/internal/fastpath"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
)

func TestScopedGeometryMeasurementDoesNotGuessBranchPath(t *testing.T) {
	s := fastpath.Snapshot{Traces: []fastpath.Primitive{{ID: "a", Kind: "trace", Net: "N", Layer: 1, Width: 6, Points: []fastpath.Point{{0, 0}, {100, 0}}}, {ID: "stub", Kind: "trace", Net: "N", Layer: 1, Width: 6, Points: []fastpath.Point{{50, 0}, {50, 20}}}, {ID: "arc", Kind: "arc", Net: "A", Layer: 2, ArcLength: 15, Points: []fastpath.Point{{0, 0}, {10, 10}}}}, Vias: []fastpath.Primitive{{ID: "v", Kind: "via", Net: "N"}}}
	r := measureGeometry(s, []string{"N", "A"}, nil)
	if r[0]["trace_copper_length"] != 120.0 || r[0]["path_completeness"] != "unresolved" || r[0]["via_count"] != 1 || r[1]["trace_copper_length"] != 15.0 {
		t.Fatal(r)
	}
	r = measureGeometry(s, []string{"N"}, []measurePath{{Net: "N", IDs: []string{"a"}, Start: fastpath.Point{0, 0}, End: fastpath.Point{100, 0}}})
	if r[0]["physical_path_length"] != 100.0 {
		t.Fatal(r)
	}
	r = measureGeometry(s, []string{"N"}, []measurePath{{Net: "N", IDs: []string{"a", "v"}, Start: fastpath.Point{0, 0}, End: fastpath.Point{100, 0}}})
	if r[0]["path_completeness"] != "unresolved" {
		t.Fatal("unknown via span accepted", r)
	}
}

func TestMeasurementToleranceAndReferenceAreCopperMetrics(t *testing.T) {
	pair := map[string]any{"skew": 4.0}
	group := map[string]any{"members": []any{map[string]any{"length": 100.0}, map[string]any{"length": 104.0}}}
	r := map[string]any{"nets": []any{map[string]any{"net": "P", "length": 100.0}, map[string]any{"net": "N", "length": 104.0}}, "differentialPairs": []any{pair}, "equalLengthNetGroups": []any{group}}
	if e := annotateMeasurementReport(r, map[string]any{"reference_net": "P", "tolerance_mil": 3.0}); e != nil {
		t.Fatal(e)
	}
	if pair["tolerance_verdict"] != "FAIL" || group["minimum"] != 100.0 || group["maximum"] != 104.0 || r["copper_length_delta"].(map[string]float64)["N"] != 4 {
		t.Fatal(r)
	}
	group["members"] = []any{map[string]any{"length": nil}}
	annotateMeasurementReport(r, map[string]any{"tolerance_mil": 10.0})
	if group["tolerance_verdict"] != "unresolved" {
		t.Fatal(group)
	}
}

func TestMeasurementProfileRequiresReviewedWidth(t *testing.T) {
	s := fastpath.Snapshot{Traces: []fastpath.Primitive{{ID: "t", Kind: "trace", Layer: 1, Width: 6}}}
	paths := []measurePath{{Net: "N", IDs: []string{"t"}}}
	p := fastpath.RoutingProfile{SignalLayer: 1, Width: 6}
	if !pathMatchesProfile(s, paths, "N", p) {
		t.Fatal("matching geometry rejected")
	}
	p.Width = 8
	if pathMatchesProfile(s, paths, "N", p) {
		t.Fatal("wrong width accepted for delay profile")
	}
}

func TestScopedPairReferenceNet(t *testing.T) {
	r := map[string]any{"differentialPairs": []any{map[string]any{"positiveNet": "P", "negativeNet": "N", "positiveLength": 436.0, "negativeLength": 488.0}}}
	if err := annotateMeasurementReport(r, map[string]any{"reference_net": "P"}); err != nil {
		t.Fatal(err)
	}
	d, ok := r["copper_length_delta"].(map[string]float64)
	if !ok || d["N"] != 52 || d["P"] != 0 {
		t.Fatal(r)
	}
}

func TestReportProfileCannotBeIgnoredWithoutGeometryFlag(t *testing.T) {
	for _, state := range []string{"MANUFACTURER_VERIFIED", "STALE"} {
		t.Run(state, func(t *testing.T) {
			profileRead := false
			srv := httptest.NewServer(withV2ReadFixture(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == "/health" {
					fmt.Fprint(w, `{"service":"easyeda-agent","windows":[{"windowId":"w1"}]}`)
					return
				}
				var req struct {
					Action string `json:"action"`
				}
				json.NewDecoder(r.Body).Decode(&req)
				result := map[string]any{}
				switch req.Action {
				case "pcb.documents.list":
					result["pcbs"] = []any{map[string]any{"uuid": "d", "name": "fixture", "parentProjectUuid": "p"}}
				case "pcb.report":
					result["nets"] = []any{map[string]any{"net": "N", "length": 10}}
				case "board.snapshot_compact":
					result["board_revision"] = "r1"
				case "pcb.routing_profile":
					profileRead = true
					result["profile"] = fastpath.RoutingProfile{ID: "p"}
					result["state"] = state
					result["stale_reason"] = "ROUTING_RULES_CHANGED"
					result["board_revision"] = "r1"
				}
				json.NewEncoder(w).Encode(map[string]any{"ok": true, "result": result, "context": map[string]any{"projectUuid": "p", "documentUuid": "d", "documentType": "pcb"}})
			})))
			defer srv.Close()
			host, portText, _ := strings.Cut(strings.TrimPrefix(srv.URL, "http://"), ":")
			port, _ := strconv.Atoi(portText)
			cfg := &appConfig{host: host, ports: fmt.Sprintf("%d-%d", port, port)}
			cfg.v2Read = fixtureReadBinding(srv.URL)
			cfg.v2Read.window = "w1"
			cfg.v2Read.target.ProjectUUID = "p"
			cfg.v2Read.target.DocumentUUID = "d"
			var out, errout bytes.Buffer
			e := pcbReportScoped(cfg, "w1", `{"project_uuid":"p","document_uuid":"d","profile_id":"p","nets":["N"]}`, &out, &errout)
			if e != nil {
				t.Fatal(e, errout.String())
			}
			var response struct {
				Result map[string]any `json:"value"`
			}
			json.Unmarshal(out.Bytes(), &response)
			if !profileRead || response.Result["profile_state"] != state || response.Result["profile_usable"] != (state == "MANUFACTURER_VERIFIED") {
				t.Fatal(out.String())
			}
		})
	}
}
