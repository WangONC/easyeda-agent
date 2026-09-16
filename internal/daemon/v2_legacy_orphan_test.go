package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
)

func postLegacyOrphanRetire(t *testing.T, server, id string, payload map[string]any) (int, string) {
	t.Helper()
	data, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	response, err := http.Post(server+"/v2/operation?id="+id+"&view=retire-legacy-orphan", "application/json", bytes.NewReader(data))
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(response.Body)
	return response.StatusCode, string(body)
}

func legacyRetirePayload(s *Server, id, digest string) map[string]any {
	orphan := s.v2LegacyOrphan()
	fingerprint := s.v2UncleanFingerprint
	if orphan != nil {
		fingerprint = orphan.MarkerFingerprint
	}
	return map[string]any{
		"protocol": v2LegacyOrphanRetireProtocol, "operation_id": id, "digest": digest,
		"marker_fingerprint": fingerprint,
		"daemon_session":     s.v2Session, "reason": "fresh Host readback confirmed the legacy write state",
		"host_state_confirmed": true,
	}
}

func makeLegacyOrphan(t *testing.T, path string, confirmed bool) (*Server, executionv2.Request, string) {
	t.Helper()
	old := New(Options{V2ReceiptFile: path})
	request := startupRequest("pcb.save", "legacy-orphan")
	digest, err := request.Digest()
	if err != nil {
		t.Fatal(err)
	}
	if err := old.markV2Effect(request, digest); err != nil {
		t.Fatal(err)
	}
	return New(Options{V2ReceiptFile: path, V2HostStartupConfirmed: confirmed, SourceRevision: "test-revision"}), request, digest
}

func TestV2LegacyOrphanRetireReleasesOnlyExactFenceWithoutReplay(t *testing.T) {
	path := filepath.Join(t.TempDir(), "receipts.json")
	s, request, digest := makeLegacyOrphan(t, path, true)
	startupConn(s)
	if !s.v2StartupFenced() {
		t.Fatal("startup confirmation bypassed exact legacy orphan")
	}
	if got := s.v2LegacyOrphan(); got == nil || got.OperationID != request.OperationID || got.Digest != digest || !got.RetireEligible {
		t.Fatalf("legacy orphan diagnostic = %#v", got)
	}
	var nativeCalls atomic.Int32
	s.v2 = executionv2.New(32, s.validateV2, func(executionv2.Request, string) <-chan executionv2.HandlerResult {
		nativeCalls.Add(1)
		return make(chan executionv2.HandlerResult)
	})
	server := httptest.NewServer(s.routes(0))
	defer server.Close()
	healthResponse, err := http.Get(server.URL + "/health")
	if err != nil {
		t.Fatal(err)
	}
	var health struct {
		Legacy *v2LegacyOrphanStatus `json:"v2_legacy_orphan"`
	}
	if err := json.NewDecoder(healthResponse.Body).Decode(&health); err != nil {
		t.Fatal(err)
	}
	healthResponse.Body.Close()
	if health.Legacy == nil || health.Legacy.OperationID != request.OperationID || health.Legacy.MarkerFingerprint == "" {
		t.Fatalf("health legacy orphan = %#v", health.Legacy)
	}
	status, body := postLegacyOrphanRetire(t, server.URL, request.OperationID, legacyRetirePayload(s, request.OperationID, digest))
	if status != http.StatusOK || !strings.Contains(body, `"disposition":"RETIRED_UNRESOLVED"`) || !strings.Contains(body, `"semantic_outcome":"UNKNOWN"`) || !strings.Contains(body, `"native_replayed":false`) {
		t.Fatalf("retire = %d %s", status, body)
	}
	if s.v2StartupFenced() || s.v2LegacyOrphan() != nil {
		t.Fatal("exact legacy orphan fence remained")
	}
	if nativeCalls.Load() != 0 {
		t.Fatalf("native replay count = %d", nativeCalls.Load())
	}
	if _, err := s.validateV2(startupRequest("pcb.save", "next-write")); err != nil {
		t.Fatalf("next write remains fenced: %v", err)
	}
	audit, err := os.ReadFile(path + ".legacy-orphan-retirements.jsonl")
	if err != nil || !bytes.Contains(audit, []byte(request.OperationID)) || !bytes.Contains(audit, []byte(`"semantic_outcome":"UNKNOWN"`)) || !bytes.Contains(audit, []byte(`"native_replayed":false`)) {
		t.Fatalf("audit = %s, %v", audit, err)
	}
	marker, err := os.ReadFile(path + ".active")
	if err != nil || !bytes.Contains(marker, []byte(`"state":"no_effect_started"`)) {
		t.Fatalf("marker = %s, %v", marker, err)
	}
	if restarted := New(Options{V2ReceiptFile: path}); restarted.v2StartupErr != nil || restarted.v2StartupFenced() {
		t.Fatalf("retirement did not survive restart: %v", restarted.v2StartupErr)
	}
}

func TestV2DurableUnknownCannotBeRetiredAsLegacyOrphan(t *testing.T) {
	path := filepath.Join(t.TempDir(), "receipts.json")
	request := startupRequest("pcb.save", "durable-unknown")
	digest, _ := request.Digest()
	result := executionv2.Result{Protocol: executionv2.Version, OperationID: request.OperationID, Outcome: executionv2.Unknown, Code: "V2_DEADLINE", EvidenceRef: request.OperationID, Effects: executionv2.Effects{Started: executionv2.Bool(true), Settled: false, Scope: "SAVE"}}
	handoff := executionv2.Handoff{Version: "execution.v2.handoff.1", Owner: request.OperationID, Receipts: []executionv2.Receipt{{Request: request, Digest: digest, Result: result, Scope: "SAVE", TimedOut: true}}}
	if err := executionv2.PersistHandoff(path, handoff); err != nil {
		t.Fatal(err)
	}
	old := New(Options{V2ReceiptFile: path})
	if err := old.writeV2Lifecycle(v2Lifecycle{Version: "execution.v2.lifecycle.1", State: "effect_started", OperationID: request.OperationID, Digest: digest}); err != nil {
		t.Fatal(err)
	}
	s := New(Options{V2ReceiptFile: path})
	server := httptest.NewServer(s.routes(0))
	defer server.Close()
	status, body := postLegacyOrphanRetire(t, server.URL, request.OperationID, legacyRetirePayload(s, request.OperationID, digest))
	if status != http.StatusConflict || !strings.Contains(body, "V2_LEGACY_ORPHAN_RETIRE_NOT_ELIGIBLE") {
		t.Fatalf("retire durable UNKNOWN = %d %s", status, body)
	}
	if got, ok := s.v2.Status(request.OperationID); !ok || got.Outcome != executionv2.Unknown || s.v2.EffectOwner() != request.OperationID || !s.v2StartupFenced() {
		t.Fatalf("durable owner changed: %#v %v owner=%q fenced=%v", got, ok, s.v2.EffectOwner(), s.v2StartupFenced())
	}
}

func TestV2LegacyOrphanRetireIdentityFailuresStayFenced(t *testing.T) {
	tests := []struct {
		name       string
		change     func(*Server, executionv2.Request, string, map[string]any) string
		wantStatus int
		want       string
	}{
		{"wrong URL operation", func(_ *Server, _ executionv2.Request, _ string, _ map[string]any) string { return "other" }, http.StatusConflict, "IDENTITY_MISMATCH"},
		{"wrong payload operation", func(_ *Server, r executionv2.Request, _ string, p map[string]any) string {
			p["operation_id"] = "other"
			return r.OperationID
		}, http.StatusConflict, "IDENTITY_MISMATCH"},
		{"wrong digest", func(_ *Server, r executionv2.Request, _ string, p map[string]any) string {
			p["digest"] = strings.Repeat("0", 64)
			return r.OperationID
		}, http.StatusConflict, "IDENTITY_MISMATCH"},
		{"wrong fingerprint", func(_ *Server, r executionv2.Request, _ string, p map[string]any) string {
			p["marker_fingerprint"] = strings.Repeat("0", 64)
			return r.OperationID
		}, http.StatusConflict, "IDENTITY_MISMATCH"},
		{"wrong session", func(_ *Server, r executionv2.Request, _ string, p map[string]any) string {
			p["daemon_session"] = "old-session"
			return r.OperationID
		}, http.StatusConflict, "SESSION_MISMATCH"},
		{"missing confirmation", func(_ *Server, r executionv2.Request, _ string, p map[string]any) string {
			p["host_state_confirmed"] = false
			return r.OperationID
		}, http.StatusBadRequest, "INVALID_LEGACY_ORPHAN_RETIRE"},
		{"missing reason", func(_ *Server, r executionv2.Request, _ string, p map[string]any) string {
			p["reason"] = ""
			return r.OperationID
		}, http.StatusBadRequest, "INVALID_LEGACY_ORPHAN_RETIRE"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "receipts.json")
			s, request, digest := makeLegacyOrphan(t, path, false)
			server := httptest.NewServer(s.routes(0))
			defer server.Close()
			payload := legacyRetirePayload(s, request.OperationID, digest)
			id := tt.change(s, request, digest, payload)
			status, body := postLegacyOrphanRetire(t, server.URL, id, payload)
			if status != tt.wantStatus || !strings.Contains(body, tt.want) {
				t.Fatalf("failure = %d %s", status, body)
			}
			if !s.v2StartupFenced() || s.v2LegacyOrphan() == nil {
				t.Fatal("failed retirement released fence")
			}
		})
	}
}

func TestV2LegacyOrphanRetireEndpointRejectsNonLoopback(t *testing.T) {
	path := filepath.Join(t.TempDir(), "receipts.json")
	s, request, digest := makeLegacyOrphan(t, path, false)
	payload, _ := json.Marshal(legacyRetirePayload(s, request.OperationID, digest))
	r := httptest.NewRequestWithContext(context.Background(), http.MethodPost, "/v2/operation?id="+request.OperationID+"&view=retire-legacy-orphan", bytes.NewReader(payload))
	r.RemoteAddr = "203.0.113.5:1234"
	w := httptest.NewRecorder()
	s.handleV2Status(w, r)
	if w.Code != http.StatusForbidden || !s.v2StartupFenced() {
		t.Fatalf("non-loopback = %d %s", w.Code, w.Body.String())
	}
}

func TestV2UnrecognizedLegacyMarkerRequiresExactFingerprintRetire(t *testing.T) {
	path := filepath.Join(t.TempDir(), "receipts.json")
	if err := os.WriteFile(path+".active", []byte("legacy-unrecognized-marker"), 0600); err != nil {
		t.Fatal(err)
	}
	s := New(Options{V2ReceiptFile: path, V2HostStartupConfirmed: true})
	startupConn(s)
	orphan := s.v2LegacyOrphan()
	if !s.v2StartupFenced() || orphan == nil || orphan.Kind != "unrecognized_marker" || orphan.OperationID != "" || orphan.MarkerFingerprint == "" {
		t.Fatalf("unrecognized marker diagnostic = %#v fenced=%v", orphan, s.v2StartupFenced())
	}
	server := httptest.NewServer(s.routes(0))
	defer server.Close()
	payload := map[string]any{
		"protocol": v2LegacyOrphanRetireProtocol, "operation_id": "", "digest": "",
		"marker_fingerprint": orphan.MarkerFingerprint, "daemon_session": s.v2Session,
		"reason": "fresh Host inspection found no unresolved native effect", "host_state_confirmed": true,
	}
	status, body := postLegacyOrphanRetire(t, server.URL, "", payload)
	if status != http.StatusOK || !strings.Contains(body, "RETIRED_UNRESOLVED") || s.v2StartupFenced() {
		t.Fatalf("raw marker retire = %d %s fenced=%v", status, body, s.v2StartupFenced())
	}
	if restarted := New(Options{V2ReceiptFile: path}); restarted.v2StartupFenced() {
		t.Fatal("raw marker retirement did not survive restart")
	}
}

func TestV2LegacyOrphanRetirePersistenceFailureKeepsFence(t *testing.T) {
	path := filepath.Join(t.TempDir(), "receipts.json")
	s, request, digest := makeLegacyOrphan(t, path, false)
	if err := os.Remove(path + ".active"); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(path+".active", 0700); err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(s.routes(0))
	defer server.Close()
	status, body := postLegacyOrphanRetire(t, server.URL, request.OperationID, legacyRetirePayload(s, request.OperationID, digest))
	if status != http.StatusInternalServerError || !strings.Contains(body, "V2_LEGACY_ORPHAN_RETIRE_FAILED") {
		t.Fatalf("persistence failure = %d %s", status, body)
	}
	if !s.v2StartupFenced() || s.v2LegacyOrphan() == nil {
		t.Fatal("persistence failure released legacy fence")
	}
}
