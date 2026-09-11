package daemon

import (
	"errors"
	"os"
	"path/filepath"
)

// One local marker detects a lifetime whose receipts were not handed off.
// It carries no operations and cannot authorize replay or release ownership.
func (s *Server) inspectV2Lifecycle() error {
	if s.opts.V2ReceiptFile == "" {
		return nil
	}
	_, err := os.Stat(s.opts.V2ReceiptFile + ".active")
	if err == nil {
		s.v2UncleanStart = true
		return nil
	}
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	return err
}

func (s *Server) v2StartupFenced() bool {
	return (s.v2UncleanStart && !s.opts.V2HostStartupConfirmed) ||
		(s.v2RestoredOwner != "" && s.v2.EffectOwner() == s.v2RestoredOwner)
}

// Called only after binding the singleton port, before accepting any requests.
func (s *Server) markV2Running() error {
	if s.opts.V2ReceiptFile == "" {
		return nil
	}
	path := s.opts.V2ReceiptFile + ".active"
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0600)
	if err != nil {
		return err
	}
	_, err = f.WriteString("execution.v2 running; handoff not saved\n")
	if err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err != nil {
		return err
	}
	return closeErr
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
