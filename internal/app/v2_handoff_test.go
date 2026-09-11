package app

import (
	"bytes"
	"encoding/json"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestCaptureHeldHandoffOnlyReadsLiveOwner(t *testing.T) {
	for _, mode := range []string{"valid", "foreign", "pending"} {
		t.Run(mode, func(t *testing.T) {
			var spec *protocol.V2Action
			for _, a := range protocol.AllActions() {
				if a.Name == "pcb.save" {
					spec = a.V2
				}
			}
			r := executionv2.Request{Protocol: executionv2.Version, Action: "pcb.save", ActionRevision: spec.Revision, Schema: spec.SchemaID(), RequestID: "request", OperationID: "held", Target: executionv2.Target{Scope: "DOCUMENT", Session: "old", Activation: "a", ProjectUUID: "p", DocumentUUID: "d", DocumentType: "pcb", TabID: "t"}, Input: map[string]any{}, BudgetMS: 1000}
			digest, _ := r.Digest()
			e := executionv2.HandlerResult{Protocol: executionv2.Version, OperationID: r.OperationID, Digest: digest, Target: r.Target, Effects: executionv2.Effects{Started: executionv2.Bool(true), Settled: true, Scope: "SAVE"}}
			result := executionv2.Result{Protocol: executionv2.Version, OperationID: r.OperationID, Outcome: executionv2.Unknown, Effects: e.Effects, EvidenceRef: r.OperationID}
			if mode == "foreign" {
				e.Digest = "foreign"
			}
			if mode == "pending" {
				e.Effects.Settled = false
				result.Effects.Settled = false
			}
			reads := 0
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, q *http.Request) {
				if q.Method != "GET" || q.URL.Query().Get("id") != "held" {
					t.Error("non-read capture", q.Method)
					http.Error(w, "bad", 400)
					return
				}
				reads++
				if q.URL.Query().Get("view") == "evidence" {
					json.NewEncoder(w).Encode(e)
				} else {
					json.NewEncoder(w).Encode(result)
				}
			}))
			defer server.Close()
			dir := t.TempDir()
			input := filepath.Join(dir, "request.json")
			output := filepath.Join(dir, "handoff.json")
			data, _ := json.Marshal(r)
			os.WriteFile(input, data, 0600)
			var out bytes.Buffer
			command := newV2Cmd(&out)
			command.SetArgs([]string{"--endpoint", server.URL, "capture-held-handoff", input, output})
			err := command.Execute()
			if mode != "valid" {
				if err == nil {
					t.Fatal("unsafe capture")
				}
				if _, err = os.Stat(output); !os.IsNotExist(err) {
					t.Fatal("invalid file published")
				}
				return
			}
			if err != nil || reads != 3 {
				t.Fatal(err, reads)
			}
			fresh := executionv2.New(10, nil, nil)
			if _, err = fresh.RestoreHandoff(output); err != nil {
				t.Fatal(err)
			}
			restored, _ := fresh.Status("held")
			if restored.Outcome != executionv2.Unknown || restored.OwnershipReleased {
				t.Fatal(restored)
			}
		})
	}
}
