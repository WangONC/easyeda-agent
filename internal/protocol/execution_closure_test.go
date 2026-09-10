package protocol

import (
	"encoding/json"
	"os"
	"testing"
)

func TestFastVerifierDoesNotInventContractRequirements(t *testing.T) {
	raw, err := os.ReadFile("testdata/execution.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Name     string
		Request  Request
		Response Response
	}
	if err = json.Unmarshal(raw, &cases); err != nil {
		t.Fatal(err)
	}
	for _, c := range cases {
		if c.Name != "closure01_fast_verification" {
			continue
		}
		f := validateExecution(&c.Request, &c.Response, false)
		if !f.receipt.fastComplete {
			t.Fatal("real complete fixture lost proof")
		}
		f.contract.Verification.Required = append(append([]string{}, f.contract.Verification.Required...), "unimplemented_verification")
		receipt := normalizeReceipt(f)
		if receipt.fastComplete || containsAll(receipt.verifiedRequirements, f.contract.Verification.Required) {
			t.Fatal("unknown requirement invented")
		}
		return
	}
	t.Fatal("missing fixed complete receipt")
}
