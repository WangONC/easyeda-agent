package executionv2

import (
	"context"
	"encoding/json"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestFinalizerPreservesLargeBusinessValue(t *testing.T) {
	r := request("large-read")
	h := evidence(r, "satisfied", false, 1, 0)
	h.Effects.Started = Bool(false)
	payload, err := json.Marshal(map[string]any{"component": "STM32G474CBT6", "pins": strings.Repeat("pin-data-", 1200)})
	if err != nil || len(payload) <= 8192 {
		t.Fatalf("fixture must exceed old threshold: %d, %v", len(payload), err)
	}
	h.Value = payload
	digest, _ := r.Digest()
	result := Finalize(r, digest, h, false)
	if result.Outcome != Succeeded || string(result.Value) != string(payload) {
		t.Fatalf("large successful read was projected incorrectly: outcome=%s value=%d want=%d", result.Outcome, len(result.Value), len(payload))
	}
}

func request(id string) Request {
	return Request{Protocol: Version, Action: "test", ActionRevision: "1", Schema: "schema", RequestID: "request", OperationID: id, Target: Target{Scope: "DOCUMENT", Session: "s", Activation: "a", ProjectUUID: "p", DocumentUUID: "d", DocumentType: "pcb", TabID: "t"}, Input: map[string]any{}, BudgetMS: 20}
}
func evidence(r Request, verdict string, changed bool, satisfied, residual int) HandlerResult {
	d, _ := r.Digest()
	return HandlerResult{Protocol: Version, OperationID: r.OperationID, Digest: d, Target: r.Target, Effects: Effects{Started: Bool(changed), Changed: Bool(changed), Settled: true, Scope: "DESIGN_CONTENT"}, Verification: Verification{Verdict: verdict, Checked: []string{"fresh_object_fields"}, Complete: true, Required: satisfied + residual, Satisfied: satisfied, Residual: residual}}
}
func TestFinalizer(t *testing.T) {
	r := request("a")
	d, _ := r.Digest()
	tests := []struct {
		name string
		h    HandlerResult
		want Outcome
	}{
		{"success", evidence(r, "satisfied", true, 1, 0), Succeeded},
		{"no op", evidence(r, "satisfied", false, 1, 0), Succeeded},
		{"no effect", evidence(r, "unchanged", false, 0, 1), NotApplied},
		{"partial", evidence(r, "partial", true, 1, 1), Partial},
		{"settled known changed scope with zero achieved items", evidence(r, "partial", true, 0, 2), Partial},
		{"unavailable", evidence(r, "unavailable", true, 0, 1), Unknown},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := Finalize(r, d, tt.h, false); got.Outcome != tt.want {
				t.Fatal(got)
			}
		})
	}
	h := evidence(r, "satisfied", true, 1, 0)
	for _, change := range []func(*HandlerResult){func(h *HandlerResult) { h.Target.DocumentUUID = "foreign" }, func(h *HandlerResult) { h.OperationID = "foreign" }, func(h *HandlerResult) { h.Digest = "foreign" }, func(h *HandlerResult) { h.Effects.Settled = false }, func(h *HandlerResult) { h.Verification.Complete = false }, func(h *HandlerResult) { h.Verification.Required = 0 }} {
		bad := h
		change(&bad)
		if Finalize(r, d, bad, false).Outcome != Unknown {
			t.Fatal("accepted malformed/foreign evidence")
		}
	}
	if Finalize(r, d, h, true).Outcome != Unknown {
		t.Fatal("late result is not reconciliation")
	}
}
func TestDeadlineDuplicateAndReconcile(t *testing.T) {
	ch := make(chan HandlerResult, 4)
	var dispatches atomic.Int32
	c := New(10, func(Request) (Admission, error) { return Admission{EffectScope: "DESIGN_CONTENT"}, nil }, func(Request, string) <-chan HandlerResult { dispatches.Add(1); return ch })
	r := request("first")
	got, e := c.Submit(context.Background(), r)
	if e != nil || got.Outcome != Unknown || got.Code != "V2_DEADLINE" {
		t.Fatal(got, e)
	}
	got, e = c.Submit(context.Background(), r)
	if e != nil || got.Outcome != Unknown || dispatches.Load() != 1 {
		t.Fatal("duplicate replay", got, e)
	}
	changed := r
	changed.Input = map[string]any{"different": true}
	if _, e = c.Submit(context.Background(), changed); e == nil {
		t.Fatal("digest conflict accepted")
	}
	if _, e = c.Submit(context.Background(), request("second")); e == nil {
		t.Fatal("pending effect crossed barrier")
	}
	otherProject := request("other-project")
	otherProject.Target.ProjectUUID = "completely-independent-project"
	otherProject.Target.DocumentUUID = "other-document"
	otherProject.Target.TabID = "other-tab"
	if _, e = c.Submit(context.Background(), otherProject); e == nil || e.Error() != "V2_EFFECT_BARRIER" {
		t.Fatal("Host-global owner was bypassed by a different project", e)
	}
	h := evidence(r, "satisfied", true, 1, 0)
	ch <- h
	deadline := time.Now().Add(time.Second)
	for {
		result, _ := c.Status(r.OperationID)
		if result.Code != "V2_DEADLINE" {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("delivery stalled")
		}
		time.Sleep(time.Millisecond)
	}
	if _, e = c.Submit(context.Background(), request("second")); e == nil {
		t.Fatal("late response released barrier")
	}
	h.Effects.Reconciled = true
	ch <- h
	for {
		result, _ := c.Status(r.OperationID)
		if result.Outcome == Succeeded {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("reconcile stalled")
		}
		time.Sleep(time.Millisecond)
	}
	if dispatches.Load() != 1 {
		t.Fatal("blind replay")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, e = c.Submit(ctx, request("second")); e != nil {
		t.Fatal("barrier not released", e)
	}
}
func TestChildAndReceiptCapacity(t *testing.T) {
	c := New(0, func(Request) (Admission, error) { return Admission{EffectScope: "NONE"}, nil }, nil)
	r := request("a")
	r.ParentOperationID = "legacy-parent"
	if _, e := c.Submit(context.Background(), r); e == nil {
		t.Fatal("child accepted")
	}
	r.ParentOperationID = ""
	if _, e := c.Submit(context.Background(), r); e == nil {
		t.Fatal("receipt eviction allowed")
	}
}

func TestCompletionDoesNotInventStateChange(t *testing.T) {
	r := request("save")
	h := evidence(r, "satisfied", true, 1, 0)
	h.Effects.Scope = "SAVE"
	h.Effects.Changed = nil
	h.Verification.Checked = []string{"native_save_ack_true"}
	digest, _ := r.Digest()
	result := Finalize(r, digest, h, false)
	if result.Outcome != Succeeded || result.Effects.Changed != nil {
		t.Fatal(result)
	}
	h.Verification = Verification{Verdict: "unavailable"}
	if Finalize(r, digest, h, false).Outcome != Unknown {
		t.Fatal("unknown change is not itself completion proof")
	}
}
