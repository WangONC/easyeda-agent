package daemon

import (
	"context"
	"errors"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
)

const (
	defaultV2RecoveryBudget   = 6 * time.Second
	defaultV2RecoveryAttempts = 2
	defaultV2RecoveryPoll     = 50 * time.Millisecond
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
			retired, _, err := s.v2.RetireUnresolved(req.OperationID, digest, executionv2.EvidenceFingerprint(evidence), "bounded recovery exhausted after native settlement", time.Since(started))
			if err != nil {
				return finish(current)
			}
			return retired
		case <-time.After(defaultV2RecoveryPoll):
		}
	}
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
