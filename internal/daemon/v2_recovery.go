package daemon

import (
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
	"net/http"
)

// Recovery dispatches only a new typed READ, never the original handler. Its
// receipt is separate: read success cannot repair the old semantic Outcome.
func (s *Server) handleV2Recovery(w http.ResponseWriter, r *http.Request, id string) {
	s.v2Mu.Lock()
	p, ok := s.v2Pending[id]
	s.v2Mu.Unlock()
	if !ok {
		http.NotFound(w, r)
		return
	}
	var read executionv2.Request
	if err := decodeV2(r, &read); err != nil {
		http.Error(w, "V2_INVALID_RECOVERY: "+err.Error(), 400)
		return
	}
	if read.OperationID == id || read.ParentOperationID != "" || !executionv2.SameRecoveryDocument(p.request.Target, read.Target) {
		http.Error(w, "V2_RECOVERY_TARGET_MISMATCH", 409)
		return
	}
	admission, err := protocol.ValidateV2(read)
	if err != nil || admission.EffectScope != "NONE" {
		http.Error(w, "V2_RECOVERY_READ_ONLY", 409)
		return
	}
	release := r.URL.Query().Get("view") == "release"
	if release && read.Action != "document.current" {
		http.Error(w, "V2_RECOVERY_IDENTITY_READ_REQUIRED", 409)
		return
	}
	// Cached read receipts cannot prove the present session is still bound.
	if _, exists := s.v2.Status(read.OperationID); exists {
		http.Error(w, "V2_FRESH_RECOVERY_REQUEST_REQUIRED", 409)
		return
	}
	result, err := s.v2.Submit(r.Context(), read)
	if err != nil {
		http.Error(w, err.Error(), 409)
		return
	}
	original, _ := s.v2.Status(id)
	if release && result.Outcome == executionv2.Succeeded {
		recipient, found := s.hub.get(read.Target.Session)
		if !found {
			http.Error(w, "V2_SESSION_LOST", 409)
			return
		}
		snap := recipient.snapshot()
		if snap.ActivationID != read.Target.Activation || snap.Context.ProjectUUID != read.Target.ProjectUUID || snap.Context.DocumentUUID != read.Target.DocumentUUID || snap.Context.DocumentType != read.Target.DocumentType || snap.Context.TabID != read.Target.TabID {
			http.Error(w, "V2_RECOVERY_TARGET_MISMATCH", 409)
			return
		}
		s.v2Mu.Lock()
		p = s.v2Pending[id]
		p.releaseConn = recipient
		s.v2Pending[id] = p
		s.v2Mu.Unlock()
		original, err = s.v2.ReleaseSettled(id, read.OperationID)
		if err != nil {
			http.Error(w, err.Error(), 409)
			return
		}
	}
	writeV2(w, map[string]any{"operation": original, "readback": result})
}
