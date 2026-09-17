package app

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
)

func TestRetireUnresolvedCLIUsesExactDaemonEvidence(t *testing.T) {
	operation := "settled-operation"
	target := executionv2.Target{Scope: "DOCUMENT", Session: "transport", Activation: "activation", ProjectUUID: "project", DocumentUUID: "document", DocumentType: "pcb", TabID: "tab"}
	evidence := executionv2.HandlerResult{Protocol: executionv2.Version, OperationID: operation, Digest: strings.Repeat("d", 64), Target: target, Effects: executionv2.Effects{Started: executionv2.Bool(true), Settled: true, Scope: "DESIGN_CONTENT"}, Verification: executionv2.Verification{Verdict: "unavailable"}}
	status := executionv2.Result{Protocol: executionv2.Version, OperationID: operation, Outcome: executionv2.Unknown, EvidenceRef: operation, Effects: evidence.Effects, BarrierMode: executionv2.BarrierGlobal}
	retired := status
	retired.Outcome, retired.Code, retired.BarrierMode, retired.RetiredUnresolved, retired.OwnershipReleased = executionv2.RetiredUnresolved, "V2_RETIRED_UNRESOLVED", executionv2.BarrierScoped, true, true
	var posted bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/health":
			_ = json.NewEncoder(w).Encode(map[string]any{"v2_session": "daemon-session"})
		case r.Method == http.MethodGet && r.URL.Query().Get("view") == "status":
			_ = json.NewEncoder(w).Encode(status)
		case r.Method == http.MethodGet && r.URL.Query().Get("view") == "evidence":
			_ = json.NewEncoder(w).Encode(evidence)
		case r.Method == http.MethodPost && r.URL.Query().Get("view") == "retire-unresolved":
			var request map[string]any
			if json.NewDecoder(r.Body).Decode(&request) != nil || request["operation_id"] != operation || request["digest"] != evidence.Digest || request["evidence_fingerprint"] != executionv2.EvidenceFingerprint(evidence) || request["daemon_session"] != "daemon-session" || request["native_settled_confirmed"] != true || request["reason"] != "bounded reads exhausted" {
				t.Errorf("unexpected retirement request: %#v", request)
			}
			posted = true
			_ = json.NewEncoder(w).Encode(map[string]any{"operation": retired})
		default:
			http.Error(w, "unexpected", http.StatusBadRequest)
		}
	}))
	defer server.Close()
	var output strings.Builder
	command := newV2UnresolvedRetireCmd(&server.URL, &output)
	command.SetArgs([]string{operation, "--reason", "bounded reads exhausted", "--confirm-native-settled"})
	if err := command.Execute(); err != nil || !posted {
		t.Fatal(err, posted, output.String())
	}
	var result executionv2.Result
	if json.Unmarshal([]byte(output.String()), &result) != nil || result.Outcome != executionv2.RetiredUnresolved || result.NativeReplayed {
		t.Fatal(output.String())
	}
}

func TestRetireUnresolvedCLIRequiresExplicitConfirmation(t *testing.T) {
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { requests++ }))
	defer server.Close()
	var output strings.Builder
	command := newV2UnresolvedRetireCmd(&server.URL, &output)
	command.SetArgs([]string{"operation", "--reason", "checked"})
	if err := command.Execute(); err == nil || !strings.Contains(err.Error(), "CONFIRMATION_REQUIRED") || requests != 0 {
		t.Fatal(err, requests)
	}
}

func TestRequalifyCLIBindsDaemonSessionAndReadReceipt(t *testing.T) {
	var posted bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			_ = json.NewEncoder(w).Encode(map[string]any{"v2_session": "daemon-session"})
			return
		}
		var request map[string]any
		_ = json.NewDecoder(r.Body).Decode(&request)
		posted = r.URL.Query().Get("view") == "requalify" && request["operation_id"] == "retired" && request["read_operation_id"] == "fresh-read" && request["daemon_session"] == "daemon-session"
		_ = json.NewEncoder(w).Encode(map[string]any{"protocol": "execution.v2.requalify.1", "scope_requalified": true})
	}))
	defer server.Close()
	var output strings.Builder
	command := newV2RequalifyCmd(&server.URL, &output)
	command.SetArgs([]string{"retired", "fresh-read"})
	if err := command.Execute(); err != nil || !posted || !strings.Contains(output.String(), `"scope_requalified":true`) {
		t.Fatal(err, posted, output.String())
	}
}
