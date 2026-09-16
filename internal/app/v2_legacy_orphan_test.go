package app

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
)

func TestOperationRetireLegacyOrphanUsesExactHealthIdentity(t *testing.T) {
	const operation = "legacy-op"
	const digest = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	const fingerprint = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
	var retireCalls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/health":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"service": "easyeda-agent", "v2_session": "daemon-current",
				"v2_legacy_orphan": map[string]any{"operation_id": operation, "digest": digest, "marker_fingerprint": fingerprint, "retire_eligible": true},
			})
		case "/v2/operation":
			retireCalls.Add(1)
			if r.Method != http.MethodPost || r.URL.Query().Get("id") != operation || r.URL.Query().Get("view") != "retire-legacy-orphan" {
				t.Fatalf("request = %s %s", r.Method, r.URL.String())
			}
			var payload map[string]any
			if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
				t.Fatal(err)
			}
			if payload["protocol"] != legacyOrphanRetireProtocol || payload["daemon_session"] != "daemon-current" || payload["operation_id"] != operation || payload["digest"] != digest || payload["marker_fingerprint"] != fingerprint || payload["host_state_confirmed"] != true {
				t.Fatalf("payload = %#v", payload)
			}
			_, _ = w.Write([]byte(`{"disposition":"RETIRED_UNRESOLVED","semantic_outcome":"UNKNOWN","native_replayed":false}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()
	var out bytes.Buffer
	command := newV2Cmd(&out)
	command.SilenceUsage = true
	command.SetArgs([]string{"--endpoint", server.URL, "retire-legacy-orphan", operation, "--digest", digest, "--fingerprint", fingerprint, "--reason", "fresh readback matched", "--confirm-host-state"})
	if err := command.Execute(); err != nil {
		t.Fatal(err)
	}
	if retireCalls.Load() != 1 || !strings.Contains(out.String(), "RETIRED_UNRESOLVED") {
		t.Fatalf("calls=%d out=%s", retireCalls.Load(), out.String())
	}
}

func TestOperationRetireLegacyOrphanRequiresExplicitConfirmationBeforeNetwork(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { calls.Add(1) }))
	defer server.Close()
	command := newV2Cmd(&bytes.Buffer{})
	command.SilenceUsage = true
	command.SetArgs([]string{"--endpoint", server.URL, "retire-legacy-orphan", "legacy-op", "--digest", strings.Repeat("a", 64), "--reason", "checked"})
	if err := command.Execute(); err == nil || !strings.Contains(err.Error(), "CONFIRMATION_REQUIRED") {
		t.Fatalf("error = %v", err)
	}
	if calls.Load() != 0 {
		t.Fatalf("network calls before confirmation = %d", calls.Load())
	}
}

func TestPublicOperationExposesLegacyOrphanRetire(t *testing.T) {
	command := newOperationCmd(&bytes.Buffer{})
	found := false
	for _, child := range command.Commands() {
		if child.Name() == "retire-legacy-orphan" {
			found = true
		}
	}
	if !found {
		t.Fatal("public operation command filtered retire-legacy-orphan")
	}
}
