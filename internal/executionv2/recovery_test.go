package executionv2

import (
	"context"
	"sync/atomic"
	"testing"
	"time"
)

func TestRecoveryReadsAndSettledUnknownOwnership(t *testing.T) {
	for _, settled := range []bool{false, true} {
		t.Run(map[bool]string{false: "pending", true: "settled"}[settled], func(t *testing.T) {
			var effects, reads, releases atomic.Int32
			source := request("original")
			source.BudgetMS = 500
			c := New(20, func(r Request) (Admission, error) {
				scope := "DESIGN_CONTENT"
				if r.Action == "document.current" {
					scope = "NONE"
				}
				return Admission{EffectScope: scope}, nil
			}, func(r Request, d string) <-chan HandlerResult {
				ch := make(chan HandlerResult, 1)
				h := evidence(r, "unavailable", true, 0, 1)
				h.Effects.Settled = settled
				if r.Action == "document.current" {
					reads.Add(1)
					h = evidence(r, "satisfied", false, 1, 0)
					h.Effects.Scope = "NONE"
				} else {
					effects.Add(1)
				}
				ch <- h
				return ch
			})
			c.OnResolved(func(Request, string) { releases.Add(1) })
			original, err := c.Submit(context.Background(), source)
			if err != nil || original.Outcome != Unknown {
				t.Fatal(original, err)
			}
			read := request("recovery")
			read.Action = "document.current"
			read.Target.Session = "new-session"
			read.Target.Activation = "new-activation"
			read.Target.TabID = "new-tab"
			if out, err := c.Submit(context.Background(), read); err != nil || out.Outcome != Succeeded {
				t.Fatal("read barrier", out, err)
			}
			out, err := c.ReleaseSettled(source.OperationID, read.OperationID)
			if !settled {
				if err == nil {
					t.Fatal("pending released")
				}
				if _, err = c.Submit(context.Background(), request("effect")); err == nil {
					t.Fatal("pending effect admitted")
				}
				return
			}
			if err != nil || out.Outcome != Unknown || !out.OwnershipReleased {
				t.Fatal(out, err)
			}
			before := effects.Load()
			if dup, err := c.Submit(context.Background(), source); err != nil || dup.Outcome != Unknown || !dup.OwnershipReleased {
				t.Fatal(dup, err)
			}
			if effects.Load() != before || reads.Load() != 1 {
				t.Fatal("recovery replay")
			}
			time.Sleep(time.Millisecond)
			if current, _ := c.Status(source.OperationID); current.Outcome != Unknown {
				t.Fatal(current)
			}
			if _, err = c.Submit(context.Background(), request("next-effect")); err != nil {
				t.Fatal("released barrier", err)
			}
			if effects.Load() != 2 {
				t.Fatal(effects.Load())
			}
		})
	}
}
func TestRecoveryStableIdentityAndForeignProof(t *testing.T) {
	original := request("original")
	for _, field := range []string{"project", "document", "type", "scope", "empty", "same"} {
		t.Run(field, func(t *testing.T) {
			b := original.Target
			b.Session = "new"
			b.Activation = "new"
			b.TabID = "new"
			switch field {
			case "project":
				b.ProjectUUID = "wrong"
			case "document":
				b.DocumentUUID = "wrong"
			case "type":
				b.DocumentType = "schematic"
			case "scope":
				b.Scope = "PROJECT"
			case "empty":
				b.DocumentUUID = ""
			}
			if SameRecoveryDocument(original.Target, b) != (field == "same") {
				t.Fatal(field)
			}
		})
	}
	for _, mode := range []string{"digest", "target", "started", "scope", "malformed-effects"} {
		t.Run(mode, func(t *testing.T) {
			c := New(10, func(r Request) (Admission, error) {
				scope := "DESIGN_CONTENT"
				if r.Action == "document.current" {
					scope = "NONE"
				}
				return Admission{EffectScope: scope}, nil
			}, func(r Request, d string) <-chan HandlerResult {
				ch := make(chan HandlerResult, 1)
				h := evidence(r, "unavailable", true, 0, 1)
				if r.Action == "document.current" {
					h = evidence(r, "satisfied", false, 1, 0)
					h.Effects.Scope = "NONE"
				} else {
					switch mode {
					case "digest":
						h.Digest = "foreign"
					case "target":
						h.Target.DocumentUUID = "foreign"
					case "malformed-effects":
						h.Effects.Started = Bool(false)
						h.Effects.Changed = Bool(true)
					case "started":
						h.Effects.Started = nil
					case "scope":
						h.Effects.Scope = "NONE"
					}
				}
				ch <- h
				return ch
			})
			_, _ = c.Submit(context.Background(), original)
			r := request("read")
			r.Action = "document.current"
			_, _ = c.Submit(context.Background(), r)
			if _, err := c.ReleaseSettled(original.OperationID, r.OperationID); err == nil {
				t.Fatal("foreign proof released")
			}
		})
	}
}
