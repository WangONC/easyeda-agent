package protocol

import "testing"

func TestFixedNumberArrayValidation(t *testing.T) {
	s := map[string]string{"bbox": "number[4]"}
	if err := ValidateV2Input(map[string]any{"bbox": []any{float64(1), float64(2), float64(3), float64(4)}}, s); err != nil {
		t.Fatal(err)
	}
	for _, v := range []any{[]any{}, []any{float64(1), float64(2), float64(3)}, []any{float64(1), float64(2), float64(3), "4"}} {
		if err := ValidateV2Input(map[string]any{"bbox": v}, s); err == nil {
			t.Fatalf("accepted %#v", v)
		}
	}
}
