package daemon

import (
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const v2LegacyOrphanRetireProtocol = "execution.v2.legacy-orphan-retire.1"

type v2LegacyOrphanStatus struct {
	OperationID       string `json:"operation_id"`
	Digest            string `json:"digest"`
	MarkerFingerprint string `json:"marker_fingerprint"`
	Kind              string `json:"kind"`
	RetireEligible    bool   `json:"retire_eligible"`
	Reason            string `json:"reason"`
}

type v2LegacyOrphanRetireRequest struct {
	Protocol           string `json:"protocol"`
	OperationID        string `json:"operation_id"`
	Digest             string `json:"digest"`
	MarkerFingerprint  string `json:"marker_fingerprint"`
	DaemonSession      string `json:"daemon_session"`
	Reason             string `json:"reason"`
	HostStateConfirmed bool   `json:"host_state_confirmed"`
}

type v2LegacyOrphanAudit struct {
	Version           string    `json:"version"`
	RecordedAt        time.Time `json:"recorded_at"`
	OperationID       string    `json:"operation_id"`
	Digest            string    `json:"digest"`
	MarkerFingerprint string    `json:"marker_fingerprint"`
	Kind              string    `json:"kind"`
	DaemonSession     string    `json:"daemon_session"`
	SourceRevision    string    `json:"source_revision,omitempty"`
	Reason            string    `json:"reason"`
	Disposition       string    `json:"disposition"`
	SemanticOutcome   string    `json:"semantic_outcome"`
	NativeReplayed    bool      `json:"native_replayed"`
}

func (s *Server) v2LegacyOrphan() *v2LegacyOrphanStatus {
	if !s.v2UncleanStart || s.v2UncleanFingerprint == "" || s.v2.EffectOwner() != "" {
		return nil
	}
	kind := "unrecognized_marker"
	if s.v2UncleanOwner != "" && s.v2UncleanDigest != "" {
		if _, ok := s.v2.Status(s.v2UncleanOwner); ok {
			return nil
		}
		s.v2Mu.Lock()
		_, pending := s.v2Pending[s.v2UncleanOwner]
		s.v2Mu.Unlock()
		if pending {
			return nil
		}
		kind = "identified_operation"
	}
	return &v2LegacyOrphanStatus{
		OperationID: s.v2UncleanOwner, Digest: s.v2UncleanDigest,
		MarkerFingerprint: s.v2UncleanFingerprint, Kind: kind, RetireEligible: true,
		Reason: "durable lifecycle marker has no recoverable operation record",
	}
}

func (s *Server) appendV2LegacyOrphanAudit(a v2LegacyOrphanAudit) (string, error) {
	if s.opts.V2ReceiptFile == "" {
		return "", errors.New("V2_RECEIPT_FILE_REQUIRED")
	}
	path := s.opts.V2ReceiptFile + ".legacy-orphan-retirements.jsonl"
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return "", err
	}
	data, err := json.Marshal(a)
	if err != nil {
		return "", err
	}
	data = append(data, '\n')
	f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		return "", err
	}
	_, writeErr := f.Write(data)
	if writeErr == nil {
		writeErr = f.Sync()
	}
	closeErr := f.Close()
	if writeErr != nil {
		return "", writeErr
	}
	if closeErr != nil {
		return "", closeErr
	}
	return path, nil
}

func (s *Server) handleV2LegacyOrphanRetire(w http.ResponseWriter, r *http.Request, id string) {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil || net.ParseIP(host) == nil || !net.ParseIP(host).IsLoopback() {
		http.Error(w, "V2_LEGACY_ORPHAN_RETIRE_LOOPBACK_ONLY", http.StatusForbidden)
		return
	}
	var request v2LegacyOrphanRetireRequest
	if err := decodeV2(r, &request); err != nil {
		http.Error(w, "V2_INVALID_LEGACY_ORPHAN_RETIRE: "+err.Error(), http.StatusBadRequest)
		return
	}
	reason := strings.TrimSpace(request.Reason)
	if request.Protocol != v2LegacyOrphanRetireProtocol || !request.HostStateConfirmed || reason == "" || len(reason) > 512 {
		http.Error(w, "V2_INVALID_LEGACY_ORPHAN_RETIRE", http.StatusBadRequest)
		return
	}
	s.v2RecoveryMu.Lock()
	defer s.v2RecoveryMu.Unlock()
	if request.DaemonSession != s.v2Session {
		http.Error(w, "V2_LEGACY_ORPHAN_SESSION_MISMATCH", http.StatusConflict)
		return
	}
	orphan := s.v2LegacyOrphan()
	if orphan == nil {
		http.Error(w, "V2_LEGACY_ORPHAN_RETIRE_NOT_ELIGIBLE: durable operations must use status/reconcile", http.StatusConflict)
		return
	}
	if request.MarkerFingerprint == "" || request.MarkerFingerprint != orphan.MarkerFingerprint {
		http.Error(w, "V2_LEGACY_ORPHAN_IDENTITY_MISMATCH", http.StatusConflict)
		return
	}
	if orphan.OperationID != "" {
		if id == "" || id != request.OperationID || id != orphan.OperationID || request.Digest != orphan.Digest {
			http.Error(w, "V2_LEGACY_ORPHAN_IDENTITY_MISMATCH", http.StatusConflict)
			return
		}
	} else if id != "" || request.OperationID != "" || request.Digest != "" {
		http.Error(w, "V2_LEGACY_ORPHAN_IDENTITY_MISMATCH", http.StatusConflict)
		return
	}
	audit := v2LegacyOrphanAudit{
		Version: v2LegacyOrphanRetireProtocol, RecordedAt: time.Now().UTC(), OperationID: id,
		Digest: request.Digest, MarkerFingerprint: request.MarkerFingerprint, Kind: orphan.Kind,
		DaemonSession: s.v2Session, SourceRevision: s.opts.SourceRevision,
		Reason: reason, Disposition: "operator_retirement_authorized", SemanticOutcome: "UNKNOWN", NativeReplayed: false,
	}
	auditPath, err := s.appendV2LegacyOrphanAudit(audit)
	if err != nil {
		http.Error(w, "V2_LEGACY_ORPHAN_AUDIT_FAILED: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if err := s.writeV2Lifecycle(v2Lifecycle{Version: "execution.v2.lifecycle.1", State: "no_effect_started"}); err != nil {
		http.Error(w, "V2_LEGACY_ORPHAN_RETIRE_FAILED: "+err.Error(), http.StatusInternalServerError)
		return
	}
	s.v2UncleanStart = false
	s.v2UncleanOwner = ""
	s.v2UncleanDigest = ""
	s.v2UncleanFingerprint = ""
	writeV2(w, map[string]any{
		"protocol": v2LegacyOrphanRetireProtocol, "operation_id": id,
		"disposition": "RETIRED_UNRESOLVED", "semantic_outcome": "UNKNOWN",
		"startup_fenced": false, "native_replayed": false, "audit_file": filepath.Base(auditPath),
	})
}
