package daemon

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
	"github.com/zhoushoujianwork/easyeda-agent/internal/workflow"
	"io"
	"net/http"
	"time"
)

type v2Pending struct {
	started     time.Time
	request     executionv2.Request
	conn        *conn
	releaseConn *conn
	results     chan executionv2.HandlerResult
	windowID    string
	restored    bool
}

func rejectLegacy(w http.ResponseWriter, r *http.Request) {
	http.Error(w, "V2_ACTION_NOT_MIGRATED: use /v2/operations", http.StatusGone)
}
func decodeV2(r *http.Request, v any) error {
	d := json.NewDecoder(http.MaxBytesReader(nil, r.Body, 16<<20))
	d.DisallowUnknownFields()
	if e := d.Decode(v); e != nil {
		return e
	}
	var extra any
	if e := d.Decode(&extra); e != io.EOF {
		return errors.New("V2_TRAILING_DATA")
	}
	return nil
}
func writeV2(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}
func (s *Server) validateV2(r executionv2.Request) (executionv2.Admission, error) {
	a, e := protocol.ValidateV2(r)
	if e != nil {
		return a, e
	}
	if a.EffectScope != "NONE" && s.v2LifecycleBlocked() {
		return a, errors.New("V2_HOST_STARTUP_RECONCILIATION_REQUIRED")
	}
	if protocol.ActionDisabled(r.Action) {
		return executionv2.Admission{}, errors.New("CAPABILITY_DISABLED")
	}
	if r.Action == "system.health" {
		if r.Target.Session != s.v2Session || r.Target.Activation != s.v2Session {
			return a, errors.New("V2_SESSION_LOST")
		}
		return a, nil
	}
	c, ok := s.hub.get(r.Target.Session)
	if !ok {
		return a, errors.New("V2_SESSION_LOST")
	}
	snapshot := c.snapshot()
	if snapshot.TransportID != "" && snapshot.TransportID != r.Target.Session {
		return a, errors.New("V2_SESSION_LOST")
	}
	capable := false
	for _, cap := range snapshot.Capabilities {
		if cap == "execution.v2" {
			capable = true
		}
	}
	if !capable {
		return a, errors.New("V2_CONNECTOR_REQUIRED")
	}
	if r.Target.Activation != snapshot.ActivationID {
		return a, errors.New("V2_ACTIVATION_MISMATCH")
	}
	if r.Target.ProjectUUID != "" && r.Target.ProjectUUID != snapshot.Context.ProjectUUID {
		return a, errors.New("V2_TARGET_MISMATCH")
	}
	if r.Target.Scope == "DOCUMENT" && (r.Target.DocumentUUID != snapshot.Context.DocumentUUID || r.Target.DocumentType != snapshot.Context.DocumentType || r.Target.TabID != snapshot.Context.TabID) {
		return a, errors.New("V2_TARGET_MISMATCH")
	}
	if r.Action == "pcb.drc.compare" {
		if e := validateDrcV2(r); e != nil {
			return a, e
		}
	}
	if r.Action == "route.apply_batch" {
		if err := s.validateBatchV2(r); err != nil {
			return a, err
		}
	}
	if r.Action == "placement.apply_batch" {
		if err := s.validatePlacementBatchV2(r); err != nil {
			return a, err
		}
	}
	if gateForAction[r.Action] != "" {
		keys := []string{r.Target.ProjectUUID}
		if snapshot.Context.ProjectName != "" {
			keys = append(keys, snapshot.Context.ProjectName)
		}
		state, err := workflow.LoadAny(keys...)
		if err != nil {
			return a, fmt.Errorf("STAGE_BLOCKED: %w", err)
		}
		verdict := workflow.CheckRouteGate(state, false, false, "")
		if !verdict.Allowed {
			return a, fmt.Errorf("STAGE_BLOCKED: %s", verdict.Message)
		}
	}
	return a, nil
}
func (s *Server) executeV2(r executionv2.Request, digest string) <-chan executionv2.HandlerResult {
	ch := make(chan executionv2.HandlerResult, 8)
	if r.Action == "system.health" {
		value, _ := json.Marshal(map[string]any{"service": Service, "version": s.opts.Version, "source_revision": s.opts.SourceRevision, "windows": s.hub.listAnnotated(s.opts.Version)})
		ch <- executionv2.HandlerResult{Protocol: executionv2.Version, OperationID: r.OperationID, Digest: digest, Target: r.Target, Effects: executionv2.Effects{Started: executionv2.Bool(false), Changed: executionv2.Bool(false), Settled: true, Scope: "NONE"}, Verification: executionv2.Verification{Verdict: "satisfied", Checked: []string{"daemon_snapshot"}, Complete: true, Required: 1, Satisfied: 1}, Value: value}
		close(ch)
		return ch
	}
	c, ok := s.hub.get(r.Target.Session)
	if !ok {
		close(ch)
		return ch
	}
	s.v2Mu.Lock()
	s.v2Pending[r.OperationID] = v2Pending{request: r, conn: c, results: ch, started: time.Now(), windowID: c.id()}
	s.v2Mu.Unlock()
	// Fail closed before transport unless both the public operation record and
	// the effect-intent marker are durable.
	if err := s.markV2Effect(r, digest); err != nil {
		s.logf("V2 operation %s lifecycle persistence failed before dispatch: %v", r.OperationID, err)
		s.v2Mu.Lock()
		delete(s.v2Pending, r.OperationID)
		s.v2Mu.Unlock()
		close(ch)
		return ch
	}
	// Never tie native ownership to an HTTP caller's context or wait budget.
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if e := c.write(ctx, map[string]any{"type": "v2_request", "request": r, "digest": digest, "deadline_unix_ms": r.ExecutionDeadline.UnixMilli()}); e != nil {
			s.logf("V2 operation %s transport uncertain: %v", r.OperationID, e)
		}
	}()
	return ch
}
func (s *Server) deliverV2(c *conn, data []byte) {
	var frame struct {
		Type   string                    `json:"type"`
		Result executionv2.HandlerResult `json:"result"`
	}
	if e := json.Unmarshal(data, &frame); e != nil {
		return
	}
	s.v2Mu.Lock()
	p, ok := s.v2Pending[frame.Result.OperationID]
	s.v2Mu.Unlock()
	if !ok || p.conn != c {
		return
	} // exact transport ownership, never retired redirect
	result := telemetryV2(p.request, p.started, frame.Result, s.completeArtifactV2(p.request, s.completeFastReadV2(p.request, completeDrcV2(p.request, completeReportV2(p.request, frame.Result)))))
	if p.restored {
		if _, err := s.v2.ReconcileResult(p.request.OperationID, result); err != nil {
			s.logf("V2 restored reconciliation %s rejected: %v", p.request.OperationID, err)
		}
		return
	}
	select {
	case p.results <- result:
	default:
	}
}
func (s *Server) handleV2(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "POST required", 405)
		return
	}
	var req executionv2.Request
	if e := decodeV2(r, &req); e != nil {
		http.Error(w, "V2_INVALID_REQUEST: "+e.Error(), 400)
		return
	}
	result, e := s.v2.Submit(r.Context(), req)
	if e != nil {
		http.Error(w, e.Error(), 409)
		return
	}
	writeV2(w, result)
}
func (s *Server) handleV2Status(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if r.Method == "POST" && r.URL.Query().Get("view") == "retire-legacy-orphan" {
		s.handleV2LegacyOrphanRetire(w, r, id)
		return
	}
	if r.Method == "POST" && (r.URL.Query().Get("view") == "recover" || r.URL.Query().Get("view") == "release") {
		s.handleV2Recovery(w, r, id)
		return
	}
	if r.Method == "POST" {
		if r.URL.Query().Get("view") != "reconcile" {
			http.Error(w, "V2_UNSUPPORTED_OPERATION", 400)
			return
		}
		s.v2Mu.Lock()
		p, ok := s.v2Pending[id]
		s.v2Mu.Unlock()
		if !ok {
			http.NotFound(w, r)
			return
		}
		if result, exists := s.v2.Status(id); exists && (result.Outcome != executionv2.Unknown || result.OwnershipReleased) {
			// Repeat only the daemon's resolved release authorization. A lost
			// release frame must not require a second native invocation.
			digest, err := p.request.Digest()
			if err != nil {
				http.Error(w, err.Error(), 500)
				return
			}
			s.releaseV2(p.request, digest)
		} else if p.conn == nil {
			http.Error(w, "V2_RECONCILIATION_UNAVAILABLE_AFTER_RESTART: reconnect the original logical window/activation; operation remains queryable and fenced", 409)
			return
		} else if e := p.conn.write(r.Context(), map[string]any{"type": "v2_reconcile", "operation_id": id}); e != nil {
			http.Error(w, e.Error(), 503)
			return
		}
	} else if r.Method != "GET" {
		http.Error(w, "method not allowed", 405)
		return
	}
	if r.URL.Query().Get("view") == "evidence" {
		h, ok := s.v2.Evidence(id)
		if !ok {
			http.NotFound(w, r)
			return
		}
		writeV2(w, h)
		return
	}
	result, ok := s.v2.Status(id)
	if !ok {
		http.NotFound(w, r)
		return
	}
	writeV2(w, result)
}

// Bind only resolves exact identities from a currently registered activation.
// Connector fresh target guards remain authoritative before every native effect.
func (s *Server) handleV2Bind(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "POST required", 405)
		return
	}
	var t executionv2.Target
	if e := decodeV2(r, &t); e != nil {
		http.Error(w, e.Error(), 400)
		return
	}
	if e := t.Validate(); e != nil {
		http.Error(w, e.Error(), 400)
		return
	}
	c, ok := s.hub.get(t.Session)
	if !ok {
		http.Error(w, "V2_SESSION_LOST", 409)
		return
	}
	snap := c.snapshot()
	if snap.TransportID != "" && snap.TransportID != t.Session {
		http.Error(w, "V2_SESSION_LOST", 409)
		return
	}
	if t.Activation != snap.ActivationID || (t.ProjectUUID != "" && t.ProjectUUID != snap.Context.ProjectUUID) || (t.Scope == "DOCUMENT" && (t.DocumentUUID != snap.Context.DocumentUUID || t.TabID != snap.Context.TabID || t.DocumentType != snap.Context.DocumentType)) {
		http.Error(w, "V2_TARGET_MISMATCH", 409)
		return
	}
	writeV2(w, map[string]any{"target_ref": t, "verification": "connector_fresh_guard_required", "identity": fmt.Sprint(snap.ConnectedAt.UnixNano())})
}

func (s *Server) releaseV2(r executionv2.Request, digest string) {
	s.v2Mu.Lock()
	p, ok := s.v2Pending[r.OperationID]
	s.v2Mu.Unlock()
	if !ok {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	recipient := p.conn
	if p.releaseConn != nil {
		recipient = p.releaseConn
	}
	if recipient == nil || recipient.ws == nil {
		return
	}
	if recipient.snapshot().ActivationID != r.Target.Activation {
		return
	} // new activation has no original slot
	if e := recipient.write(ctx, map[string]any{"type": "v2_release", "operation_id": r.OperationID, "digest": digest, "deadline_unix_ms": r.ExecutionDeadline.UnixMilli()}); e != nil {
		s.logf("V2 release notification failed for %s: %v", r.OperationID, e)
	}
}

// Only the socket changes: operation/digest/activation/target and owner remain
// immutable. A different physical window or activation cannot adopt the slot.
func (s *Server) rebindV2Transport(current *conn) []string {
	now := current.snapshot()
	s.v2Mu.Lock()
	defer s.v2Mu.Unlock()
	var ids []string
	for id, p := range s.v2Pending {
		if p.conn == current {
			continue
		}
		beforeWindow, beforeActivation := p.windowID, p.request.Target.Activation
		if p.conn != nil {
			before := p.conn.snapshot()
			beforeWindow, beforeActivation = before.WindowID, before.ActivationID
		}
		if beforeWindow == "" || beforeWindow != now.WindowID || beforeActivation != now.ActivationID || p.request.Target.Activation != now.ActivationID {
			continue
		}
		p.conn = current
		p.windowID = now.WindowID
		if p.releaseConn != nil && p.releaseConn.snapshot().ActivationID == now.ActivationID && p.releaseConn.snapshot().WindowID == now.WindowID {
			p.releaseConn = current
		}
		s.v2Pending[id] = p
		ids = append(ids, id)
	}
	return ids
}
