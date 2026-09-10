package daemon

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
)

// startDaemon runs a daemon on a free port and returns its host:port and a
// cleanup func that shuts it down.
func startDaemon(t *testing.T) (string, func()) {
	t.Helper()
	port := freePort(t)
	srv := New(Options{Host: "127.0.0.1", PortStart: port, PortEnd: port, Version: "0.1.0-test", ArtifactDir: t.TempDir()})

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- srv.Run(ctx, io.Discard) }()

	base := fmt.Sprintf("127.0.0.1:%d", port)
	waitForHealth(t, "http://"+base+"/health")

	return base, func() {
		cancel()
		select {
		case <-done:
		case <-time.After(5 * time.Second):
			t.Error("daemon did not shut down within timeout")
		}
	}
}

func dialConnector(t *testing.T, base, windowID string) *websocket.Conn {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	c, _, err := websocket.Dial(ctx, "ws://"+base+"/eda", nil)
	if err != nil {
		t.Fatalf("dial connector: %v", err)
	}

	reg := protocol.Register{
		Type:             protocol.TypeRegister,
		WindowID:         windowID,
		ConnectorVersion: "0.1.0",
		EasyEDAVersion:   "test",
		Capabilities:     []string{"schematic.v1"},
	}
	if err := wsjson.Write(ctx, c, reg); err != nil {
		t.Fatalf("send register: %v", err)
	}
	return c
}

// echoRequests replies to every inbound request with an ok response that echoes
// the action name, until ctx is cancelled or the connection drops.
func echoRequests(ctx context.Context, c *websocket.Conn) {
	for {
		_, data, err := c.Read(ctx)
		if err != nil {
			return
		}
		var typed protocol.Typed
		if json.Unmarshal(data, &typed) != nil || typed.Type != protocol.TypeRequest {
			continue
		}
		var req protocol.Request
		if json.Unmarshal(data, &req) != nil {
			continue
		}
		resp := protocol.Response{
			Envelope: protocol.Envelope{ID: req.ID, Type: protocol.TypeResponse, Version: "v1"},
			OK:       true,
			Result:   map[string]any{"echo": req.Action},
		}
		_ = wsjson.Write(ctx, c, resp)
	}
}

func getHealth(t *testing.T, base string) health {
	t.Helper()
	resp, err := http.Get("http://" + base + "/health")
	if err != nil {
		t.Fatalf("get health: %v", err)
	}
	defer resp.Body.Close()
	var h health
	if err := json.NewDecoder(resp.Body).Decode(&h); err != nil {
		t.Fatalf("decode health: %v", err)
	}
	return h
}

func waitForWindow(t *testing.T, base, windowID string) Window {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for {
		for _, w := range getHealth(t, base).Windows {
			if w.WindowID == windowID {
				return w
			}
		}
		if time.Now().After(deadline) {
			t.Fatalf("window %q never appeared in /health", windowID)
		}
		time.Sleep(25 * time.Millisecond)
	}
}

func postAction(t *testing.T, base, body string) protocol.Response {
	t.Helper()
	resp, err := http.Post("http://"+base+"/action", "application/json", strings.NewReader(body))
	if err != nil {
		t.Fatalf("post action: %v", err)
	}
	defer resp.Body.Close()
	var out protocol.Response
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatalf("decode action response: %v", err)
	}
	return out
}

func TestConnectorRegistersAndContextAppearsInHealth(t *testing.T) {
	base, cleanup := startDaemon(t)
	defer cleanup()

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	c := dialConnector(t, base, "win-1")
	defer c.Close(websocket.StatusNormalClosure, "")

	ctxMsg := protocol.ContextMessage{
		Type:         protocol.TypeContext,
		WindowID:     "win-1",
		ProjectUUID:  "proj-9",
		ProjectName:  "demo",
		DocumentType: "schematic",
	}
	if err := wsjson.Write(ctx, c, ctxMsg); err != nil {
		t.Fatalf("send context: %v", err)
	}

	win := waitForWindow(t, base, "win-1")
	if win.ConnectorVersion != "0.1.0" {
		t.Fatalf("unexpected connector version: %q", win.ConnectorVersion)
	}

	// Context delivery is async relative to register; poll for it.
	deadline := time.Now().Add(3 * time.Second)
	for win.Context.ProjectUUID == "" && time.Now().Before(deadline) {
		time.Sleep(25 * time.Millisecond)
		win = waitForWindow(t, base, "win-1")
	}
	if win.Context.ProjectUUID != "proj-9" || win.Context.DocumentType != "schematic" {
		t.Fatalf("context not reflected in health: %+v", win.Context)
	}
}

func TestActionDispatchToConnectorLegacyEntryGone(t *testing.T) {
	base, cleanup := startDaemon(t)
	defer cleanup()
	response, err := http.Post("http://"+base+"/action", "application/json", strings.NewReader(`{"action":"schematic.components.list"}`))
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	payload, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != http.StatusGone || !strings.Contains(string(payload), "V2_ACTION_NOT_MIGRATED") {
		t.Fatalf("legacy action accepted: %d %s", response.StatusCode, payload)
	}
}

func TestSystemHealthActionNeedsNoConnectorLegacyEntryGone(t *testing.T) {
	base, cleanup := startDaemon(t)
	defer cleanup()
	response, err := http.Post("http://"+base+"/action", "application/json", strings.NewReader(`{"action":"system.health"}`))
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	payload, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != http.StatusGone || !strings.Contains(string(payload), "V2_ACTION_NOT_MIGRATED") {
		t.Fatalf("legacy action accepted: %d %s", response.StatusCode, payload)
	}
}

func TestActionWithoutConnectorLegacyEntryGone(t *testing.T) {
	base, cleanup := startDaemon(t)
	defer cleanup()
	response, err := http.Post("http://"+base+"/action", "application/json", strings.NewReader(`{"action":"schematic.components.list"}`))
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	payload, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != http.StatusGone || !strings.Contains(string(payload), "V2_ACTION_NOT_MIGRATED") {
		t.Fatalf("legacy action accepted: %d %s", response.StatusCode, payload)
	}
}

func TestUnknownActionRejectedLegacyEntryGone(t *testing.T) {
	base, cleanup := startDaemon(t)
	defer cleanup()
	response, err := http.Post("http://"+base+"/action", "application/json", strings.NewReader(`{"action":"bogus.thing"}`))
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	payload, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != http.StatusGone || !strings.Contains(string(payload), "V2_ACTION_NOT_MIGRATED") {
		t.Fatalf("legacy action accepted: %d %s", response.StatusCode, payload)
	}
}

func TestDaemonSendsHandshakeOnConnect(t *testing.T) {
	base, cleanup := startDaemon(t)
	defer cleanup()

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	c, _, err := websocket.Dial(ctx, "ws://"+base+"/eda", nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer c.Close(websocket.StatusNormalClosure, "")

	var hs protocol.Handshake
	if err := wsjson.Read(ctx, c, &hs); err != nil {
		t.Fatalf("read handshake: %v", err)
	}
	if hs.Type != protocol.TypeHandshake || hs.Service != Service {
		t.Fatalf("expected handshake for %q, got %+v", Service, hs)
	}
}

func TestPingGetsPong(t *testing.T) {
	base, cleanup := startDaemon(t)
	defer cleanup()

	c := dialConnector(t, base, "win-1")
	defer c.Close(websocket.StatusNormalClosure, "")

	ctx := t.Context()
	if err := wsjson.Write(ctx, c, protocol.Ping{Type: protocol.TypePing, ID: "hb-7"}); err != nil {
		t.Fatalf("send ping: %v", err)
	}

	deadline := time.Now().Add(3 * time.Second)
	for {
		if time.Now().After(deadline) {
			t.Fatal("no pong received")
		}
		_, data, err := c.Read(ctx)
		if err != nil {
			t.Fatalf("read: %v", err)
		}
		var typed protocol.Typed
		if json.Unmarshal(data, &typed) != nil || typed.Type != protocol.TypePong {
			continue // skip the handshake frame and anything else
		}
		var pong protocol.Pong
		if err := json.Unmarshal(data, &pong); err != nil {
			t.Fatalf("decode pong: %v", err)
		}
		if pong.ID != "hb-7" {
			t.Fatalf("pong id mismatch: %q", pong.ID)
		}
		return
	}
}

func TestLogFrameIsHandledGracefully(t *testing.T) {
	base, cleanup := startDaemon(t)
	defer cleanup()

	c := dialConnector(t, base, "win-1")
	defer c.Close(websocket.StatusNormalClosure, "")

	ctx := t.Context()

	// A connector diagnostic log frame must be accepted without dropping the
	// connection. Send one, then prove the socket still serves ping/pong — i.e.
	// the read loop survived the log frame.
	logFrame := struct {
		Type string `json:"type"`
		Msg  string `json:"msg"`
	}{Type: protocol.TypeLog, Msg: "liveness lost: 3 pings unanswered"}
	if err := wsjson.Write(ctx, c, logFrame); err != nil {
		t.Fatalf("send log frame: %v", err)
	}

	if err := wsjson.Write(ctx, c, protocol.Ping{Type: protocol.TypePing, ID: "hb-after-log"}); err != nil {
		t.Fatalf("send ping: %v", err)
	}

	deadline := time.Now().Add(3 * time.Second)
	for {
		if time.Now().After(deadline) {
			t.Fatal("no pong after log frame — log handling broke the connection")
		}
		_, data, err := c.Read(ctx)
		if err != nil {
			t.Fatalf("read: %v", err)
		}
		var typed protocol.Typed
		if json.Unmarshal(data, &typed) != nil || typed.Type != protocol.TypePong {
			continue
		}
		var pong protocol.Pong
		if err := json.Unmarshal(data, &pong); err != nil {
			t.Fatalf("decode pong: %v", err)
		}
		if pong.ID == "hb-after-log" {
			return
		}
	}
}

func TestActionArtifactPersistedLegacyEntryGone(t *testing.T) {
	base, cleanup := startDaemon(t)
	defer cleanup()
	response, err := http.Post("http://"+base+"/action", "application/json", strings.NewReader(`{"action":"pcb.snapshot"}`))
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	payload, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != http.StatusGone || !strings.Contains(string(payload), "V2_ACTION_NOT_MIGRATED") {
		t.Fatalf("legacy action accepted: %d %s", response.StatusCode, payload)
	}
}
