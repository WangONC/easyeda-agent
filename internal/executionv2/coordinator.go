package executionv2

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"time"
)

type Admission struct {
	EffectScope string
	Diagnostic  bool
}
type Validate func(Request) (Admission, error)

// Executor must emit a fresh, reconciled observation after a deadline. Closing
// the channel, disconnecting, or replacing the Connector never proves settlement.
type Executor func(Request, string) <-chan HandlerResult
type record struct {
	request    Request
	digest     string
	admittedAt time.Time
	result     Result
	evidence   HandlerResult
	ready      chan struct{}
	complete   bool
	timedOut   bool
	scope      string
	released   bool
	stop       chan struct{}
}
type Coordinator struct {
	mu          sync.Mutex
	records     map[string]*record
	quarantines map[string]Quarantine
	// owner is intentionally Host-domain global. EasyEDA mutations share one
	// activation/editor state; project identity alone is not an isolation proof.
	owner      string
	capacity   int
	handingOff bool
	validate   Validate
	execute    Executor
	onResolved func(Request, string)
	onResult   func(Request, Result)
	onPersist  func(Handoff) error
}

func New(capacity int, validate Validate, execute Executor) *Coordinator {
	return &Coordinator{records: map[string]*record{}, quarantines: map[string]Quarantine{}, capacity: capacity, validate: validate, execute: execute}
}
func (c *Coordinator) OnResult(callback func(Request, Result)) { c.onResult = callback }

// OnPersist receives a consistent snapshot before a changed result becomes
// publicly visible or effect ownership is released.
func (c *Coordinator) OnPersist(callback func(Handoff) error) { c.onPersist = callback }

func (c *Coordinator) OnResolved(callback func(Request, string)) { c.onResolved = callback }

func (c *Coordinator) Submit(ctx context.Context, r Request) (Result, error) {
	if e := r.Validate(); e != nil {
		return Result{}, e
	}
	digest, e := r.Digest()
	if e != nil {
		return Result{}, e
	}
	c.mu.Lock()
	if old := c.records[r.OperationID]; old != nil {
		if old.digest != digest {
			c.mu.Unlock()
			return Result{}, errors.New("V2_OPERATION_ID_CONFLICT")
		}
		c.mu.Unlock()
		return c.wait(ctx, old), nil
	}
	// Explicit child support is not implemented in Round 1. Never route through
	// a legacy composite or acquire a nested writer by accident.
	if r.ParentOperationID != "" {
		c.mu.Unlock()
		return Result{}, errors.New("V2_CHILD_NOT_SUPPORTED")
	}
	if c.handingOff {
		c.mu.Unlock()
		return Result{}, errors.New("V2_HANDOFF_IN_PROGRESS")
	}
	a, e := c.validate(r)
	if e != nil {
		c.mu.Unlock()
		return Result{}, e
	}
	if len(c.records) >= c.capacity {
		c.mu.Unlock()
		return Result{}, errors.New("V2_RECEIPT_CAPACITY")
	}
	if c.owner != "" && a.EffectScope != "NONE" {
		c.mu.Unlock()
		return Result{}, errors.New("V2_EFFECT_BARRIER")
	}
	if a.EffectScope != "NONE" {
		for _, quarantine := range c.quarantines {
			if quarantine.blocks(r, a.EffectScope) {
				c.mu.Unlock()
				return Result{}, errors.New("V2_SCOPE_QUARANTINED:" + quarantine.OperationID)
			}
		}
	}
	admittedAt := time.Now().UTC()
	// Windows clocks can return the same wall timestamp for consecutive calls,
	// and clocks can move backwards across a restart. A read admitted after a
	// retirement must still compare strictly newer than every durable quarantine
	// watermark; pre-retirement receipts retain their original timestamp.
	for _, quarantine := range c.quarantines {
		if !admittedAt.After(quarantine.RetiredAt) {
			admittedAt = quarantine.RetiredAt.Add(time.Nanosecond)
		}
	}
	r.ExecutionDeadline = admittedAt.Add(time.Duration(r.BudgetMS) * time.Millisecond)
	initialBarrier := BarrierNone
	if a.EffectScope != "NONE" {
		initialBarrier = BarrierGlobal
	}
	rec := &record{stop: make(chan struct{}), scope: a.EffectScope, request: r, digest: digest, admittedAt: admittedAt, ready: make(chan struct{}), result: Result{Protocol: Version, OperationID: r.OperationID, Outcome: Unknown, EvidenceRef: r.OperationID, Effects: Effects{Scope: a.EffectScope}, BarrierMode: initialBarrier, RecoveryResult: "NATIVE_PENDING", NativeReplayed: false}}
	c.records[r.OperationID] = rec
	if a.EffectScope != "NONE" {
		c.owner = r.OperationID
	}
	c.mu.Unlock()
	go c.run(rec)
	return c.wait(ctx, rec), nil
}
func (c *Coordinator) wait(ctx context.Context, rec *record) Result {
	select {
	case <-rec.ready:
	case <-ctx.Done():
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	return rec.result
}
func (c *Coordinator) publish(rec *record) {
	if !rec.complete {
		close(rec.ready)
		rec.complete = true
	}
}
func (c *Coordinator) run(rec *record) {
	timer := time.NewTimer(time.Until(rec.request.ExecutionDeadline))
	defer timer.Stop()
	ch := c.execute(rec.request, rec.digest)
	for {
		select {
		case <-rec.stop:
			return
		case <-timer.C:
			c.mu.Lock()
			if rec.released || c.handingOff {
				c.mu.Unlock()
				return
			}
			rec.timedOut = true
			rec.result.Outcome = Unknown
			rec.result.Code = "V2_DEADLINE"
			rec.result.RecoveryResult = "NATIVE_PENDING"
			rec.result.NativeReplayed = false
			if rec.scope != "NONE" {
				rec.result.BarrierMode = BarrierGlobal
			}
			request, result := rec.request, rec.result
			snapshot := c.snapshotLocked(nil)
			c.mu.Unlock()
			if c.persist(snapshot) != nil {
				c.mu.Lock()
				rec.result.Code = "V2_RECEIPT_PERSIST_FAILED"
				result = rec.result
				c.mu.Unlock()
			}
			c.mu.Lock()
			c.publish(rec)
			c.mu.Unlock()
			if c.onResult != nil {
				c.onResult(request, result)
			}
		case h, ok := <-ch:
			if !ok {
				c.mu.Lock()
				if rec.released || c.handingOff {
					c.mu.Unlock()
					return
				}
				rec.result.Code = "V2_EXECUTOR_LOST"
				rec.result.RecoveryResult = "NATIVE_PENDING"
				rec.result.NativeReplayed = false
				if rec.scope != "NONE" {
					rec.result.BarrierMode = BarrierGlobal
				}
				request, result := rec.request, rec.result
				snapshot := c.snapshotLocked(nil)
				c.mu.Unlock()
				if c.persist(snapshot) != nil {
					c.mu.Lock()
					rec.result.Code = "V2_RECEIPT_PERSIST_FAILED"
					result = rec.result
					c.mu.Unlock()
				}
				c.mu.Lock()
				c.publish(rec)
				c.mu.Unlock()
				if c.onResult != nil {
					c.onResult(request, result)
				}
				return
			}
			_, resolved := c.accept(rec, h)
			if resolved {
				return
			}
		}
	}
}

func (c *Coordinator) persist(h Handoff) error {
	if c.onPersist == nil {
		return nil
	}
	return c.onPersist(h)
}

// accept records a fresh HandlerResult without invoking the native executor.
// It is shared by the live result stream and restored reconciliation.
func (c *Coordinator) accept(rec *record, h HandlerResult) (Result, bool) {
	c.mu.Lock()
	if rec.released || c.handingOff {
		result := rec.result
		c.mu.Unlock()
		return result, result.Outcome != Unknown
	}
	if h.Effects.Scope != rec.scope {
		h.Protocol = "invalid"
	}
	result := Finalize(rec.request, rec.digest, h, rec.timedOut)
	if rec.result.RecoveryAttempted {
		result.RecoveryAttempted = true
		if rec.result.RecoveryDurationMS > result.RecoveryDurationMS {
			result.RecoveryDurationMS = rec.result.RecoveryDurationMS
		}
		result.RecoveryResult = recoveryLabel(result.Outcome, true, result.Effects.Settled)
	}
	result.Effects.Scope = rec.scope
	rec.result = result
	rec.evidence = h
	resolved := result.Outcome != Unknown
	owner := c.owner
	if resolved && owner == rec.request.OperationID {
		c.owner = ""
	}
	snapshot := c.snapshotLocked(nil)
	if resolved && owner == rec.request.OperationID {
		c.owner = owner // keep the live barrier until the terminal snapshot is durable
	}
	request, digest := rec.request, rec.digest
	c.mu.Unlock()

	if c.persist(snapshot) != nil {
		c.mu.Lock()
		result.Outcome = Unknown
		result.Code = "V2_RECEIPT_PERSIST_FAILED"
		if rec.scope == "NONE" {
			result.BarrierMode = BarrierNone
		} else {
			result.BarrierMode = BarrierGlobal
		}
		result.RecoveryResult = "UNRESOLVED"
		rec.result = result
		resolved = false
		c.mu.Unlock()
	} else if resolved {
		c.mu.Lock()
		if c.owner == rec.request.OperationID {
			c.owner = ""
		}
		c.mu.Unlock()
	}
	c.mu.Lock()
	c.publish(rec)
	c.mu.Unlock()
	if c.onResult != nil {
		c.onResult(request, result)
	}
	if resolved && c.onResolved != nil {
		c.onResolved(request, digest)
	}
	return result, resolved
}

// RecordRecovery durably annotates daemon-owned bounded recovery. It changes no
// semantic evidence and never invokes the executor.
func (c *Coordinator) RecordRecovery(id string, duration time.Duration) (Result, error) {
	c.mu.Lock()
	rec := c.records[id]
	if rec == nil {
		c.mu.Unlock()
		return Result{}, errors.New("V2_RECOVERY_RECORD_REQUIRED")
	}
	previous := rec.result
	rec.result.RecoveryAttempted = true
	if elapsed := duration.Milliseconds(); elapsed > rec.result.RecoveryDurationMS {
		rec.result.RecoveryDurationMS = elapsed
	}
	rec.result.RecoveryResult = recoveryLabel(rec.result.Outcome, true, rec.result.Effects.Settled)
	snapshot := c.snapshotLocked(nil)
	result := rec.result
	c.mu.Unlock()
	if err := c.persist(snapshot); err != nil {
		c.mu.Lock()
		rec.result = previous
		c.mu.Unlock()
		return Result{}, errors.New("V2_RECEIPT_PERSIST_FAILED")
	}
	return result, nil
}

// ReconcileResult applies a fresh readback result to an operation restored from
// durable storage. It cannot execute or replay the original mutation.
func (c *Coordinator) ReconcileResult(id string, h HandlerResult) (Result, error) {
	c.mu.Lock()
	rec := c.records[id]
	if rec == nil {
		c.mu.Unlock()
		return Result{}, errors.New("V2_RECOVERY_RECORD_REQUIRED")
	}
	if rec.result.Outcome != Unknown || rec.released {
		result := rec.result
		c.mu.Unlock()
		return result, nil
	}
	if c.owner != id || rec.scope == "NONE" {
		c.mu.Unlock()
		return Result{}, errors.New("V2_RECOVERY_OWNER_MISMATCH")
	}
	rec.timedOut = true
	c.mu.Unlock()
	result, _ := c.accept(rec, h)
	return result, nil
}
func (c *Coordinator) Status(id string) (Result, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	r := c.records[id]
	if r == nil {
		return Result{}, false
	}
	return r.result, true
}
func (c *Coordinator) Evidence(id string) (HandlerResult, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	r := c.records[id]
	if r == nil {
		return HandlerResult{}, false
	}
	return r.evidence, true
}

// SameRecoveryDocument never consults names or treats a missing UUID as a match.
// Session/activation/tab are newly bound by the read operation's normal guards.
func SameRecoveryDocument(a, b Target) bool {
	return a.Validate() == nil && b.Validate() == nil && a.Scope == "DOCUMENT" && b.Scope == "DOCUMENT" && a.ProjectUUID == b.ProjectUUID && a.DocumentUUID == b.DocumentUUID && a.DocumentType == b.DocumentType
}

// SameRecoveryProject permits only an exact project identity, never a name.
func SameRecoveryProject(a, b Target) bool {
	return a.Validate() == nil && b.Validate() == nil && a.Scope == "PROJECT" && b.Scope == "PROJECT" && a.ProjectUUID == b.ProjectUUID
}

// Project PCB release uses the formal fresh board inventory. The selected PCB
// must be the unique binding of the original explicitly requested schematic.
// This proves ownership can end, not that optional naming succeeded.
func projectPCBRecoveryProof(original Request, read Request, h HandlerResult, pcb string) bool {
	if original.Action != "board.new_pcb" || read.Action != "board.list" || pcb == "" || !SameRecoveryProject(original.Target, read.Target) {
		return false
	}
	schematic, _ := original.Input["schematicUuid"].(string)
	if schematic == "" {
		schematic, _ = original.Input["schematic"].(string)
	}
	if schematic == "" {
		return false
	}
	var value struct {
		Boards []struct {
			Project   string `json:"parentProjectUuid"`
			Schematic string `json:"schematicUuid"`
			PCB       string `json:"pcbUuid"`
		} `json:"boards"`
	}
	if json.Unmarshal(h.Value, &value) != nil || value.Boards == nil {
		return false
	}
	bindings, matches := 0, 0
	for _, b := range value.Boards {
		if b.Project != original.Target.ProjectUUID {
			return false
		}
		if b.Schematic == schematic {
			bindings++
			if b.PCB == pcb {
				matches++
			}
		}
	}
	return bindings == 1 && matches == 1
}

// ReleaseSettled is the compatibility recovery path for callers that already
// supplied a separate exact-identity read. It no longer releases an unresolved
// mutation into an unqualified Host: the operation is durably retired into the
// same scoped quarantine as RetireUnresolved. Neither proof may be client facts.
func (c *Coordinator) ReleaseSettled(id, readbackID string, expectedPCB ...string) (Result, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.handingOff {
		return Result{}, errors.New("V2_HANDOFF_IN_PROGRESS")
	}
	rec, read := c.records[id], c.records[readbackID]
	if rec == nil || read == nil || read == rec {
		return Result{}, errors.New("V2_RECOVERY_RECORD_REQUIRED")
	}
	identity := read.request.Action == "document.current" && SameRecoveryDocument(rec.request.Target, read.request.Target)
	if len(expectedPCB) == 1 {
		identity = projectPCBRecoveryProof(rec.request, read.request, read.evidence, expectedPCB[0])
	}
	if len(expectedPCB) > 1 {
		identity = false
	}
	if !identity || read.scope != "NONE" || read.result.Outcome != Succeeded || read.result.Effects.Started == nil || *read.result.Effects.Started || !read.result.Effects.Settled {
		return Result{}, errors.New("V2_RECOVERY_TARGET_UNPROVEN")
	}
	h := rec.evidence
	if !rec.complete || h.Protocol != Version || h.OperationID != id || h.Digest != rec.digest || h.Target != rec.request.Target || h.Effects.Scope != rec.scope || h.Effects.Started == nil || !h.Effects.Settled || !rec.result.Effects.Settled || (!*h.Effects.Started && h.Effects.Changed != nil && *h.Effects.Changed) {
		return Result{}, errors.New("V2_NATIVE_NOT_SETTLED")
	}
	if !rec.released {
		previousResult := rec.result
		q := quarantineFor(rec, "settled compatibility recovery requires scope requalification")
		rec.result.Outcome = RetiredUnresolved
		rec.result.Code = "V2_RETIRED_UNRESOLVED"
		rec.released = true
		rec.result.OwnershipReleased = true
		rec.result.RecoveryAttempted = true
		rec.result.RecoveryResult = "RETIRED_UNRESOLVED"
		rec.result.BarrierMode = BarrierScoped
		ref := q.Scope
		rec.result.QuarantineScope = &ref
		rec.result.RequiresRequalification = append([]string(nil), q.Required...)
		rec.result.RetiredUnresolved = true
		rec.result.NativeReplayed = false
		c.quarantines[id] = q
		previousOwner := c.owner
		if c.owner == id {
			c.owner = ""
		}
		if err := c.persist(c.snapshotLocked(nil)); err != nil {
			delete(c.quarantines, id)
			rec.result = previousResult
			rec.released = false
			c.owner = previousOwner
			return Result{}, errors.New("V2_RECEIPT_PERSIST_FAILED")
		}
		close(rec.stop)
	}
	// Resending a lost release authorization is idempotent and never dispatches run.
	if c.onResolved != nil {
		c.onResolved(rec.request, rec.digest)
	}
	return rec.result, nil
}
