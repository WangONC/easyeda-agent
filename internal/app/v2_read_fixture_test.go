package app

import (
	"bytes"
	"encoding/json"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"net/http"
	"net/http/httptest"
)

// Test-only transport adapter for retained business fixtures. These suites test
// geometry/workflow behavior, NOT the production Outcome finalizer. New V2 read
// boundary tests supply native V2 receipts independently, without this adapter.
func withV2ReadFixture(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v2/operations" {
			next.ServeHTTP(w, r)
			return
		}
		var req executionv2.Request
		if json.NewDecoder(r.Body).Decode(&req) != nil {
			http.Error(w, "bad fixture request", 400)
			return
		}
		payload, _ := json.Marshal(map[string]any{"action": req.Action, "payload": req.Input})
		call := httptest.NewRequest("POST", "/action", bytes.NewReader(payload))
		out := httptest.NewRecorder()
		next.ServeHTTP(out, call)
		var fixture struct {
			Context *actionContext  `json:"context"`
			OK      bool            `json:"ok"`
			Result  json.RawMessage `json:"result"`
			Error   struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			} `json:"error"`
		}
		if json.Unmarshal(out.Body.Bytes(), &fixture) != nil {
			http.Error(w, "bad business fixture", 500)
			return
		}
		outcome := executionv2.NotApplied
		if fixture.OK {
			outcome = executionv2.Succeeded
		}
		if fixture.Context != nil && fixture.Context.ProjectUUID != "" && req.Target.ProjectUUID != "" && fixture.Context.ProjectUUID != req.Target.ProjectUUID {
			outcome = executionv2.Unknown
			fixture.Error.Code = "V2_TARGET_MISMATCH"
			fixture.Error.Message = "project drift in business fixture"
		}
		if fixture.Context != nil && req.Target.Scope == "DOCUMENT" && fixture.Context.DocumentUUID != "" && fixture.Context.DocumentUUID != req.Target.DocumentUUID {
			outcome = executionv2.Unknown
			fixture.Error.Code = "V2_TARGET_MISMATCH"
			fixture.Error.Message = "page drift in business fixture"
		}
		_ = json.NewEncoder(w).Encode(executionv2.Result{Protocol: executionv2.Version, OperationID: req.OperationID, EvidenceRef: req.OperationID, Outcome: outcome, Code: fixture.Error.Code + fixture.Error.Message, Effects: executionv2.Effects{Scope: "NONE", Started: executionv2.Bool(false), Changed: executionv2.Bool(false), Settled: true}, Value: fixture.Result})
	})
}
func fixtureReadBinding(endpoint string) *v2ReadBinding {
	return &v2ReadBinding{endpoint: endpoint, target: executionv2.Target{Scope: "DOCUMENT", Session: "fixture-session", Activation: "fixture-activation", ProjectUUID: "fixture-project", DocumentUUID: "fixture-document", DocumentType: "pcb", TabID: "fixture-tab"}}
}

func fixtureSchematicBinding(endpoint string) *v2ReadBinding {
	b := fixtureReadBinding(endpoint)
	b.target.DocumentType = "schematic"
	b.target.DocumentUUID = "doc-1"
	return b
}
