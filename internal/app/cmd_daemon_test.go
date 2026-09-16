package app

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/zhoushoujianwork/easyeda-agent/internal/daemon"
)

// freeTCPPort returns a port that was free at call time (racy, fine for tests).
func freeTCPPort(t *testing.T) int {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	_ = ln.Close()
	return port
}

func TestDaemonStopIsGracefulAndScopedToAgentDaemon(t *testing.T) {
	port := freeTCPPort(t)
	srv := daemon.New(daemon.Options{Host: "127.0.0.1", PortStart: port, PortEnd: port, Version: "2.0.0", V2ReceiptFile: filepath.Join(t.TempDir(), "receipts.json")})
	done := make(chan error, 1)
	go func() { done <- srv.Run(context.Background(), io.Discard) }()
	deadline := time.Now().Add(3 * time.Second)
	for !daemonOnPort("127.0.0.1", port) && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	var out bytes.Buffer
	stopped, err := stopDaemon(&appConfig{host: "127.0.0.1", ports: fmt.Sprintf("%d-%d", port, port)}, &out)
	if err != nil || !stopped {
		t.Fatalf("stop = %v, %v", stopped, err)
	}
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	if !portFree("127.0.0.1", port) || !strings.Contains(out.String(), "daemon stopped") {
		t.Fatal(out.String())
	}
}

func TestDaemonOperatorSurfaceAndSkillSyncDefault(t *testing.T) {
	d := newDaemonCmd(&appConfig{}, io.Discard, io.Discard)
	for _, name := range []string{"start", "stop", "restart"} {
		if cmd, _, err := d.Find([]string{name}); err != nil || cmd.Name() != name {
			t.Fatalf("missing daemon %s: %v", name, err)
		}
	}
	start, _, _ := d.Find([]string{"start"})
	if flag := start.Flags().Lookup("auto-update-skill"); flag == nil || flag.DefValue != "false" {
		t.Fatalf("auto-update-skill default = %#v", flag)
	}
}

func TestPortFree(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	port := ln.Addr().(*net.TCPAddr).Port
	if portFree("127.0.0.1", port) {
		t.Errorf("port %d is bound but portFree reported free", port)
	}
	if !portFree("127.0.0.1", freeTCPPort(t)) {
		t.Error("a free port must report free")
	}
}

func TestEnsurePortAvailable_FreePort(t *testing.T) {
	if err := ensurePortAvailable("127.0.0.1", freeTCPPort(t), io.Discard); err != nil {
		t.Errorf("a free port should be available; got %v", err)
	}
}

// A FOREIGN process on the port (not an easyeda daemon) must be REFUSED headless
// (go test has no TTY), and must NOT be killed.
func TestEnsurePortAvailable_ForeignHeadlessRefuses(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	port := ln.Addr().(*net.TCPAddr).Port

	if err := ensurePortAvailable("127.0.0.1", port, io.Discard); err == nil {
		t.Fatal("expected refusal for a foreign process holding the port (headless)")
	}
	// The foreign listener must still be alive — we never kill non-easyeda procs.
	if portFree("127.0.0.1", port) {
		t.Error("foreign listener must NOT have been killed/freed")
	}
}
