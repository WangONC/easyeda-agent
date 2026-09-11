package executionv2

import (
	"context"
	"encoding/json"
	"testing"
)

func TestProjectPCBRecoveryNoReplay(t *testing.T) {
	for _, mode := range []string{"ok", "pending", "wrong-project", "wrong-pcb", "old-pcb", "foreign-schematic", "duplicate-binding", "missing-inventory"} {
		t.Run(mode, func(t *testing.T) {
			writes := 0
			source := request("original")
			source.Action = "board.new_pcb"
			source.Target = Target{Scope: "PROJECT", Session: "old", Activation: "old", ProjectUUID: "p"}
			source.Input = map[string]any{"schematicUuid": "sch"}
			c := New(20, func(r Request) (Admission, error) {
				if r.Action == "board.list" {
					return Admission{EffectScope: "NONE"}, nil
				}
				return Admission{EffectScope: "PROJECT_TOPOLOGY"}, nil
			}, func(r Request, d string) <-chan HandlerResult {
				ch := make(chan HandlerResult, 1)
				h := evidence(r, "unavailable", true, 0, 1)
				h.Digest = d
				h.Effects.Scope = "PROJECT_TOPOLOGY"
				h.Effects.Settled = mode != "pending"
				if r.Action == "board.list" {
					h = evidence(r, "satisfied", false, 1, 0)
					h.Digest = d
					h.Effects.Scope = "NONE"
					h.Effects.Settled = true
					sch := "sch"
					if mode == "foreign-schematic" {
						sch = "foreign"
					}
					rows := []map[string]any{{"parentProjectUuid": "p", "schematicUuid": nil, "pcbUuid": "old-pcb"}, {"parentProjectUuid": "p", "schematicUuid": sch, "pcbUuid": "new-pcb"}}
					if mode == "duplicate-binding" {
						rows = append(rows, rows[1])
					}
					h.Value, _ = json.Marshal(map[string]any{"boards": rows})
					if mode == "missing-inventory" {
						h.Value = nil
					}
				} else {
					writes++
				}
				ch <- h
				return ch
			})
			if _, e := c.Submit(context.Background(), source); e != nil {
				t.Fatal(e)
			}
			read := source
			read.Action = "board.list"
			read.OperationID = "read"
			read.RequestID = "read"
			read.Target.Session = "new"
			read.Target.Activation = "new"
			read.Input = map[string]any{}
			if mode == "wrong-project" {
				read.Target.ProjectUUID = "wrong"
			}
			if _, e := c.Submit(context.Background(), read); e != nil {
				t.Fatal(e)
			}
			pcb := "new-pcb"
			if mode == "wrong-pcb" {
				pcb = "wrong"
			}
			if mode == "old-pcb" {
				pcb = "old-pcb"
			}
			out, e := c.ReleaseSettled(source.OperationID, read.OperationID, pcb)
			if mode == "ok" {
				if e != nil || out.Outcome != Unknown || !out.OwnershipReleased {
					t.Fatal(out, e)
				}
			} else {
				if e == nil {
					t.Fatal("unsafe release")
				}
				out, _ = c.Status(source.OperationID)
				if out.OwnershipReleased {
					t.Fatal("released")
				}
			}
			if _, e = c.Submit(context.Background(), source); e != nil {
				t.Fatal(e)
			}
			if writes != 1 {
				t.Fatal("mutation replay", writes)
			}
		})
	}
}
