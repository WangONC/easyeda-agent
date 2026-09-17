package executionv2

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"sort"
	"time"
)

// Quarantine is durable operation state, not an advisory. It narrows a settled
// unresolved operation from Host-global exclusion to the smallest stable
// identity that can contain its possible effects.
type Quarantine struct {
	OperationID   string        `json:"operation_id"`
	Scope         QuarantineRef `json:"scope"`
	Required      []string      `json:"required_requalification"`
	Completed     []string      `json:"completed_requalification"`
	Requalified   bool          `json:"requalified"`
	Reason        string        `json:"reason"`
	RetiredAt     time.Time     `json:"retired_at"`
	RequalifiedAt *time.Time    `json:"requalified_at,omitempty"`
}

type BarrierStatus struct {
	Mode          BarrierMode `json:"mode"`
	OperationID   string      `json:"operation_id,omitempty"`
	Hard          bool        `json:"hard"`
	Reason        string      `json:"reason,omitempty"`
	NativeSettled bool        `json:"native_settled"`
}

func EvidenceFingerprint(h HandlerResult) string {
	b, _ := json.Marshal(h)
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

func quarantineFor(rec *record, reason string) Quarantine {
	t := rec.request.Target
	ref := QuarantineRef{Kind: "WINDOW", WindowID: rec.request.LogicalWindowID, Activation: t.Activation}
	switch rec.scope {
	case "DESIGN_CONTENT", "SAVE", "NATIVE_RECOMPUTE":
		if t.Scope == "DOCUMENT" && t.ProjectUUID != "" && t.DocumentUUID != "" {
			ref = QuarantineRef{Kind: "DOCUMENT", ProjectUUID: t.ProjectUUID, DocumentUUID: t.DocumentUUID, DocumentType: t.DocumentType}
		}
	case "PROJECT_TOPOLOGY":
		if t.ProjectUUID != "" {
			ref = QuarantineRef{Kind: "PROJECT", ProjectUUID: t.ProjectUUID}
		}
	case "LIBRARY_ASSET":
		if t.LibraryUUID != "" {
			ref = QuarantineRef{Kind: "LIBRARY", ProjectUUID: t.ProjectUUID, LibraryUUID: t.LibraryUUID}
		}
	}
	required := []string{"document.current"}
	switch ref.Kind {
	case "DOCUMENT":
		if ref.DocumentType == "pcb" {
			required = []string{"document.current", "board.snapshot_compact"}
		} else {
			required = []string{"document.current", "schematic.read"}
		}
	case "PROJECT":
		required = []string{"project.current", "schematic.pages.list", "board.list"}
	case "LIBRARY":
		required = []string{"library.list"}
	}
	return Quarantine{OperationID: rec.request.OperationID, Scope: ref, Required: required, Completed: []string{}, Reason: reason, RetiredAt: time.Now().UTC()}
}

func (q Quarantine) blocks(r Request, effectScope string) bool {
	if q.Requalified || effectScope == "NONE" || effectScope == "NAVIGATION_SELECTION" || effectScope == "UI_NATIVE" {
		return false
	}
	switch q.Scope.Kind {
	case "DOCUMENT":
		if r.Target.ProjectUUID != q.Scope.ProjectUUID {
			return false
		}
		if r.Target.Scope == "DOCUMENT" {
			return r.Target.DocumentUUID == q.Scope.DocumentUUID && r.Target.DocumentType == q.Scope.DocumentType
		}
		// Project-topology effects cannot prove that they exclude this document.
		return effectScope == "PROJECT_TOPOLOGY"
	case "PROJECT":
		return r.Target.ProjectUUID != "" && r.Target.ProjectUUID == q.Scope.ProjectUUID
	case "LIBRARY":
		return r.Target.LibraryUUID != "" && r.Target.LibraryUUID == q.Scope.LibraryUUID
	default:
		if q.Scope.WindowID == "" {
			return true // missing stable window provenance fails closed, never open
		}
		return r.LogicalWindowID == q.Scope.WindowID
	}
}

func quarantineTargetMatches(q Quarantine, r Request) bool {
	t := r.Target
	switch q.Scope.Kind {
	case "DOCUMENT":
		return t.Scope == "DOCUMENT" && t.ProjectUUID == q.Scope.ProjectUUID && t.DocumentUUID == q.Scope.DocumentUUID && t.DocumentType == q.Scope.DocumentType
	case "PROJECT":
		return (t.Scope == "PROJECT" || t.Scope == "DOCUMENT") && t.ProjectUUID == q.Scope.ProjectUUID
	case "LIBRARY":
		return t.Scope == "LIBRARY" && t.LibraryUUID == q.Scope.LibraryUUID
	default:
		if q.Scope.WindowID != "" {
			return r.LogicalWindowID == q.Scope.WindowID
		}
		return t.Activation != "" && t.Activation == q.Scope.Activation
	}
}

func copyQuarantine(q Quarantine) Quarantine {
	q.Required = append([]string(nil), q.Required...)
	q.Completed = append([]string(nil), q.Completed...)
	return q
}

// RetireUnresolved terminalizes one settled UNKNOWN without claiming success,
// no-effect, or partial completion. The durable snapshot is written before the
// global owner is released or the Connector receives release authorization.
func (c *Coordinator) RetireUnresolved(id, digest, evidenceFingerprint, reason string, recoveryDuration time.Duration) (Result, Quarantine, error) {
	c.mu.Lock()
	rec := c.records[id]
	if rec == nil {
		c.mu.Unlock()
		return Result{}, Quarantine{}, errors.New("V2_RECOVERY_RECORD_REQUIRED")
	}
	if rec.result.Outcome == RetiredUnresolved {
		if reason == "" || rec.digest != digest || EvidenceFingerprint(rec.evidence) != evidenceFingerprint {
			c.mu.Unlock()
			return Result{}, Quarantine{}, errors.New("V2_RETIRE_UNRESOLVED_IDENTITY_MISMATCH")
		}
		q := copyQuarantine(c.quarantines[id])
		result := rec.result
		c.mu.Unlock()
		return result, q, nil
	}
	h := rec.evidence
	if reason == "" || rec.result.Outcome != Unknown || rec.released || c.owner != id || rec.scope == "NONE" || rec.digest != digest || EvidenceFingerprint(h) != evidenceFingerprint || h.Protocol != Version || h.OperationID != id || h.Digest != digest || h.Target != rec.request.Target || h.Effects.Scope != rec.scope || h.Effects.Started == nil || !*h.Effects.Started || !h.Effects.Settled || !rec.result.Effects.Settled {
		c.mu.Unlock()
		return Result{}, Quarantine{}, errors.New("V2_RETIRE_UNRESOLVED_NOT_ELIGIBLE")
	}
	q := quarantineFor(rec, reason)
	previousResult, previousOwner := rec.result, c.owner
	rec.result.Outcome = RetiredUnresolved
	rec.result.Code = "V2_RETIRED_UNRESOLVED"
	rec.result.OwnershipReleased = true
	rec.result.RecoveryAttempted = true
	rec.result.RecoveryResult = "RETIRED_UNRESOLVED"
	rec.result.RecoveryDurationMS += recoveryDuration.Milliseconds()
	rec.result.BarrierMode = BarrierScoped
	ref := q.Scope
	rec.result.QuarantineScope = &ref
	rec.result.RequiresRequalification = append([]string(nil), q.Required...)
	rec.result.RetiredUnresolved = true
	rec.result.NativeReplayed = false
	rec.released = true
	c.owner = ""
	c.quarantines[id] = q
	snapshot := c.snapshotLocked(nil)
	request := rec.request
	result := rec.result
	c.mu.Unlock()

	if err := c.persist(snapshot); err != nil {
		c.mu.Lock()
		rec.result = previousResult
		rec.released = false
		c.owner = previousOwner
		delete(c.quarantines, id)
		c.mu.Unlock()
		return Result{}, Quarantine{}, errors.New("V2_RECEIPT_PERSIST_FAILED")
	}
	c.mu.Lock()
	close(rec.stop)
	c.publish(rec)
	c.mu.Unlock()
	if c.onResult != nil {
		c.onResult(request, result)
	}
	if c.onResolved != nil {
		c.onResolved(request, digest)
	}
	return result, copyQuarantine(q), nil
}

// Requalify consumes an already completed, separate NONE-effect read receipt.
// It never dispatches or replays the retired operation.
func (c *Coordinator) Requalify(id, readID string) (Quarantine, error) {
	return c.requalify(id, readID, false)
}

// AutoRequalify applies the exact same durable proof contract as Requalify,
// while recording that the daemon (not an Agent-authored recovery sequence)
// admitted the new NONE-effect read after retirement.
func (c *Coordinator) AutoRequalify(id, readID string) (Quarantine, error) {
	return c.requalify(id, readID, true)
}

func (c *Coordinator) requalify(id, readID string, automatic bool) (Quarantine, error) {
	c.mu.Lock()
	q, ok := c.quarantines[id]
	original := c.records[id]
	read := c.records[readID]
	if !ok || original == nil || read == nil || read.request.OperationID == id {
		c.mu.Unlock()
		return Quarantine{}, errors.New("V2_REQUALIFICATION_RECORD_REQUIRED")
	}
	if q.Requalified {
		q = copyQuarantine(q)
		c.mu.Unlock()
		return q, nil
	}
	started := read.result.Effects.Started
	if read.scope != "NONE" || read.result.Outcome != Succeeded || started == nil || *started || !read.result.Effects.Settled || !read.admittedAt.After(q.RetiredAt) || !quarantineTargetMatches(q, read.request) {
		c.mu.Unlock()
		return Quarantine{}, errors.New("V2_REQUALIFICATION_PROOF_REJECTED")
	}
	required := false
	for _, action := range q.Required {
		if action == read.request.Action {
			required = true
			break
		}
	}
	if !required {
		c.mu.Unlock()
		return Quarantine{}, errors.New("V2_REQUALIFICATION_ACTION_REJECTED")
	}
	seen := false
	for _, action := range q.Completed {
		seen = seen || action == read.request.Action
	}
	if !seen {
		q.Completed = append(q.Completed, read.request.Action)
		sort.Strings(q.Completed)
	}
	complete := true
	for _, action := range q.Required {
		found := false
		for _, done := range q.Completed {
			found = found || done == action
		}
		complete = complete && found
	}
	if complete {
		now := time.Now().UTC()
		q.Requalified = true
		q.RequalifiedAt = &now
	}
	previous := c.quarantines[id]
	previousResult := original.result
	c.quarantines[id] = q
	if complete && automatic {
		original.result.AutoRequalified = true
		original.result.RecoveryResult = "RETIRED_UNRESOLVED_AUTO_REQUALIFIED"
		original.result.BarrierMode = BarrierNone
		original.result.RequiresRequalification = nil
	}
	snapshot := c.snapshotLocked(nil)
	c.mu.Unlock()
	if err := c.persist(snapshot); err != nil {
		c.mu.Lock()
		c.quarantines[id] = previous
		original.result = previousResult
		c.mu.Unlock()
		return Quarantine{}, errors.New("V2_RECEIPT_PERSIST_FAILED")
	}
	return copyQuarantine(q), nil
}

func (c *Coordinator) Quarantines() []Quarantine {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make([]Quarantine, 0, len(c.quarantines))
	for _, q := range c.quarantines {
		out = append(out, copyQuarantine(q))
	}
	sort.Slice(out, func(i, j int) bool { return out[i].OperationID < out[j].OperationID })
	return out
}

func (c *Coordinator) BarrierStatus() BarrierStatus {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.owner == "" {
		return BarrierStatus{Mode: BarrierNone}
	}
	rec := c.records[c.owner]
	status := BarrierStatus{Mode: BarrierGlobal, OperationID: c.owner, Hard: true, Reason: "native_lifecycle_unproven"}
	if rec != nil {
		status.NativeSettled = rec.result.Effects.Settled
		if status.NativeSettled {
			if rec.result.Effects.Started != nil && *rec.result.Effects.Started {
				status.Hard = false
				status.Reason = "settled_recovery_pending"
			} else {
				status.Reason = "settlement_evidence_incomplete"
			}
		} else if rec.result.Effects.Started != nil && *rec.result.Effects.Started {
			status.Reason = "native_not_settled"
		}
	}
	return status
}
