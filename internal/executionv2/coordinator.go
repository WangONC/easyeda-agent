package executionv2

import (
	"context"
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
	request  Request
	digest   string
	result   Result
	evidence HandlerResult
	ready    chan struct{}
	complete bool
	timedOut bool
	scope    string
	released bool
	stop     chan struct{}
}
type Coordinator struct {
	mu         sync.Mutex
	records    map[string]*record
	owner      string
	capacity   int
	validate   Validate
	execute    Executor
	onResolved func(Request, string)
	onResult   func(Request, Result)
}

func New(capacity int, validate Validate, execute Executor) *Coordinator {
	return &Coordinator{records: map[string]*record{}, capacity: capacity, validate: validate, execute: execute}
}
func (c *Coordinator) OnResult(callback func(Request, Result)) { c.onResult = callback }

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
	r.ExecutionDeadline = time.Now().Add(time.Duration(r.BudgetMS) * time.Millisecond)
	rec := &record{stop: make(chan struct{}), scope: a.EffectScope, request: r, digest: digest, ready: make(chan struct{}), result: Result{Protocol: Version, OperationID: r.OperationID, Outcome: Unknown, EvidenceRef: r.OperationID, Effects: Effects{Scope: a.EffectScope}}}
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
			if rec.released {
				c.mu.Unlock()
				return
			}
			rec.timedOut = true
			rec.result.Outcome = Unknown
			rec.result.Code = "V2_DEADLINE"
			if c.onResult != nil {
				c.onResult(rec.request, rec.result)
			}
			c.publish(rec)
			c.mu.Unlock()
		case h, ok := <-ch:
			if !ok {
				c.mu.Lock()
				if rec.released {
					c.mu.Unlock()
					return
				}
				rec.result.Code = "V2_EXECUTOR_LOST"
				c.publish(rec)
				c.mu.Unlock()
				return
			}
			c.mu.Lock()
			if rec.released {
				c.mu.Unlock()
				return
			}
			if h.Effects.Scope != rec.scope {
				h.Protocol = "invalid"
			}
			result := Finalize(rec.request, rec.digest, h, rec.timedOut)
			result.Effects.Scope = rec.scope
			rec.result = result
			rec.evidence = h
			if c.onResult != nil {
				c.onResult(rec.request, rec.result)
			}
			c.publish(rec)
			// Unknown settlement/evidence remains fenced. A later fresh reconcile is
			// accepted through the same operation channel; never redispatch the action.
			resolved := result.Outcome != Unknown
			if resolved && c.onResolved != nil {
				c.onResolved(rec.request, rec.digest)
			}
			if resolved && c.owner == rec.request.OperationID {
				c.owner = ""
			}
			c.mu.Unlock()
			if resolved {
				return
			}
		}
	}
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

// ReleaseSettled ends effect ownership, not the semantic operation conclusion.
// The original terminal HandlerResult proves the handler/native chain settled.
// A new, exact-document read proves current binding. Neither may be client facts.
func (c *Coordinator) ReleaseSettled(id, readbackID string) (Result, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	rec, read := c.records[id], c.records[readbackID]
	if rec == nil || read == nil || read == rec {
		return Result{}, errors.New("V2_RECOVERY_RECORD_REQUIRED")
	}
	if read.request.Action != "document.current" || read.scope != "NONE" || read.result.Outcome != Succeeded || read.result.Effects.Started == nil || *read.result.Effects.Started || !read.result.Effects.Settled || !SameRecoveryDocument(rec.request.Target, read.request.Target) {
		return Result{}, errors.New("V2_RECOVERY_TARGET_UNPROVEN")
	}
	h := rec.evidence
	if !rec.complete || h.Protocol != Version || h.OperationID != id || h.Digest != rec.digest || h.Target != rec.request.Target || h.Effects.Scope != rec.scope || h.Effects.Started == nil || !h.Effects.Settled || !rec.result.Effects.Settled || (!*h.Effects.Started && h.Effects.Changed != nil && *h.Effects.Changed) {
		return Result{}, errors.New("V2_NATIVE_NOT_SETTLED")
	}
	if !rec.released {
		rec.released = true
		rec.result.OwnershipReleased = true
		close(rec.stop)
	}
	// Resending a lost release authorization is idempotent and never dispatches run.
	if c.onResolved != nil {
		c.onResolved(rec.request, rec.digest)
	}
	if c.owner == id {
		c.owner = ""
	}
	return rec.result, nil
}
