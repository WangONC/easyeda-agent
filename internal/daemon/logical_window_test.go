package daemon

import (
	"context"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
	"testing"
	"time"
)

func logicalConn(window, activation, transport string) *conn {
	c := newConn(nil, time.Now())
	c.applyRegister(protocol.Register{WindowID: window, ActivationID: activation, TransportID: transport}, time.Now())
	return c
}
func TestLogicalWindowTransportReplacementAndLateClose(t *testing.T) {
	h := newHub()
	old := logicalConn("physical", "activation", "socket1")
	next := logicalConn("physical", "activation", "socket2")
	if !h.add(old) || !h.add(next) {
		t.Fatal("same activation reconnect rejected")
	}
	h.removeConn(old)
	if got, ok := h.get("physical"); !ok || got != next {
		t.Fatal("old close removed replacement")
	}
	if len(h.list()) != 1 || h.list()[0].TransportID != "socket2" {
		t.Fatal(h.list())
	}
}
func TestLogicalWindowRejectsCompetingActivationAndKeepsTwoRealHomes(t *testing.T) {
	h := newHub()
	first := logicalConn("physical1", "a1", "s1")
	other := logicalConn("physical1", "a2", "s2")
	h.add(first)
	if h.add(other) {
		t.Fatal("competing activation stole executor")
	}
	h.removeConn(other)
	if c, _ := h.get("physical1"); c != first {
		t.Fatal("ownership lost")
	}
	if !h.add(logicalConn("physical2", "a3", "s3")) || len(h.list()) != 2 {
		t.Fatal("distinct Home windows merged")
	}
	restarted := newHub()
	restarted.add(first)
	if restarted.list()[0].WindowID != "physical1" {
		t.Fatal("daemon restart changed logical identity")
	}
}

func TestLogicalWindowOldTransportCannotResolveAfterReconnect(t *testing.T) {
	h := newHub()
	h.add(logicalConn("physical", "activation", "old-transport"))
	h.add(logicalConn("physical", "activation", "new-transport"))
	if _, ok := h.get("old-transport"); ok {
		t.Fatal("retired transport resolved")
	}
	if c, ok := h.get("new-transport"); !ok || c.snapshot().WindowID != "physical" {
		t.Fatal("new transport lost stable window")
	}
}

func TestLogicalWindowTransportRebindPreservesOperationIdentity(t *testing.T) {
	for _, mode := range []string{"same-activation", "other-window", "other-activation"} {
		t.Run(mode, func(t *testing.T) {
			s := New(Options{})
			old := logicalConn("physical", "activation", "socket1")
			next := logicalConn("physical", "activation", "socket2")
			if mode == "other-window" {
				next = logicalConn("other", "activation", "socket2")
			}
			if mode == "other-activation" {
				next = logicalConn("physical", "other", "socket2")
			}
			req := executionv2.Request{OperationID: "original", Target: executionv2.Target{Scope: "HOME", Session: "socket1", Activation: "activation"}}
			results := make(chan executionv2.HandlerResult, 1)
			s.v2Pending["original"] = v2Pending{request: req, conn: old, results: results}
			ids := s.rebindV2Transport(next)
			got := s.v2Pending["original"]
			if got.request.OperationID != "original" || got.request.Target.Session != "socket1" || got.results != results {
				t.Fatal("operation changed")
			}
			if mode == "same-activation" {
				if len(ids) != 1 || got.conn != next {
					t.Fatal("socket not rebound")
				}
			} else if len(ids) != 0 || got.conn != old {
				t.Fatal("foreign executor adopted owner")
			}
		})
	}
}

func TestIncompleteRegistrationNeverBecomesLiveWindow(t *testing.T) {
	s := New(Options{})
	for _, raw := range []string{
		`{"type":"register","windowId":"random-old","activationId":"old"}`,
		`{"type":"register","windowId":"physical","transportId":"socket"}`,
		`{"type":"register","activationId":"activation","transportId":"socket"}`,
	} {
		c := newConn(nil, time.Now())
		s.handleFrame(context.Background(), c, []byte(raw))
		if len(s.hub.list()) != 0 {
			t.Fatal("incomplete identity exposed", s.hub.list())
		}
	}
}
