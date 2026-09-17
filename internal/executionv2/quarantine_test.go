package executionv2

import (
	"context"
	"path/filepath"
	"sync/atomic"
	"testing"
)

func recoveryUnknown(r Request, digest, scope string, settled bool) HandlerResult {
	return HandlerResult{
		Protocol: r.Protocol, OperationID: r.OperationID, Digest: digest, Target: r.Target,
		Effects:      Effects{Started: Bool(true), Changed: nil, Settled: settled, Scope: scope},
		Verification: Verification{Verdict: "unavailable"},
	}
}

func recoveryProof(r Request, verdict string, changed bool, satisfied, residual int) HandlerResult {
	digest, _ := r.Digest()
	return HandlerResult{
		Protocol: r.Protocol, OperationID: r.OperationID, Digest: digest, Target: r.Target,
		Effects:      Effects{Started: Bool(true), Changed: Bool(changed), Settled: true, Scope: "DESIGN_CONTENT", Reconciled: true},
		Verification: Verification{Verdict: verdict, Checked: []string{"authoritative_fresh_state"}, Complete: true, Required: satisfied + residual, Satisfied: satisfied, Residual: residual},
	}
}

func TestSettledRecoveryClassifiesNoEffectAndKnownPartialWithoutReplay(t *testing.T) {
	for _, fixture := range []struct {
		name      string
		proof     HandlerResult
		want      Outcome
		wantState bool
	}{
		{name: "proven-no-effect", want: NotApplied, wantState: false},
		{name: "known-partial", want: Partial, wantState: true},
	} {
		t.Run(fixture.name, func(t *testing.T) {
			var writes atomic.Int32
			c := New(10, func(Request) (Admission, error) { return Admission{EffectScope: "DESIGN_CONTENT"}, nil }, func(r Request, digest string) <-chan HandlerResult {
				writes.Add(1)
				ch := make(chan HandlerResult, 1)
				ch <- recoveryUnknown(r, digest, "DESIGN_CONTENT", true)
				return ch
			})
			r := request("original-" + fixture.name)
			initial, err := c.Submit(context.Background(), r)
			if err != nil || initial.Outcome != Unknown || !initial.Effects.Settled {
				t.Fatal(initial, err)
			}
			proof := recoveryProof(r, "unchanged", false, 0, 1)
			if fixture.want == Partial {
				proof = recoveryProof(r, "partial", true, 2, 1)
			}
			result, err := c.ReconcileResult(r.OperationID, proof)
			if err != nil || result.Outcome != fixture.want || result.Effects.Changed == nil || *result.Effects.Changed != fixture.wantState || result.BarrierMode != BarrierNone {
				t.Fatal(result, err)
			}
			if writes.Load() != 1 || result.NativeReplayed {
				t.Fatalf("native replayed: writes=%d result=%#v", writes.Load(), result)
			}
			if _, err := c.Submit(context.Background(), request("next-"+fixture.name)); err != nil {
				t.Fatal("terminal recovery retained global barrier", err)
			}
		})
	}
}

func TestSettledUnresolvedRetiresToDocumentQuarantineAndRequalifies(t *testing.T) {
	var writes atomic.Int32
	validate := func(r Request) (Admission, error) {
		if r.Action == "document.current" || r.Action == "board.snapshot_compact" {
			return Admission{EffectScope: "NONE"}, nil
		}
		return Admission{EffectScope: "DESIGN_CONTENT"}, nil
	}
	execute := func(r Request, digest string) <-chan HandlerResult {
		ch := make(chan HandlerResult, 1)
		if r.Action == "document.current" || r.Action == "board.snapshot_compact" {
			ch <- HandlerResult{Protocol: Version, OperationID: r.OperationID, Digest: digest, Target: r.Target, Effects: Effects{Started: Bool(false), Changed: Bool(false), Settled: true, Scope: "NONE"}, Verification: Verification{Verdict: "satisfied", Checked: []string{"fresh_identity"}, Complete: true, Required: 1, Satisfied: 1}}
			return ch
		}
		writes.Add(1)
		if r.OperationID == "unresolved" {
			ch <- recoveryUnknown(r, digest, "DESIGN_CONTENT", true)
		} else {
			ch <- recoveryProof(r, "satisfied", true, 1, 0)
		}
		return ch
	}
	c := New(20, validate, execute)
	original := request("unresolved")
	initial, err := c.Submit(context.Background(), original)
	if err != nil || initial.Outcome != Unknown {
		t.Fatal(initial, err)
	}
	oldRead := request("pre-retirement-read")
	oldRead.Action = "document.current"
	if result, err := c.Submit(context.Background(), oldRead); err != nil || result.Outcome != Succeeded {
		t.Fatal(result, err)
	}
	digest, _ := original.Digest()
	evidence, _ := c.Evidence(original.OperationID)
	retired, quarantine, err := c.RetireUnresolved(original.OperationID, digest, EvidenceFingerprint(evidence), "bounded authoritative reads could not attribute the effect", 0)
	if err != nil || retired.Outcome != RetiredUnresolved || !retired.RetiredUnresolved || retired.BarrierMode != BarrierScoped || !retired.OwnershipReleased || retired.NativeReplayed || quarantine.Scope.Kind != "DOCUMENT" || quarantine.Requalified {
		t.Fatal(retired, quarantine, err)
	}
	if c.EffectOwner() != "" || c.BarrierStatus().Mode != BarrierNone {
		t.Fatal("global owner remained after settled retirement")
	}
	if _, err := c.Requalify(original.OperationID, oldRead.OperationID); err == nil {
		t.Fatal("a pre-retirement read requalified the quarantined scope")
	}
	if _, err := c.Submit(context.Background(), request("same-document-blocked")); err == nil || err.Error() != "V2_SCOPE_QUARANTINED:unresolved" {
		t.Fatal("affected document was not quarantined", err)
	}
	unrelated := request("unrelated-project")
	unrelated.Target.ProjectUUID, unrelated.Target.DocumentUUID, unrelated.Target.TabID = "other-project", "other-document", "other-tab"
	if result, err := c.Submit(context.Background(), unrelated); err != nil || result.Outcome != Succeeded {
		t.Fatal("unrelated scope remained blocked", result, err)
	}
	for i, action := range []string{"document.current", "board.snapshot_compact"} {
		read := request("requalification-read-" + action)
		read.Action = action
		result, err := c.Submit(context.Background(), read)
		if err != nil || result.Outcome != Succeeded {
			t.Fatal(result, err)
		}
		quarantine, err = c.Requalify(original.OperationID, read.OperationID)
		if err != nil || quarantine.Requalified != (i == 1) {
			t.Fatal(quarantine, err)
		}
	}
	if result, err := c.Submit(context.Background(), request("same-document-after-requalification")); err != nil || result.Outcome != Succeeded {
		t.Fatal("requalified document remained blocked", result, err)
	}
	if writes.Load() != 3 { // original, unrelated, same-document-after-requalification
		t.Fatalf("unexpected mutation count %d", writes.Load())
	}
}

func TestNativePendingIsHardGlobalBarrierAndCannotRetire(t *testing.T) {
	var writes atomic.Int32
	c := New(10, func(Request) (Admission, error) { return Admission{EffectScope: "DESIGN_CONTENT"}, nil }, func(r Request, digest string) <-chan HandlerResult {
		writes.Add(1)
		ch := make(chan HandlerResult, 1)
		ch <- recoveryUnknown(r, digest, "DESIGN_CONTENT", false)
		return ch
	})
	r := request("still-running")
	result, err := c.Submit(context.Background(), r)
	if err != nil || result.Outcome != Unknown || result.Effects.Settled {
		t.Fatal(result, err)
	}
	evidence, _ := c.Evidence(r.OperationID)
	digest, _ := r.Digest()
	if _, _, err := c.RetireUnresolved(r.OperationID, digest, EvidenceFingerprint(evidence), "operator cannot prove settlement", 0); err == nil {
		t.Fatal("pending native was retired")
	}
	barrier := c.BarrierStatus()
	if !barrier.Hard || barrier.Mode != BarrierGlobal || barrier.OperationID != r.OperationID || barrier.NativeSettled {
		t.Fatal(barrier)
	}
	unrelated := request("unrelated")
	unrelated.Target.ProjectUUID, unrelated.Target.DocumentUUID = "other", "other"
	if _, err := c.Submit(context.Background(), unrelated); err == nil || err.Error() != "V2_EFFECT_BARRIER" {
		t.Fatal("hard barrier was bypassed", err)
	}
	if writes.Load() != 1 {
		t.Fatal("native replayed", writes.Load())
	}
}

func TestSettledIncompleteEvidenceIsNotBroadlyDowngraded(t *testing.T) {
	c := New(10, func(Request) (Admission, error) { return Admission{EffectScope: "DESIGN_CONTENT"}, nil }, func(r Request, digest string) <-chan HandlerResult {
		ch := make(chan HandlerResult, 1)
		ch <- HandlerResult{
			Protocol: r.Protocol, OperationID: r.OperationID, Digest: digest, Target: r.Target,
			Effects:      Effects{Started: nil, Changed: nil, Settled: true, Scope: "DESIGN_CONTENT"},
			Verification: Verification{Verdict: "unavailable"},
		}
		return ch
	})
	r := request("settled-incomplete")
	result, err := c.Submit(context.Background(), r)
	if err != nil || result.Outcome != Unknown {
		t.Fatal(result, err)
	}
	digest, _ := r.Digest()
	evidence, _ := c.Evidence(r.OperationID)
	if _, _, err := c.RetireUnresolved(r.OperationID, digest, EvidenceFingerprint(evidence), "incomplete effect evidence", 0); err == nil {
		t.Fatal("incomplete evidence was retired")
	}
	barrier := c.BarrierStatus()
	if !barrier.Hard || barrier.Reason != "native_lifecycle_unproven" || barrier.NativeSettled || barrier.Mode != BarrierGlobal {
		t.Fatal(barrier)
	}
	if _, err := c.Submit(context.Background(), request("blocked-by-incomplete-evidence")); err == nil || err.Error() != "V2_EFFECT_BARRIER" {
		t.Fatal("incomplete settlement evidence was broadly downgraded", err)
	}
}

func TestRetiredQuarantineSurvivesRestartWithoutReplay(t *testing.T) {
	path := filepath.Join(t.TempDir(), "receipts.json")
	var writes atomic.Int32
	validate := func(r Request) (Admission, error) {
		if r.Action == "document.current" || r.Action == "board.snapshot_compact" {
			return Admission{EffectScope: "NONE"}, nil
		}
		return Admission{EffectScope: "DESIGN_CONTENT"}, nil
	}
	old := New(20, validate, func(r Request, digest string) <-chan HandlerResult {
		writes.Add(1)
		ch := make(chan HandlerResult, 1)
		ch <- recoveryUnknown(r, digest, "DESIGN_CONTENT", true)
		return ch
	})
	old.OnPersist(func(h Handoff) error { return PersistHandoff(path, h) })
	r := request("durable-unresolved")
	if _, err := old.Submit(context.Background(), r); err != nil {
		t.Fatal(err)
	}
	digest, _ := r.Digest()
	evidence, _ := old.Evidence(r.OperationID)
	if _, _, err := old.RetireUnresolved(r.OperationID, digest, EvidenceFingerprint(evidence), "durable retirement", 0); err != nil {
		t.Fatal(err)
	}
	restored := New(20, validate, func(r Request, digest string) <-chan HandlerResult {
		ch := make(chan HandlerResult, 1)
		if r.Action == "document.current" || r.Action == "board.snapshot_compact" {
			ch <- HandlerResult{Protocol: Version, OperationID: r.OperationID, Digest: digest, Target: r.Target, Effects: Effects{Started: Bool(false), Changed: Bool(false), Settled: true, Scope: "NONE"}, Verification: Verification{Verdict: "satisfied", Checked: []string{"fresh"}, Complete: true, Required: 1, Satisfied: 1}}
		}
		return ch
	})
	restored.OnPersist(func(h Handoff) error { return PersistHandoff(path, h) })
	if _, err := restored.RestoreHandoff(path); err != nil {
		t.Fatal(err)
	}
	status, ok := restored.Status(r.OperationID)
	if !ok || status.Outcome != RetiredUnresolved || restored.EffectOwner() != "" || len(restored.Quarantines()) != 1 {
		t.Fatal(status, ok, restored.EffectOwner(), restored.Quarantines())
	}
	if _, err := restored.Submit(context.Background(), request("restart-blocked")); err == nil {
		t.Fatal("restart lost quarantine")
	}
	if writes.Load() != 1 {
		t.Fatal("restart replayed native", writes.Load())
	}
	for _, action := range []string{"document.current", "board.snapshot_compact"} {
		read := request("restart-requalification-" + action)
		read.Action = action
		result, err := restored.Submit(context.Background(), read)
		if err != nil || result.Outcome != Succeeded {
			t.Fatal(result, err)
		}
		if _, err := restored.Requalify(r.OperationID, read.OperationID); err != nil {
			t.Fatal(err)
		}
	}
	afterRequalification := New(20, validate, nil)
	if _, err := afterRequalification.RestoreHandoff(path); err != nil {
		t.Fatal(err)
	}
	quarantines := afterRequalification.Quarantines()
	if len(quarantines) != 1 || !quarantines[0].Requalified || afterRequalification.EffectOwner() != "" {
		t.Fatal("durable requalification was not restored", quarantines, afterRequalification.EffectOwner())
	}
}

func TestNoEffectTerminalAllowsNewOperationButNeverReplaysOldIdentity(t *testing.T) {
	var writes atomic.Int32
	c := New(10, func(Request) (Admission, error) { return Admission{EffectScope: "DESIGN_CONTENT"}, nil }, func(r Request, digest string) <-chan HandlerResult {
		writes.Add(1)
		ch := make(chan HandlerResult, 1)
		ch <- recoveryUnknown(r, digest, "DESIGN_CONTENT", true)
		return ch
	})
	original := request("zero-effect")
	if _, err := c.Submit(context.Background(), original); err != nil {
		t.Fatal(err)
	}
	if result, err := c.ReconcileResult(original.OperationID, recoveryProof(original, "unchanged", false, 0, 1)); err != nil || result.Outcome != NotApplied {
		t.Fatal(result, err)
	}
	if _, err := c.Submit(context.Background(), original); err != nil || writes.Load() != 1 {
		t.Fatal("old operation replayed", err, writes.Load())
	}
	if _, err := c.Submit(context.Background(), request("new-transaction")); err != nil || writes.Load() != 2 {
		t.Fatal("new operation was not admitted", err, writes.Load())
	}
}

func TestWindowQuarantineUsesStableLogicalWindowAcrossActivationChanges(t *testing.T) {
	validate := func(r Request) (Admission, error) {
		if r.Action == "document.current" {
			return Admission{EffectScope: "NONE"}, nil
		}
		return Admission{EffectScope: "PROJECT_TOPOLOGY"}, nil
	}
	c := New(10, validate, func(r Request, digest string) <-chan HandlerResult {
		ch := make(chan HandlerResult, 1)
		if r.Action == "document.current" {
			ch <- HandlerResult{Protocol: Version, OperationID: r.OperationID, Digest: digest, Target: r.Target, Effects: Effects{Started: Bool(false), Changed: Bool(false), Settled: true, Scope: "NONE"}, Verification: Verification{Verdict: "satisfied", Checked: []string{"fresh_context"}, Complete: true, Required: 1, Satisfied: 1}}
		} else if r.OperationID == "window-unresolved" {
			ch <- recoveryUnknown(r, digest, "PROJECT_TOPOLOGY", true)
		} else {
			h := recoveryProof(r, "satisfied", true, 1, 0)
			h.Effects.Scope = "PROJECT_TOPOLOGY"
			ch <- h
		}
		return ch
	})
	original := request("window-unresolved")
	original.Target = Target{Scope: "HOME", Session: "transport-1", Activation: "activation-1"}
	original.LogicalWindowID = "logical-window-1"
	if _, err := c.Submit(context.Background(), original); err != nil {
		t.Fatal(err)
	}
	digest, _ := original.Digest()
	evidence, _ := c.Evidence(original.OperationID)
	_, quarantine, err := c.RetireUnresolved(original.OperationID, digest, EvidenceFingerprint(evidence), "created project cannot be attributed", 0)
	if err != nil || quarantine.Scope.Kind != "WINDOW" || quarantine.Scope.WindowID != "logical-window-1" {
		t.Fatal(quarantine, err)
	}
	sameWindow := request("same-window-new-activation")
	sameWindow.Target = Target{Scope: "HOME", Session: "transport-2", Activation: "activation-2"}
	sameWindow.LogicalWindowID = "logical-window-1"
	if _, err := c.Submit(context.Background(), sameWindow); err == nil || err.Error() != "V2_SCOPE_QUARANTINED:window-unresolved" {
		t.Fatal("activation change bypassed stable window quarantine", err)
	}
	otherWindow := request("other-window")
	otherWindow.Target = Target{Scope: "HOME", Session: "other-transport", Activation: "other-activation"}
	otherWindow.LogicalWindowID = "logical-window-2"
	if result, err := c.Submit(context.Background(), otherWindow); err != nil || result.Outcome != Succeeded {
		t.Fatal("independent logical window remained blocked", result, err)
	}
	read := sameWindow
	read.OperationID, read.RequestID, read.Action = "fresh-window-context", "fresh-window-context", "document.current"
	if result, err := c.Submit(context.Background(), read); err != nil || result.Outcome != Succeeded {
		t.Fatal(result, err)
	}
	if quarantine, err = c.Requalify(original.OperationID, read.OperationID); err != nil || !quarantine.Requalified {
		t.Fatal(quarantine, err)
	}
}
