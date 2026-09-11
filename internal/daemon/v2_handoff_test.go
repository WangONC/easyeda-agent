package daemon

import (
	"context"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"io"
	"net"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestHandoffCorruptionRefusesBeforeListen(t *testing.T) {
	path := filepath.Join(t.TempDir(), "receipt.json")
	if err := os.WriteFile(path, []byte(`{"version":`), 0600); err != nil {
		t.Fatal(err)
	}
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	ln.Close()
	s := New(Options{Host: "127.0.0.1", PortStart: port, PortEnd: port, V2ReceiptFile: path, V2HostStartupConfirmed: true})
	if s.Run(context.Background(), io.Discard) == nil {
		t.Fatal("corrupt snapshot listened")
	}
	// Even tests or embedded callers bypassing Run cannot serve normal requests.
	w := httptest.NewRecorder()
	s.routes(port).ServeHTTP(w, httptest.NewRequest("GET", "/health", nil))
	if w.Code != 503 {
		t.Fatal(w.Code)
	}
	ln, err = net.Listen("tcp", ln.Addr().String())
	if err != nil {
		t.Fatal("port bound before restore", err)
	}
	ln.Close()
}
func TestHandoffHistoricalSchemaIsReceiptOnly(t *testing.T) {
	path := filepath.Join(t.TempDir(), "receipts.json")
	old := executionv2.Request{Protocol: executionv2.Version, Action: "document.open", ActionRevision: "1", Schema: "historical-schema", RequestID: "r", OperationID: "o", Target: executionv2.Target{Scope: "PROJECT", Session: "old", Activation: "old", ProjectUUID: "p"}, Input: map[string]any{"uuid": "d"}, BudgetMS: 1000}
	c := executionv2.New(10, func(executionv2.Request) (executionv2.Admission, error) {
		return executionv2.Admission{EffectScope: "NAVIGATION_SELECTION"}, nil
	}, func(r executionv2.Request, d string) <-chan executionv2.HandlerResult {
		ch := make(chan executionv2.HandlerResult, 1)
		ch <- executionv2.HandlerResult{Protocol: executionv2.Version, OperationID: r.OperationID, Digest: d, Target: r.Target, Effects: executionv2.Effects{Started: executionv2.Bool(false), Changed: executionv2.Bool(false), Settled: true, Scope: "NAVIGATION_SELECTION"}, Verification: executionv2.Verification{Verdict: "satisfied", Complete: true, Required: 1, Satisfied: 1, Checked: []string{"fresh_destination"}}}
		return ch
	})
	if _, e := c.Submit(context.Background(), old); e != nil {
		t.Fatal(e)
	}
	if e := c.SaveHandoff(path); e != nil {
		t.Fatal(e)
	}
	s := New(Options{V2ReceiptFile: path, V2HostStartupConfirmed: true})
	if result, e := s.v2.Submit(context.Background(), old); e != nil || result.Outcome != executionv2.Succeeded {
		t.Fatalf("receipt lost: %v %#v", e, result)
	}
	old.OperationID = "new"
	old.RequestID = "new"
	if _, e := s.v2.Submit(context.Background(), old); e == nil || !strings.Contains(e.Error(), "V2_SCHEMA_MISMATCH") {
		t.Fatalf("historical request was admitted: %v", e)
	}
}
