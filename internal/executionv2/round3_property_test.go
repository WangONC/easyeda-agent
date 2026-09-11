package executionv2

import (
	"encoding/json"
	"math/rand"
	"testing"
)

// Metamorphic safety properties, independent of action-specific projections.
// Raw payload variation must never authorize a different outcome.
func TestRound3FinalizerSafetyProperties(t *testing.T) {
	rng := rand.New(rand.NewSource(583))
	r := request("property")
	digest, _ := r.Digest()
	for i := 0; i < 10000; i++ {
		n := rng.Intn(100) + 1
		k := rng.Intn(n + 1)
		h := evidence(r, []string{"satisfied", "partial", "unchanged", "unavailable"}[rng.Intn(4)], rng.Intn(2) == 1, k, n-k)
		h.Effects.Settled = rng.Intn(2) == 1
		h.Effects.Reconciled = rng.Intn(2) == 1
		h.Verification.Complete = rng.Intn(2) == 1
		late := rng.Intn(2) == 1
		got := Finalize(r, digest, h, late)
		h.Value = json.RawMessage(`{"ok":true,"verified":true,"status":"success","partial":false}`)
		h.Evidence = json.RawMessage(`{"outcome":"SUCCEEDED","request_satisfied":true}`)
		if Finalize(r, digest, h, late).Outcome != got.Outcome {
			t.Fatal("raw data changed outcome", i)
		}
		if !h.Effects.Settled || !h.Verification.Complete || late && !h.Effects.Reconciled {
			if got.Outcome != Unknown {
				t.Fatal("unsettled/incomplete evidence authorized", i, got)
			}
		}
		if got.Outcome == Succeeded && (k != n || h.Verification.Verdict != "satisfied") {
			t.Fatal("incomplete success", i)
		}
		if got.Outcome == Partial && (n-k == 0 || !*h.Effects.Changed || !h.Effects.Settled) {
			t.Fatal("false partial", i)
		}
		h.Target.TabID = "foreign"
		if Finalize(r, digest, h, late).Outcome != Unknown {
			t.Fatal("wrong-target proof accepted", i)
		}
	}
}
