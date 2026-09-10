package app

import (
	"bytes"
	"encoding/json"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
	"os"
	"testing"
)

func TestCLIExecutionFixtureParity(t *testing.T) {
	b, e := os.ReadFile("../protocol/testdata/execution.json")
	if e != nil {
		t.Fatal(e)
	}
	var cases []struct {
		Name     string
		Request  protocol.Request
		Response json.RawMessage
		Before   bool
		Want     bool `json:"want_satisfied"`
	}
	if e = json.Unmarshal(b, &cases); e != nil {
		t.Fatal(e)
	}
	for _, c := range cases {
		if c.Before || c.Request.Action == "project.create" {
			continue
		}
		t.Run(c.Name, func(t *testing.T) {
			cfg, _, done := newAutolayoutTestDaemon(t, func(_ int, call autolayoutTestCall) string { return string(c.Response) })
			defer done()
			var out, stderr bytes.Buffer
			err := dispatch(cfg, c.Request.Action, "w1", c.Request.Payload, &out, &stderr)
			if (err == nil) != c.Want {
				t.Fatalf("err=%v stdout=%s", err, out.String())
			}
			var got protocol.Response
			if e := json.Unmarshal(out.Bytes(), &got); e != nil {
				t.Fatal(e)
			}
			if got.Execution == nil || got.Execution.RequestSatisfied != c.Want {
				t.Fatal(out.String())
			}
		})
	}
}

func TestCLIUnsupportedPreviewBeforeNetworkOrNavigation(t *testing.T) {
	var out, stderr bytes.Buffer
	err := dispatch(&appConfig{ports: "invalid", doc: "must-not-open"}, "pcb.line.create", "w", map[string]any{"dryRun": true}, &out, &stderr)
	if err != errActionFailed {
		t.Fatal(err)
	}
	var resp protocol.Response
	if e := json.Unmarshal(out.Bytes(), &resp); e != nil {
		t.Fatal(e)
	}
	if resp.Error.Code != "INVALID_DRY_RUN" || resp.Execution.MutationOutcome != protocol.NoWrite {
		t.Fatal(out.String())
	}
}
