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
		a, err := protocol.ValidateV2(r.Request)
		if err != nil || a.EffectScope != r.Scope {
			return errors.New("V2_HANDOFF_CATALOG_MISMATCH")
		}
		s.v2Pending[r.Request.OperationID] = v2Pending{request: r.Request}
	}
	return nil
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
	if err := s.v2.SaveHandoff(s.opts.V2ReceiptFile); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	writeV2(w, map[string]any{"protocol": executionv2.Version, "handoff": "saved", "admission": "closed"})
}
