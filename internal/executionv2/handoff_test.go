package executionv2

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestHandoffRestartUnknownBarrierRecovery(t *testing.T) {
	for _, settled := range []bool{true, false} {
		t.Run(map[bool]string{true: "settled", false: "pending"}[settled], func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "receipts.json")
			writes := 0
			validate := func(r Request) (Admission, error) {
				scope := "DESIGN_CONTENT"
				if r.Action == "document.current" {
					scope = "NONE"
				}
				return Admission{EffectScope: scope}, nil
			}
			execute := func(r Request, d string) <-chan HandlerResult {
				ch := make(chan HandlerResult, 1)
				h := evidence(r, "unavailable", true, 0, 1)
				h.Effects.Settled = settled
				if r.Action == "document.current" {
					h = evidence(r, "satisfied", false, 1, 0)
					h.Effects.Scope = "NONE"
				} else {
					writes++
				}
				ch <- h
				return ch
			}
			original := request("original")
			old := New(20, validate, execute)
			if _, err := old.Submit(context.Background(), original); err != nil {
				t.Fatal(err)
			}
			if err := old.SaveHandoff(path); err != nil {
				t.Fatal(err)
			}
			if _, err := old.Submit(context.Background(), request("after-freeze")); err == nil {
				t.Fatal("handoff admitted request")
			}
			restored := New(20, validate, execute)
			if _, err := restored.RestoreHandoff(path); err != nil {
				t.Fatal(err)
			}
			if writes != 1 {
				t.Fatal("restart replay")
			}
			if got, _ := restored.Status("original"); got.Outcome != Unknown || got.Effects.Settled != settled {
				t.Fatal(got)
			}
			if _, err := restored.Submit(context.Background(), request("blocked")); err == nil {
				t.Fatal("lost barrier")
			}
			if _, err := restored.Submit(context.Background(), original); err != nil || writes != 1 {
				t.Fatal("duplicate replay", err, writes)
			}
			read := request("fresh-read")
			read.Action = "document.current"
			read.Target.Session = "new-session"
			read.Target.Activation = "new-activation"
			read.Target.TabID = "new-tab"
			if _, err := restored.Submit(context.Background(), read); err != nil {
				t.Fatal(err)
			}
			result, err := restored.ReleaseSettled("original", read.OperationID)
			if !settled {
				if err == nil {
					t.Fatal("pending released")
				}
				return
			}
			if err != nil || result.Outcome != Unknown || !result.OwnershipReleased || writes != 1 {
				t.Fatal(result, err, writes)
			}
			if _, err := restored.Submit(context.Background(), request("new-effect")); err != nil || writes != 2 {
				t.Fatal(err, writes)
			}
			// Repeat atomic replacement; a released UNKNOWN remains a tombstone and the
			// new unresolved effect, not the old operation, owns the next restart fence.
			if err := restored.SaveHandoff(path); err != nil {
				t.Fatal(err)
			}
			next := New(20, validate, execute)
			if _, err := next.RestoreHandoff(path); err != nil {
				t.Fatal(err)
			}
			if r, _ := next.Status("original"); !r.OwnershipReleased || r.Outcome != Unknown {
				t.Fatal(r)
			}
			if writes != 2 {
				t.Fatal("second restart replay")
			}
		})
	}
}

func TestHandoffMalformedFailsClosed(t *testing.T) {
	for _, mode := range []string{"truncated", "digest", "owner", "settled", "outcome", "duplicate"} {
		t.Run(mode, func(t *testing.T) {
			r := request("original")
			d, _ := r.Digest()
			e := evidence(r, "unavailable", true, 0, 1)
			h := Handoff{Version: "execution.v2.handoff.1", Owner: r.OperationID, Receipts: []Receipt{{Request: r, Digest: d, Result: Finalize(r, d, e, false), Evidence: e, Scope: "DESIGN_CONTENT"}}}
			switch mode {
			case "digest":
				h.Receipts[0].Digest = "foreign"
			case "owner":
				h.Owner = ""
			case "settled":
				h.Receipts[0].Evidence.Effects.Settled = false
			case "outcome":
				h.Receipts[0].Result.Outcome = "PASS"
			case "duplicate":
				h.Receipts = append(h.Receipts, h.Receipts[0])
			}
			data, _ := json.Marshal(h)
			if mode == "truncated" {
				data = data[:len(data)/2]
			}
			path := filepath.Join(t.TempDir(), "receipt")
			if err := os.WriteFile(path, data, 0600); err != nil {
				t.Fatal(err)
			}
			c := New(20, nil, func(Request, string) <-chan HandlerResult { t.Fatal("restore executed"); return nil })
			if _, err := c.RestoreHandoff(path); err == nil {
				t.Fatal("malformed accepted")
			}
			if _, exists := c.Status(r.OperationID); exists {
				t.Fatal("partial restore")
			}
		})
	}
}
