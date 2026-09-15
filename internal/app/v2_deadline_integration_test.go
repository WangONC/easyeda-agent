package app

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/zhoushoujianwork/easyeda-agent/internal/daemon"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
)

func reserveV2TestPort(t *testing.T) int {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := listener.Addr().(*net.TCPAddr).Port
	if err := listener.Close(); err != nil {
		t.Fatal(err)
	}
	return port
}

func waitForV2TestDaemon(t *testing.T, base string, stopped <-chan error) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		response, err := http.Get(base + "/health")
		if err == nil {
			response.Body.Close()
			if response.StatusCode == http.StatusOK {
				return
			}
		}
		select {
		case err := <-stopped:
			t.Fatalf("daemon stopped before health: %v", err)
		case <-time.After(10 * time.Millisecond):
		}
	}
	t.Fatal("daemon health timeout")
}

func TestRoutineSchematicMutationBudgetReachesConnector(t *testing.T) {
	port := reserveV2TestPort(t)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	stopped := make(chan error, 1)
	server := daemon.New(daemon.Options{
		Host: "127.0.0.1", PortStart: port, PortEnd: port, Version: "dev",
		ArtifactDir: t.TempDir(), AuditDir: t.TempDir(), V2HostStartupConfirmed: true,
	})
	go func() { stopped <- server.Run(ctx, io.Discard) }()
	base := "http://127.0.0.1:" + strconv.Itoa(port)
	waitForV2TestDaemon(t, base, stopped)

	wsCtx, wsCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer wsCancel()
	ws, _, err := websocket.Dial(wsCtx, "ws://127.0.0.1:"+strconv.Itoa(port)+"/eda", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer ws.CloseNow()
	var handshake map[string]any
	if err := wsjson.Read(wsCtx, ws, &handshake); err != nil {
		t.Fatal(err)
	}
	if err := wsjson.Write(wsCtx, ws, map[string]any{"type": "register", "windowId": "physical", "activationId": "activation", "transportId": "transport", "capabilities": []string{"execution.v2"}}); err != nil {
		t.Fatal(err)
	}
	if err := wsjson.Write(wsCtx, ws, map[string]any{"type": "context", "windowId": "physical", "projectUuid": "project", "documentUuid": "document", "documentType": "schematic", "tabId": "tab"}); err != nil {
		t.Fatal(err)
	}

	// Wait until public discovery can bind the exact registered document.
	lastHealth := ""
	for deadline := time.Now().Add(5 * time.Second); ; {
		response, getErr := http.Get(base + "/health")
		if getErr == nil {
			body, _ := io.ReadAll(response.Body)
			response.Body.Close()
			lastHealth = string(body)
			var health struct {
				Windows []healthWindow `json:"windows"`
			}
			if json.Unmarshal(body, &health) == nil {
				for _, window := range health.Windows {
					if window.TransportID == "transport" && window.ActivationID == "activation" && window.Context.DocumentUUID == "document" {
						goto connectorReady
					}
				}
			}
		}
		if time.Now().After(deadline) {
			t.Fatalf("connector context registration timeout: %s", lastHealth)
		}
		time.Sleep(10 * time.Millisecond)
	}

connectorReady:

	var stdout, stderr bytes.Buffer
	root := newRootCmd(&stdout, &stderr)
	root.SetArgs([]string{"--host", "127.0.0.1", "--ports", fmt.Sprintf("%d-%d", port, port), "--skip-version-check", "action", "schematic.wire.create", "--input", `{"points":[0,0,10,0]}`})
	commandDone := make(chan error, 1)
	submittedAt := time.Now()
	go func() { commandDone <- root.Execute() }()

	var dispatched struct {
		Type     string              `json:"type"`
		Request  executionv2.Request `json:"request"`
		Digest   string              `json:"digest"`
		Deadline int64               `json:"deadline_unix_ms"`
	}
	if err := wsjson.Read(wsCtx, ws, &dispatched); err != nil {
		t.Fatal(err)
	}
	if dispatched.Type != "v2_request" || dispatched.Request.Action != "schematic.wire.create" {
		t.Fatalf("wrong Connector frame: %+v", dispatched)
	}
	if dispatched.Request.BudgetMS != 60000 {
		t.Fatalf("routine mutation budget=%d, want 60000", dispatched.Request.BudgetMS)
	}
	remaining := time.UnixMilli(dispatched.Deadline).Sub(submittedAt)
	if remaining < 59*time.Second || remaining > 61*time.Second {
		t.Fatalf("Connector deadline offset=%s, want about 60s", remaining)
	}
	proof := executionv2.HandlerResult{
		Protocol: executionv2.Version, OperationID: dispatched.Request.OperationID, Digest: dispatched.Digest, Target: dispatched.Request.Target,
		Effects:      executionv2.Effects{Started: executionv2.Bool(true), Changed: executionv2.Bool(true), Settled: true, Scope: "DESIGN_CONTENT"},
		Verification: executionv2.Verification{Verdict: "satisfied", Checked: []string{"fresh_wire_geometry"}, Complete: true, Required: 1, Satisfied: 1},
		Value:        json.RawMessage(`{"primitiveId":"wire-1"}`),
	}
	if err := wsjson.Write(wsCtx, ws, map[string]any{"type": "v2_result", "result": proof}); err != nil {
		t.Fatal(err)
	}
	if err := <-commandDone; err != nil {
		t.Fatalf("CLI failed: %v stdout=%s stderr=%s", err, stdout.String(), stderr.String())
	}
	if !strings.Contains(stdout.String(), `"outcome":"SUCCEEDED"`) {
		t.Fatal(stdout.String())
	}
}

func TestExplicitPublicTimeoutOverridesActionClass(t *testing.T) {
	seen := 0
	httpServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req executionv2.Request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Error(err)
		}
		seen = req.BudgetMS
		_ = json.NewEncoder(w).Encode(executionv2.Result{Protocol: executionv2.Version, OperationID: req.OperationID, EvidenceRef: req.OperationID, Outcome: executionv2.Succeeded, Effects: executionv2.Effects{Scope: "DESIGN_CONTENT", Settled: true}})
	}))
	defer httpServer.Close()
	cfg := &appConfig{v2Read: fixtureSchematicBinding(httpServer.URL)}
	if _, err := publicActionV2(cfg, "schematic.wire.create", "", map[string]any{"points": []any{0., 0., 10., 0.}}, 7*time.Second); err != nil {
		t.Fatal(err)
	}
	if seen != 7000 {
		t.Fatalf("explicit budget=%d, want 7000", seen)
	}
}
