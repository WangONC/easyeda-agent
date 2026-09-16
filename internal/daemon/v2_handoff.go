package daemon

import (
	"errors"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
	"net/http"
	"os"
)

func (s *Server) restoreV2Handoff() error {
	if s.opts.V2ReceiptFile == "" {
		return nil
	}
	receipts, err := s.v2.RestoreHandoff(s.opts.V2ReceiptFile)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	for _, r := range receipts {
		// Immutable receipt restore is not current-schema request admission.
		// RestoreHandoff checks digest, identity, settlement and ownership; restored
		// records have no executor. New operation IDs still require ValidateV2.
		scope := ""
		for _, action := range protocol.AllActions() {
			if action.Name == r.Request.Action && action.V2 != nil {
				scope = action.V2.EffectScope
				break
			}
		}
		if scope == "" || scope != r.Scope {
			return errors.New("V2_HANDOFF_CATALOG_MISMATCH")
		}
		s.v2Pending[r.Request.OperationID] = v2Pending{request: r.Request, windowID: r.WindowID, restored: true, started: r.Request.ExecutionDeadline}
	}
	return nil
}

func (s *Server) v2RecoveryBindings() map[string]string {
	s.v2Mu.Lock()
	defer s.v2Mu.Unlock()
	out := make(map[string]string, len(s.v2Pending))
	for id, p := range s.v2Pending {
		window := p.windowID
		if window == "" && p.conn != nil {
			window = p.conn.id()
		}
		out[id] = window
	}
	return out
}

func (s *Server) persistV2Snapshot(h executionv2.Handoff) error {
	if s.opts.V2ReceiptFile == "" {
		return nil
	}
	bindings := s.v2RecoveryBindings()
	for i := range h.Receipts {
		if window := bindings[h.Receipts[i].Request.OperationID]; window != "" {
			h.Receipts[i].WindowID = window
		}
	}
	return executionv2.PersistHandoff(s.opts.V2ReceiptFile, h)
}
func (s *Server) handleV2Handoff(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "POST required", 405)
		return
	}
	if s.opts.V2ReceiptFile == "" {
		http.Error(w, "V2_RECEIPT_FILE_REQUIRED", 409)
		return
	}
	if err := s.saveV2Handoff(); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	writeV2(w, map[string]any{"protocol": executionv2.Version, "handoff": "saved", "admission": "closed"})
}
