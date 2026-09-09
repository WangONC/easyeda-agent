package app

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"

	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
)

func TestDisabledActionsCLI(t *testing.T) {
	t.Setenv(protocol.DisabledActionsEnv, "")
	// Explicitly test absence as well as the empty value.
	os.Unsetenv(protocol.DisabledActionsEnv)
	cfg, daemon, closeDaemon := newAutolayoutTestDaemon(t, func(_ int, _ autolayoutTestCall) string {
		return `{"ok":true,"result":{}}`
	})
	defer closeDaemon()
	var out, stderr bytes.Buffer
	if code := Run([]string{"--host", cfg.host, "--ports", cfg.ports, "call", "system.health"}, &out, &stderr); code != 0 {
		t.Fatalf("enabled call: %s %s", out.String(), stderr.String())
	}
	if len(daemon.snapshot()) != 1 {
		t.Fatal("enabled action not dispatched")
	}
	out.Reset()
	if Run([]string{"actions"}, &out, &stderr) != 0 || !bytes.Contains(out.Bytes(), []byte(`"pcb.import_autoroute"`)) {
		t.Fatal("enabled catalog")
	}
	t.Setenv(protocol.DisabledActionsEnv, "pcb.import_autoroute,system.health")
	out.Reset()
	if Run([]string{"actions"}, &out, &stderr) != 0 || bytes.Contains(out.Bytes(), []byte(`"pcb.import_autoroute"`)) {
		t.Fatal("disabled catalog")
	}
	for _, action := range []string{"pcb.import_autoroute", "system.health"} {
		out.Reset()
		stderr.Reset()
		if Run([]string{"--ports", "invalid", "call", action}, &out, &stderr) != 1 {
			t.Fatal("disabled call succeeded")
		}
		var got struct {
			OK    bool
			Error struct{ Code, Action, Source string }
		}
		if err := json.Unmarshal(out.Bytes(), &got); err != nil {
			t.Fatal(err, out.String(), stderr.String())
		}
		if got.OK || got.Error.Code != "CAPABILITY_DISABLED" || got.Error.Action != action || got.Error.Source != protocol.DisabledActionsEnv {
			t.Fatalf("%+v", got)
		}
	}
	if len(daemon.snapshot()) != 1 {
		t.Fatal("disabled call reached daemon")
	}
}

// Count every HTTP request, including daemon discovery, rather than only /action.
func TestDisabledActionsTypedWrapper(t *testing.T) {
	const action = "pcb.import_autoroute"
	t.Setenv(protocol.DisabledActionsEnv, "")
	file := filepath.Join(t.TempDir(), "route.ses")
	if err := os.WriteFile(file, []byte("test routed result"), 0600); err != nil {
		t.Fatal(err)
	}
	var requests, actions atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		switch r.URL.Path {
		case "/health":
			_, _ = w.Write([]byte(`{"service":"easyeda-agent","windows":[{"windowId":"w1"}]}`))
		case "/action":
			var body struct{ Action string }
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Action != action {
				t.Errorf("unexpected action: %+v, %v", body, err)
			}
			actions.Add(1)
			_, _ = w.Write([]byte(`{"ok":true,"result":{}}`))
		default:
			t.Errorf("unexpected request: %s", r.URL.Path)
			http.NotFound(w, r)
		}
	}))
	defer server.Close()
	address, err := url.Parse(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	prefix := []string{"--host", address.Hostname(), "--ports", address.Port() + "-" + address.Port()}
	paths := [][]string{{"call", action}, {"pcb", "import-autoroute", file}}
	for _, disabled := range []bool{true, false} {
		if disabled {
			t.Setenv(protocol.DisabledActionsEnv, action)
		} else if err := os.Unsetenv(protocol.DisabledActionsEnv); err != nil {
			t.Fatal(err)
		}
		for _, path := range paths {
			requests.Store(0)
			actions.Store(0)
			var out, stderr bytes.Buffer
			code := Run(append(append([]string{}, prefix...), path...), &out, &stderr)
			if disabled {
				var response struct {
					OK    bool
					Error struct{ Code, Action, Source string }
				}
				if err := json.Unmarshal(out.Bytes(), &response); err != nil {
					t.Fatal(err, out.String(), stderr.String())
				}
				if code != 1 || response.OK || response.Error.Code != "CAPABILITY_DISABLED" || response.Error.Action != action || response.Error.Source != protocol.DisabledActionsEnv {
					t.Fatalf("%v: code=%d response=%+v", path, code, response)
				}
				if requests.Load() != 0 {
					t.Fatalf("%v accessed daemon %d times", path, requests.Load())
				}
			} else if code != 0 || actions.Load() != 1 {
				t.Fatalf("enabled %v: code=%d actions=%d output=%s stderr=%s", path, code, actions.Load(), out.String(), stderr.String())
			}
		}
	}
}
