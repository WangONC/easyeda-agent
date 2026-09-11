package daemon

import (
	"context"
	"io"
	"net"
	"net/http/httptest"
	"os"
	"path/filepath"
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
