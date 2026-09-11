package daemon

import (
	"bytes"
	"encoding/json"
	"errors"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
	"io"
	"os"
	"path/filepath"
)

// This is a durable dispatch-intent marker, not a native completion receipt.
// Persisting before transport is deliberately conservative if the process dies
// between the write and dispatch: a started native effect must never go unmarked.
type v2Lifecycle struct {
	Version     string `json:"version"`
	State       string `json:"state"`
	OperationID string `json:"operation_id,omitempty"`
	Digest      string `json:"digest,omitempty"`
}

func (s *Server) inspectV2Lifecycle() error {
	if s.opts.V2ReceiptFile == "" {
		return nil
	}
	data, err := os.ReadFile(s.opts.V2ReceiptFile + ".active")
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	var m v2Lifecycle
	d := json.NewDecoder(bytes.NewReader(data))
	d.DisallowUnknownFields()
	var extra any
	valid := len(data) <= 4096 && d.Decode(&m) == nil && d.Decode(&extra) == io.EOF
	// Legacy/unrecognizable markers cannot prove that no effect started.
	s.v2UncleanStart = !valid || m.Version != "execution.v2.lifecycle.1" || m.State != "no_effect_started" || m.OperationID != "" || m.Digest != ""
	return nil
}

func (s *Server) v2StartupFenced() bool {
	return (s.v2UncleanStart && !s.opts.V2HostStartupConfirmed) ||
		(s.v2RestoredOwner != "" && s.v2.EffectOwner() == s.v2RestoredOwner)
}

// Called only after binding the singleton port, before accepting requests.
func (s *Server) markV2Running() error {
	if s.v2UncleanStart && !s.opts.V2HostStartupConfirmed {
		return nil
	}
	return s.writeV2Lifecycle(v2Lifecycle{Version: "execution.v2.lifecycle.1", State: "no_effect_started"})
}

// This gate runs before the first byte of an effectful request reaches Connector.
// Pure reads never change the marker; reconciliation never calls this gate.
func (s *Server) markV2Effect(r executionv2.Request, digest string) error {
	a, err := protocol.ValidateV2(r)
	if err != nil {
		return err
	}
	if a.EffectScope == "NONE" {
		return nil
	}
	return s.writeV2Lifecycle(v2Lifecycle{Version: "execution.v2.lifecycle.1", State: "effect_started", OperationID: r.OperationID, Digest: digest})
}

func (s *Server) writeV2Lifecycle(m v2Lifecycle) error {
	if s.opts.V2ReceiptFile == "" {
		return nil
	}
	path := s.opts.V2ReceiptFile + ".active"
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	data, err := json.Marshal(m)
	if err != nil {
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(path), ".lifecycle-*")
	if err != nil {
		return err
	}
	name := f.Name()
	defer os.Remove(name)
	_, err = f.Write(data)
	if err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	return os.Rename(name, path)
}

func (s *Server) saveV2Handoff() error {
	// SaveHandoff closes admission before saving. Even after /v2/handoff this
	// lifetime cannot write again. Pending ownership remains in the snapshot.
	if err := s.v2.SaveHandoff(s.opts.V2ReceiptFile); err != nil {
		return err
	}
	// A clean shutdown of a fenced lifetime cannot erase unknown prior work.
	if s.v2UncleanStart && !s.opts.V2HostStartupConfirmed {
		return nil
	}
	err := os.Remove(s.opts.V2ReceiptFile + ".active")
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	return err
}
