package app

import (
	"bytes"
	"encoding/json"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestV2CLIProjectionPreservesDaemonOutcome(t *testing.T) {
	for _, outcome := range []executionv2.Outcome{executionv2.Succeeded, executionv2.NotApplied, executionv2.Partial, executionv2.Unknown} {
		t.Run(string(outcome), func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				_ = json.NewEncoder(w).Encode(executionv2.Result{Protocol: executionv2.Version, OperationID: "op", Outcome: outcome, Effects: executionv2.Effects{Started: executionv2.Bool(false), Changed: executionv2.Bool(false), Settled: true, Scope: "NONE"}, EvidenceRef: "op"})
			}))
			defer server.Close()
			request := `{"protocol":"execution.v2","action":"document.current","action_revision":"1","schema":"s","request_id":"r","operation_id":"op","target_ref":{"scope":"HOME","session":"s","activation":"a"},"input":{},"budget_ms":100}`
			var stdout, stderr bytes.Buffer
			code := Run([]string{"v2", "--endpoint", server.URL, "call", request}, &stdout, &stderr)
			var exposed executionv2.Result
			if e := json.Unmarshal(stdout.Bytes(), &exposed); e != nil {
				t.Fatal(e, stdout.String(), stderr.String())
			}
			if exposed.Outcome != outcome {
				t.Fatal("CLI reinterpreted outcome", exposed)
			}
			if (code == 0) != (outcome == executionv2.Succeeded) {
				t.Fatal(code, outcome)
			}
		})
	}
}
