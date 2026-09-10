package protocol

import (
	"bytes"
	"encoding/json"
	"os"
	"os/exec"
	"reflect"
	"testing"
)

// Uses the generated TS reducer, including Go->TS, TS->Go and repeated projections.
// Compare the whole serialized Execution, not selected outcome booleans.
func TestExecutionFullCrossLanguageParity(t *testing.T) {
	raw, err := os.ReadFile("testdata/execution.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Name     string
		Request  Request
		Response Response
		Before   bool
	}
	if err = json.Unmarshal(raw, &cases); err != nil {
		t.Fatal(err)
	}
	c, _ := ContractFor("pcb.save")
	var meta Execution
	err = json.Unmarshal([]byte(`{"contract_version":"placeholder","contract_hash":"placeholder","operation_id":"op","parent_operation_id":"parent","request_id":"r","payload_hash":"payload","activation":"activation","executor_build":"build","native_settled":true,"write_attempted":true,"expected_target":{"documentUuid":"d"},"observed_target_before":{"documentUuid":"d"},"observed_target_after":{"documentUuid":"d"},"affected_targets":[{"documentUuid":"d"}],"item_results":[{"custom":"receipt"}],"verification":{"state":"AVAILABLE","coverage":"COMPLETE","required":["saved"],"observed":["saved"],"missing":[],"evidence_refs":["receipt:1"],"source":"verifier","revision":"rev","activation":"activation","observed_at":"time","verifier_version":"v1"},"recovery":{"state":"NOT_REQUESTED","detail":{"retained":true}},"persistence":{"state":"SAVE_ACKNOWLEDGED","receipt":{"retained":true}},"request_satisfied":true,"next_action":"inspect","reason":"save receipt"}`), &meta)
	if err != nil {
		t.Fatal(err)
	}
	meta.ContractVersion = c.Version
	meta.ContractHash = c.Hash
	extra := cases[0]
	extra.Name = "metadata"
	extra.Request = Request{Envelope: Envelope{ID: "r"}, Action: "pcb.save"}
	extra.Response = Response{Envelope: Envelope{ID: "r"}, OK: true, Result: map[string]any{"saved": true}, Execution: &meta}
	cases = append(cases, extra)
	type input struct {
		Request  Request  `json:"request"`
		Response Response `json:"response"`
		Before   bool     `json:"before"`
	}
	var rawInputs []map[string]any
	if err := json.Unmarshal(raw, &rawInputs); err != nil {
		t.Fatal(err)
	}
	inputs := []any{}
	expected := []*Execution{}
	for i, c := range cases {
		e := Interpret(&c.Request, &c.Response, c.Before)
		expected = append(expected, e)
		inputs = append(inputs, input{c.Request, c.Response, c.Before})
		r := c.Response
		r.Execution = e
		inputs = append(inputs, input{c.Request, r, c.Before})
		if i < len(rawInputs) {
			inputs = append(inputs, rawInputs[i])
		} else {
			inputs = append(inputs, input{c.Request, c.Response, c.Before})
		}
	}
	b, _ := json.Marshal(inputs)
	cmd := exec.Command("node", "../../scripts/test-execution-parity.mjs")
	cmd.Stdin = bytes.NewReader(b)
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("node: %v %s", err, output)
	}
	var results []struct {
		First    json.RawMessage
		Repeated json.RawMessage
	}
	if err = json.Unmarshal(output, &results); err != nil {
		t.Fatal(err, string(output))
	}
	normalize := func(v any) any { b, _ := json.Marshal(v); var o any; _ = json.Unmarshal(b, &o); return o }
	for i, c := range cases {
		t.Run(c.Name, func(t *testing.T) {
			want := normalize(expected[i])
			for j := 0; j < 3; j++ {
				for _, raw := range []json.RawMessage{results[3*i+j].First, results[3*i+j].Repeated} {
					var got Execution
					if err := json.Unmarshal(raw, &got); err != nil {
						t.Fatal(err)
					}
					if !reflect.DeepEqual(want, normalize(got)) {
						t.Fatalf("full TS metadata differs\nwant %s\ngot %s", mustJSON(expected[i]), raw)
					}
					resp := c.Response
					resp.Execution = &got
					again := Interpret(&c.Request, &resp, c.Before)
					if !reflect.DeepEqual(want, normalize(again)) {
						t.Fatalf("TS->Go differs\nwant %s\ngot %s", mustJSON(expected[i]), mustJSON(again))
					}
				}
			}
		})
	}
}
func mustJSON(v any) string { b, _ := json.Marshal(v); return string(b) }
