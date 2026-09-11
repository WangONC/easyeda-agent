package app

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
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
	if err := dispatch(cfg, "document.current", "", nil, &out, &stderr); err != nil {
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
		if Run([]string{"--ports", "invalid", "action", action}, &out, &stderr) != 1 {
			t.Fatal("disabled call succeeded")
		}
		if out.Len() != 0 || !strings.Contains(stderr.String(), "CAPABILITY_DISABLED") {
			t.Fatalf("admission error must not fabricate a receipt: %s %s", out.String(), stderr.String())
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
	paths := [][]string{{"action", action}, {"pcb", "import-autoroute", file}}
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
				if code != 1 || !strings.Contains(stderr.String(), "CAPABILITY_DISABLED") {
					t.Fatalf("%v: code=%d stdout=%s stderr=%s", path, code, out.String(), stderr.String())
				}
				if requests.Load() != 0 {
					t.Fatalf("%v accessed daemon %d times", path, requests.Load())
				}
			} else if code != 1 || requests.Load() != 0 || actions.Load() != 0 || !strings.Contains(stderr.String(), "V2_ACTION_UNSUPPORTED") {
				t.Fatalf("enabled %v: code=%d actions=%d output=%s stderr=%s", path, code, actions.Load(), out.String(), stderr.String())
			}
		}
	}
}
