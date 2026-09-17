package daemon

import (
	"context"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func startupRequest(action, id string) executionv2.Request {
	for _, a := range protocol.AllActions() {
		if a.Name == action {
			return executionv2.Request{Protocol: executionv2.Version, Action: action, ActionRevision: a.V2.Revision, Schema: a.V2.SchemaID(), RequestID: id, OperationID: id, BudgetMS: 100,
				Target: executionv2.Target{Scope: "DOCUMENT", Session: "s", Activation: "a", ProjectUUID: "p", DocumentUUID: "d", DocumentType: "pcb", TabID: "t"}, Input: map[string]any{}}
		}
	}
	panic(action)
}
func startupConn(s *Server) {
	c := newConn(nil, time.Now())
	c.windowID = "s"
	c.activationID = "a"
	c.caps = []string{"execution.v2"}
	c.ctx = protocol.Context{ProjectUUID: "p", DocumentUUID: "d", DocumentType: "pcb", TabID: "t"}
	s.hub.add(c)
}
func startupExecutor(calls *atomic.Int32, settled, satisfied bool) executionv2.Executor {
	return func(r executionv2.Request, d string) <-chan executionv2.HandlerResult {
		calls.Add(1)
		ch := make(chan executionv2.HandlerResult, 1)
		scope := "SAVE"
		if r.Action == "document.current" {
			scope = "NONE"
		}
		v := executionv2.Verification{Verdict: "unavailable"}
		if satisfied || scope == "NONE" {
			v = executionv2.Verification{Verdict: "satisfied", Complete: true, Required: 1, Satisfied: 1, Checked: []string{"native_save_ack_or_fresh_target"}}
		}
		ch <- executionv2.HandlerResult{Protocol: executionv2.Version, OperationID: r.OperationID, Digest: d, Target: r.Target, Effects: executionv2.Effects{Started: executionv2.Bool(scope != "NONE"), Changed: executionv2.Bool(false), Settled: settled, Scope: scope}, Verification: v}
		return ch
	}
}
func TestV2CleanStartupAllowsReadsAndWrites(t *testing.T) {
	path := filepath.Join(t.TempDir(), "receipts.json")
	s := New(Options{V2ReceiptFile: path})
	startupConn(s)
	var calls atomic.Int32
	s.v2 = executionv2.New(20, s.validateV2, startupExecutor(&calls, true, true))
	if s.v2StartupFenced() {
		t.Fatal("fresh installation fenced")
	}
	if err := s.markV2Running(); err != nil {
		t.Fatal(err)
	}
	for _, action := range []string{"document.current", "pcb.save"} {
		r, e := s.v2.Submit(context.Background(), startupRequest(action, action))
		if e != nil || r.Outcome != executionv2.Succeeded {
			t.Fatal(action, r, e)
		}
	}
	if calls.Load() != 2 {
		t.Fatal(calls.Load())
	}
	if err := s.saveV2Handoff(); err != nil {
		t.Fatal(err)
	}
	next := New(Options{V2ReceiptFile: path})
	startupConn(next)
	if next.v2StartupErr != nil || next.v2StartupFenced() {
		t.Fatal("clean restart fenced", next.v2StartupErr)
	}
	if _, err := next.validateV2(startupRequest("pcb.save", "new")); err != nil {
		t.Fatal(err)
	}
	if _, err := s.v2.Submit(context.Background(), startupRequest("pcb.save", "after-handoff")); err == nil {
		t.Fatal("handoff reopened writes")
	}
}
func TestV2IdentifiedLegacyOrphanPersistsUntilFormalRetirement(t *testing.T) {
	path := filepath.Join(t.TempDir(), "receipts.json")
	old := New(Options{V2ReceiptFile: path})
	if e := old.markV2Running(); e != nil {
		t.Fatal(e)
	}
	r := startupRequest("pcb.save", "started")
	digest, _ := r.Digest()
	if e := old.markV2Effect(r, digest); e != nil {
		t.Fatal(e)
	}
	for i := 0; i < 2; i++ {
		s := New(Options{V2ReceiptFile: path})
		startupConn(s)
		if !s.v2StartupFenced() {
			t.Fatal("unclean startup not fenced")
		}
		if _, e := s.validateV2(startupRequest("pcb.save", "write")); e == nil || !strings.Contains(e.Error(), "STARTUP") {
			t.Fatal(e)
		}
		if _, e := s.validateV2(startupRequest("document.current", "read")); e != nil {
			t.Fatal(e)
		}
		if e := s.saveV2Handoff(); e != nil {
			t.Fatal(e)
		}
	}
	confirmed := New(Options{V2ReceiptFile: path, V2HostStartupConfirmed: true})
	startupConn(confirmed)
	if !confirmed.v2StartupFenced() {
		t.Fatal("startup confirmation bypassed an identified legacy orphan")
	}
	if _, e := confirmed.validateV2(startupRequest("pcb.save", "write")); e == nil || !strings.Contains(e.Error(), "STARTUP") {
		t.Fatal("identified legacy orphan admitted write", e)
	}
	if _, e := os.Stat(path + ".active"); e != nil {
		t.Fatal("identified marker disappeared", e)
	}
	if e := confirmed.markV2Running(); e != nil {
		t.Fatal(e)
	}
	if e := confirmed.saveV2Handoff(); e != nil {
		t.Fatal(e)
	}
	if restarted := New(Options{V2ReceiptFile: path}); !restarted.v2StartupFenced() || restarted.v2LegacyOrphan() == nil {
		t.Fatal("identified legacy orphan was erased by broad confirmation")
	}

	unrecognized := filepath.Join(t.TempDir(), "receipts.json")
	if e := os.WriteFile(unrecognized+".active", []byte("legacy-unrecognized"), 0600); e != nil {
		t.Fatal(e)
	}
	asserted := New(Options{V2ReceiptFile: unrecognized, V2HostStartupConfirmed: true})
	startupConn(asserted)
	if !asserted.v2StartupFenced() || asserted.v2LegacyOrphan() == nil {
		t.Fatal("broad confirmation bypassed an unrecognized marker")
	}
}
func TestV2RestoredUnknownOwnerCannotBeBypassed(t *testing.T) {
	for _, settled := range []bool{false, true} {
		path := filepath.Join(t.TempDir(), "receipts.json")
		old := New(Options{})
		startupConn(old)
		var calls atomic.Int32
		old.v2 = executionv2.New(20, old.validateV2, startupExecutor(&calls, settled, false))
		original := startupRequest("pcb.save", "original")
		result, e := old.v2.Submit(context.Background(), original)
		if e != nil || result.Outcome != executionv2.Unknown {
			t.Fatal(result, e)
		}
		if e := old.v2.SaveHandoff(path); e != nil {
			t.Fatal(e)
		}
		for _, confirmed := range []bool{false, true} {
			s := New(Options{V2ReceiptFile: path, V2HostStartupConfirmed: confirmed})
			startupConn(s)
			if s.v2StartupErr != nil || !s.v2StartupFenced() {
				t.Fatal("owner lost", s.v2StartupErr)
			}
			if _, e := s.v2.Submit(context.Background(), startupRequest("pcb.save", "new")); e == nil || e.Error() != "V2_EFFECT_BARRIER" {
				t.Fatal(e)
			}
			if _, e := s.v2.Submit(context.Background(), original); e != nil || calls.Load() != 1 {
				t.Fatal("replayed", e, calls.Load())
			}
		}
		if settled {
			read := startupRequest("document.current", "fresh")
			if _, e := old.v2.Submit(context.Background(), read); e == nil {
				t.Fatal("handoff allowed fresh read")
			}
			// Restore into an isolated fake executor for readback, using existing release semantics.
			recovered := New(Options{})
			startupConn(recovered)
			recovered.v2 = executionv2.New(20, recovered.validateV2, startupExecutor(&calls, true, false))
			recovered.v2.OnResolved(recovered.resolveV2)
			if _, e := recovered.v2.RestoreHandoff(path); e != nil {
				t.Fatal(e)
			}
			recovered.v2RestoredOwner = "original"
			if _, e := recovered.v2.Submit(context.Background(), read); e != nil {
				t.Fatal(e)
			}
			if r, e := recovered.v2.ReleaseSettled("original", "fresh"); e != nil || r.Outcome != executionv2.RetiredUnresolved || r.BarrierMode != executionv2.BarrierScoped {
				t.Fatal(r, e)
			}
			if recovered.v2StartupFenced() || calls.Load() != 2 {
				t.Fatal("recovery did not clear fence or replayed")
			}
			if e := recovered.v2.SaveHandoff(path); e != nil {
				t.Fatal(e)
			}
			if s := New(Options{V2ReceiptFile: path}); s.v2StartupErr != nil || s.v2StartupFenced() {
				t.Fatal("released historical UNKNOWN fenced", s.v2StartupErr)
			}
		}
	}
}

func TestV2CrashWithoutEffectPermitsNextWrite(t *testing.T) {
	path := filepath.Join(t.TempDir(), "receipts.json")
	old := New(Options{V2ReceiptFile: path})
	if e := old.markV2Running(); e != nil {
		t.Fatal(e)
	}
	read := startupRequest("document.current", "read")
	digest, _ := read.Digest()
	if e := old.markV2Effect(read, digest); e != nil {
		t.Fatal(e)
	}
	next := New(Options{V2ReceiptFile: path})
	startupConn(next)
	if next.v2StartupFenced() {
		t.Fatal("read-only lifetime crash fenced")
	}
	var calls atomic.Int32
	next.v2 = executionv2.New(20, next.validateV2, startupExecutor(&calls, true, true))
	if r, e := next.v2.Submit(context.Background(), startupRequest("pcb.save", "new")); e != nil || r.Outcome != executionv2.Succeeded || calls.Load() != 1 {
		t.Fatal(r, e, calls.Load())
	}
}
func TestV2EffectMarkerIdentityAndPersistenceFailure(t *testing.T) {
	path := filepath.Join(t.TempDir(), "receipts.json")
	s := New(Options{V2ReceiptFile: path})
	startupConn(s)
	r := startupRequest("pcb.save", "intent")
	digest, _ := r.Digest()
	if e := s.markV2Effect(r, digest); e != nil {
		t.Fatal(e)
	}
	data, e := os.ReadFile(path + ".active")
	if e != nil {
		t.Fatal(e)
	}
	if !strings.Contains(string(data), digest) || !strings.Contains(string(data), "intent") {
		t.Fatal(string(data))
	}
	if !New(Options{V2ReceiptFile: path}).v2StartupFenced() {
		t.Fatal("effect marker ignored")
	}
	// A directory cannot be atomically replaced by a marker: executeV2 must not
	// reach the fake connection (which deliberately has no websocket).
	if e := os.Remove(path + ".active"); e != nil {
		t.Fatal(e)
	}
	if e := os.Mkdir(path+".active", 0700); e != nil {
		t.Fatal(e)
	}
	ch := s.executeV2(r, digest)
	if _, ok := <-ch; ok {
		t.Fatal("failed persistence dispatched")
	}
	if len(s.v2Pending) != 0 {
		t.Fatal("failed gate registered dispatch")
	}
}
