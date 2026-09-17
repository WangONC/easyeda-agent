package daemon

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
)

const (
	defaultV2RecoveryBudget   = 6 * time.Second
	defaultV2RecoveryAttempts = 2
	defaultV2RecoveryPoll     = 50 * time.Millisecond
	defaultV2RequalifyBudget  = 20 * time.Second
	defaultV2RequalifyRead    = 10 * time.Second
)

func (s *Server) recoveryPolicy() (time.Duration, int) {
	budget := s.opts.V2RecoveryBudget
	if budget <= 0 {
		budget = defaultV2RecoveryBudget
	}
	attempts := s.opts.V2RecoveryAttempts
	if attempts <= 0 {
		attempts = defaultV2RecoveryAttempts
	}
	return budget, attempts
}

// autoRecoverV2 consumes only the existing operation and its registered fresh
// verifier. It may wait for native settlement and request read-only reconcile,
// but it never sends another v2_request and therefore cannot replay a mutation.
func (s *Server) autoRecoverV2(_ context.Context, req executionv2.Request, initial executionv2.Result) executionv2.Result {
	s.v2RecoveryMu.Lock()
	defer s.v2RecoveryMu.Unlock()
	budget, attempts := s.recoveryPolicy()
	started := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), budget)
	defer cancel()

	current := initial
	if annotated, err := s.v2.RecordRecovery(req.OperationID, 0); err == nil {
		current = annotated
	}
	finish := func(fallback executionv2.Result) executionv2.Result {
		if annotated, err := s.v2.RecordRecovery(req.OperationID, time.Since(started)); err == nil {
			return annotated
		}
		return fallback
	}
	for attempt := 0; ; {
		if latest, ok := s.v2.Status(req.OperationID); ok {
			current = latest
		}
		if current.Outcome.Terminal() {
			return finish(current)
		}
		if attempt < attempts {
			// Reconcile is safe even while the daemon's last receipt says pending:
			// the Connector either returns its now-settled verifier or refuses it.
			// It never invokes NativeAction.run.
			_ = s.requestV2Reconcile(ctx, req.OperationID)
			attempt++
		}

		select {
		case <-ctx.Done():
			if latest, ok := s.v2.Status(req.OperationID); ok {
				current = latest
			}
			if current.Outcome.Terminal() || !current.Effects.Settled {
				return finish(current)
			}
			evidence, ok := s.v2.Evidence(req.OperationID)
			if !ok {
				return finish(current)
			}
			digest, err := req.Digest()
			if err != nil {
				return finish(current)
			}
			retired, quarantine, err := s.v2.RetireUnresolved(req.OperationID, digest, executionv2.EvidenceFingerprint(evidence), "bounded recovery exhausted after native settlement", time.Since(started))
			if err != nil {
				return finish(current)
			}
			return s.autoRequalifyRetired(req.OperationID, retired, quarantine)
		case <-time.After(defaultV2RecoveryPoll):
		}
	}
}

func newRecoveryOperationID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "requal-" + hex.EncodeToString(b), nil
}

func v2ActionSpec(name string) (*protocol.V2Action, bool) {
	for _, action := range protocol.AllActions() {
		if action.Name == name && action.V2 != nil && action.V2.EffectScope == "NONE" {
			return action.V2, true
		}
	}
	return nil, false
}

func (s *Server) requalificationWindow(q executionv2.Quarantine) (Window, bool) {
	windows := s.hub.list()
	matches := []Window{}
	for _, window := range windows {
		switch q.Scope.Kind {
		case "DOCUMENT":
			if window.Context.ProjectUUID == q.Scope.ProjectUUID && window.Context.DocumentUUID == q.Scope.DocumentUUID && window.Context.DocumentType == q.Scope.DocumentType {
				matches = append(matches, window)
			}
		case "PROJECT", "LIBRARY":
			if window.Context.ProjectUUID == q.Scope.ProjectUUID {
				matches = append(matches, window)
			}
		default:
			if q.Scope.WindowID != "" && window.WindowID == q.Scope.WindowID {
				matches = append(matches, window)
			}
		}
	}
	if len(matches) == 1 {
		return matches[0], true
	}
	if newest, ok := newestExactDocumentDuplicate(matches); ok {
		return newest, true
	}
	return Window{}, false
}

func targetForRequalification(window Window, q executionv2.Quarantine, action string, spec *protocol.V2Action) (executionv2.Target, bool) {
	session := window.TransportID
	if session == "" {
		session = window.WindowID
	}
	base := executionv2.Target{Session: session, Activation: window.ActivationID}
	switch spec.Target {
	case "PROJECT":
		base.Scope, base.ProjectUUID = "PROJECT", q.Scope.ProjectUUID
	case "pcb", "schematic":
		if q.Scope.Kind != "DOCUMENT" || q.Scope.DocumentType != spec.Target || window.Context.TabID == "" {
			return executionv2.Target{}, false
		}
		base.Scope, base.ProjectUUID = "DOCUMENT", q.Scope.ProjectUUID
		base.DocumentUUID, base.DocumentType, base.TabID = q.Scope.DocumentUUID, q.Scope.DocumentType, window.Context.TabID
	case "ANY":
		switch q.Scope.Kind {
		case "LIBRARY":
			base.Scope, base.ProjectUUID, base.LibraryUUID = "LIBRARY", q.Scope.ProjectUUID, q.Scope.LibraryUUID
		default:
			if window.Context.ProjectUUID != "" && window.Context.DocumentUUID != "" && window.Context.DocumentType != "" && window.Context.TabID != "" {
				base.Scope, base.ProjectUUID = "DOCUMENT", window.Context.ProjectUUID
				base.DocumentUUID, base.DocumentType, base.TabID = window.Context.DocumentUUID, window.Context.DocumentType, window.Context.TabID
			} else if window.Context.ProjectUUID != "" {
				base.Scope, base.ProjectUUID = "PROJECT", window.Context.ProjectUUID
			} else {
				base.Scope = "HOME"
			}
		}
	default:
		return executionv2.Target{}, false
	}
	return base, base.Validate() == nil
}

// autoRequalifyRetired admits only new, exact-target NONE-effect reads after
// retirement. Every read has its own durable operation receipt and passes the
// same Coordinator proof used by the explicit operation requalify command.
func (s *Server) autoRequalifyRetired(id string, retired executionv2.Result, quarantine executionv2.Quarantine) executionv2.Result {
	window, ok := s.requalificationWindow(quarantine)
	if !ok {
		return retired
	}
	ctx, cancel := context.WithTimeout(context.Background(), defaultV2RequalifyBudget)
	defer cancel()
	for _, action := range quarantine.Required {
		spec, ok := v2ActionSpec(action)
		if !ok {
			return retired
		}
		target, ok := targetForRequalification(window, quarantine, action, spec)
		if !ok {
			return retired
		}
		op, err := newRecoveryOperationID()
		if err != nil {
			return retired
		}
		input := map[string]any{}
		if action == "board.snapshot_compact" {
			input["project_uuid"], input["document_uuid"] = target.ProjectUUID, target.DocumentUUID
		}
		request := executionv2.Request{Protocol: executionv2.Version, Action: action, ActionRevision: spec.Revision, Schema: spec.SchemaID(), RequestID: op, OperationID: op, LogicalWindowID: window.WindowID, Target: target, Input: input, BudgetMS: int(defaultV2RequalifyRead / time.Millisecond)}
		result, err := s.v2.Submit(ctx, request)
		if err != nil || result.Outcome != executionv2.Succeeded || result.Effects.Started == nil || *result.Effects.Started || !result.Effects.Settled {
			return retired
		}
		updated, err := s.v2.AutoRequalify(id, op)
		if err != nil {
			return retired
		}
		if updated.Requalified {
			if latest, exists := s.v2.Status(id); exists {
				return latest
			}
		}
	}
	return retired
}

func (s *Server) startBoundedV2Recovery(id string) {
	s.v2Mu.Lock()
	p, ok := s.v2Pending[id]
	s.v2Mu.Unlock()
	result, exists := s.v2.Status(id)
	if !ok || !exists || result.Outcome.Terminal() {
		return
	}
	go s.autoRecoverV2(context.Background(), p.request, result)
}

func (s *Server) requestV2Reconcile(ctx context.Context, id string) error {
	s.v2Mu.Lock()
	p, ok := s.v2Pending[id]
	s.v2Mu.Unlock()
	if !ok {
		return errors.New("V2_RECOVERY_RECORD_REQUIRED")
	}
	if p.conn == nil {
		return errors.New("V2_RECONCILIATION_UNAVAILABLE_AFTER_RESTART")
	}
	return p.conn.write(ctx, map[string]any{"type": "v2_reconcile", "operation_id": id})
}

const v2RetireUnresolvedProtocol = "execution.v2.retire-unresolved.1"

type v2RetireUnresolvedRequest struct {
	Protocol               string `json:"protocol"`
	OperationID            string `json:"operation_id"`
	Digest                 string `json:"digest"`
	EvidenceFingerprint    string `json:"evidence_fingerprint"`
	DaemonSession          string `json:"daemon_session"`
	Reason                 string `json:"reason"`
	NativeSettledConfirmed bool   `json:"native_settled_confirmed"`
}

type v2RequalifyRequest struct {
	Protocol      string `json:"protocol"`
	OperationID   string `json:"operation_id"`
	ReadOperation string `json:"read_operation_id"`
	DaemonSession string `json:"daemon_session"`
}

func loopbackRequest(r *http.Request) bool {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	ip := net.ParseIP(host)
	return err == nil && ip != nil && ip.IsLoopback()
}

func (s *Server) handleV2RetireUnresolved(w http.ResponseWriter, r *http.Request, id string) {
	if !loopbackRequest(r) {
		http.Error(w, "V2_RETIRE_UNRESOLVED_LOOPBACK_ONLY", http.StatusForbidden)
		return
	}
	var request v2RetireUnresolvedRequest
	if err := decodeV2(r, &request); err != nil {
		http.Error(w, "V2_INVALID_RETIRE_UNRESOLVED: "+err.Error(), http.StatusBadRequest)
		return
	}
	reason := strings.TrimSpace(request.Reason)
	if request.Protocol != v2RetireUnresolvedProtocol || request.OperationID == "" || id != request.OperationID || request.Digest == "" || request.EvidenceFingerprint == "" || request.DaemonSession != s.v2Session || !request.NativeSettledConfirmed || reason == "" || len(reason) > 512 {
		http.Error(w, "V2_INVALID_RETIRE_UNRESOLVED", http.StatusBadRequest)
		return
	}
	s.v2RecoveryMu.Lock()
	defer s.v2RecoveryMu.Unlock()
	result, quarantine, err := s.v2.RetireUnresolved(id, request.Digest, request.EvidenceFingerprint, reason, 0)
	if err != nil {
		http.Error(w, err.Error(), http.StatusConflict)
		return
	}
	writeV2(w, map[string]any{
		"protocol": v2RetireUnresolvedProtocol, "operation": result,
		"quarantine": quarantine, "native_replayed": false,
		"global_barrier_released":  true,
		"required_requalification": quarantine.Required,
	})
}

func (s *Server) handleV2Requalify(w http.ResponseWriter, r *http.Request, id string) {
	if !loopbackRequest(r) {
		http.Error(w, "V2_REQUALIFICATION_LOOPBACK_ONLY", http.StatusForbidden)
		return
	}
	var request v2RequalifyRequest
	if err := decodeV2(r, &request); err != nil {
		http.Error(w, "V2_INVALID_REQUALIFICATION: "+err.Error(), http.StatusBadRequest)
		return
	}
	if request.Protocol != "execution.v2.requalify.1" || request.OperationID == "" || id != request.OperationID || request.ReadOperation == "" || request.DaemonSession != s.v2Session {
		http.Error(w, "V2_INVALID_REQUALIFICATION", http.StatusBadRequest)
		return
	}
	s.v2RecoveryMu.Lock()
	defer s.v2RecoveryMu.Unlock()
	quarantine, err := s.v2.Requalify(id, request.ReadOperation)
	if err != nil {
		http.Error(w, err.Error(), http.StatusConflict)
		return
	}
	writeV2(w, map[string]any{
		"protocol": "execution.v2.requalify.1", "operation_id": id,
		"quarantine": quarantine, "scope_requalified": quarantine.Requalified,
		"native_replayed": false,
	})
}
