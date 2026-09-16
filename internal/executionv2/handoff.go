package executionv2

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
)

// Handoff is a bounded local restart snapshot, not a mutation log. Nothing in
// this file authorizes executing a restored request.
type Handoff struct {
	Version  string    `json:"version"`
	Owner    string    `json:"owner,omitempty"`
	Receipts []Receipt `json:"receipts"`
}
type Receipt struct {
	Request  Request       `json:"request"`
	Digest   string        `json:"digest"`
	Result   Result        `json:"result"`
	Evidence HandlerResult `json:"evidence"`
	Scope    string        `json:"scope"`
	TimedOut bool          `json:"timed_out"`
	// WindowID is daemon routing provenance for restart reconciliation. It is
	// not part of the immutable V2 target/digest and never authorizes retargeting.
	WindowID string `json:"window_id,omitempty"`
}

// SaveHandoff closes admission before taking a consistent snapshot. On any IO
// failure admission stays closed, so a failed save cannot silently resume writes.
func (c *Coordinator) SaveHandoff(path string, windows ...map[string]string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.handingOff = true
	h := c.snapshotLocked(firstWindowMap(windows))
	return PersistHandoff(path, h)
}

// Snapshot returns a consistent, non-closing restart snapshot.
func (c *Coordinator) Snapshot(windows ...map[string]string) Handoff {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.snapshotLocked(firstWindowMap(windows))
}

func firstWindowMap(values []map[string]string) map[string]string {
	if len(values) == 0 {
		return nil
	}
	return values[0]
}

func (c *Coordinator) snapshotLocked(windows map[string]string) Handoff {
	h := Handoff{Version: "execution.v2.handoff.1", Owner: c.owner, Receipts: []Receipt{}}
	for _, r := range c.records {
		h.Receipts = append(h.Receipts, Receipt{Request: r.request, Digest: r.digest, Result: r.result, Evidence: r.evidence, Scope: r.scope, TimedOut: r.timedOut, WindowID: windows[r.request.OperationID]})
	}
	sort.Slice(h.Receipts, func(i, j int) bool { return h.Receipts[i].Request.OperationID < h.Receipts[j].Request.OperationID })
	return h
}

// PersistHandoff atomically writes an already-consistent snapshot.
func PersistHandoff(path string, h Handoff) error {
	data, err := json.Marshal(h)
	if err != nil {
		return err
	}
	return writeAtomic(path, data)
}

func writeAtomic(path string, data []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(path), ".receipt-*")
	if err != nil {
		return err
	}
	name := f.Name()
	defer os.Remove(name)
	if err = f.Chmod(0600); err == nil {
		_, err = f.Write(data)
	}
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

// RestoreHandoff must run before serving requests. It never calls an executor,
// finalizer, callback, or reconnects a historical socket.
func (c *Coordinator) RestoreHandoff(path string) ([]Receipt, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	if len(data) > 64<<20 {
		return nil, errors.New("V2_HANDOFF_TOO_LARGE")
	}
	d := json.NewDecoder(bytes.NewReader(data))
	d.DisallowUnknownFields()
	var h Handoff
	if err = d.Decode(&h); err != nil {
		return nil, err
	}
	var extra any
	if d.Decode(&extra) != io.EOF {
		return nil, errors.New("V2_HANDOFF_TRAILING_DATA")
	}
	if h.Version != "execution.v2.handoff.1" || h.Receipts == nil || len(h.Receipts) > c.capacity {
		return nil, errors.New("V2_INVALID_HANDOFF")
	}
	records := map[string]*record{}
	for _, saved := range h.Receipts {
		r := saved.Request
		digest, e := r.Digest()
		if e != nil || r.Validate() != nil || digest != saved.Digest || records[r.OperationID] != nil {
			return nil, errors.New("V2_HANDOFF_IDENTITY_MISMATCH")
		}
		result := saved.Result
		if result.Protocol != Version || result.OperationID != r.OperationID || result.EvidenceRef != r.OperationID || saved.Scope == "" || result.Effects.Scope != saved.Scope {
			return nil, errors.New("V2_HANDOFF_RESULT_MISMATCH")
		}
		switch result.Outcome {
		case Succeeded, NotApplied, Partial, Unknown:
		default:
			return nil, errors.New("V2_HANDOFF_OUTCOME_INVALID")
		}
		if result.OwnershipReleased && !result.Effects.Settled {
			return nil, errors.New("V2_HANDOFF_PENDING_RELEASE")
		}
		// A missing native observation remains missing after restart. Never derive
		// settled from exit, absence of a socket, or a client-provided status alone.
		if result.Effects.Settled {
			e := saved.Evidence
			if e.Protocol != Version || e.OperationID != r.OperationID || e.Digest != digest || e.Target != r.Target || e.Effects.Scope != saved.Scope || !e.Effects.Settled {
				return nil, errors.New("V2_HANDOFF_SETTLEMENT_UNPROVEN")
			}
		}
		ready := make(chan struct{})
		close(ready)
		records[r.OperationID] = &record{request: r, digest: digest, result: result, evidence: saved.Evidence, ready: ready, complete: true, timedOut: saved.TimedOut, scope: saved.Scope, released: result.OwnershipReleased, stop: make(chan struct{})}
	}
	if h.Owner != "" {
		owner := records[h.Owner]
		if owner == nil || owner.scope == "NONE" || owner.released || owner.result.Outcome != Unknown {
			return nil, errors.New("V2_HANDOFF_OWNER_INVALID")
		}
	}
	for id, r := range records {
		if r.scope != "NONE" && r.result.Outcome == Unknown && !r.released && id != h.Owner {
			return nil, fmt.Errorf("V2_HANDOFF_OWNER_MISSING: %s", id)
		}
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.records) != 0 {
		return nil, errors.New("V2_HANDOFF_REQUIRES_EMPTY_COORDINATOR")
	}
	c.records = records
	c.owner = h.Owner
	return h.Receipts, nil
}

// SaveHeldReceipt bootstraps a pre-handoff daemon's one explicitly identified,
// settled UNKNOWN owner from its live read-only status/evidence APIs. The caller
// must keep that old daemon fenced until this file is durable. This is not a
// general import API and cannot synthesize success or pending settlement.
func SaveHeldReceipt(path string, r Request, result Result, e HandlerResult) error {
	if _, err := os.Stat(path); err == nil {
		return errors.New("V2_HANDOFF_ALREADY_EXISTS")
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	d, err := r.Digest()
	if err != nil {
		return err
	}
	if result.Outcome != Unknown || result.OwnershipReleased || !result.Effects.Settled || !e.Effects.Settled || e.Effects.Started == nil || e.Effects.Scope == "NONE" || e.Protocol != Version || e.OperationID != r.OperationID || e.Digest != d || e.Target != r.Target {
		return errors.New("V2_HELD_RECEIPT_UNPROVEN")
	}
	h := Handoff{Version: "execution.v2.handoff.1", Owner: r.OperationID, Receipts: []Receipt{{Request: r, Digest: d, Result: result, Evidence: e, Scope: e.Effects.Scope, TimedOut: true}}}
	data, err := json.Marshal(h)
	if err != nil {
		return err
	}
	if err = os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	candidate, err := os.CreateTemp(filepath.Dir(path), ".handoff-validation-*")
	if err != nil {
		return err
	}
	name := candidate.Name()
	candidate.Close()
	defer os.Remove(name)
	if err = writeAtomic(name, data); err != nil {
		return err
	}
	verifier := New(2048, nil, nil)
	if _, err = verifier.RestoreHandoff(name); err != nil {
		return err
	}
	return os.Rename(name, path)
}

func (c *Coordinator) EffectOwner() string { c.mu.Lock(); defer c.mu.Unlock(); return c.owner }
