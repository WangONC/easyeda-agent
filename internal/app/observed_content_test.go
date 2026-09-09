package app

import "testing"

func TestObservedContentDoesNotMistakeLegacyEpochForGeometry(t *testing.T) {
	a := &actionResult{Context: &actionContext{ProjectUUID: "p", DocumentUUID: "d"}, Result: map[string]any{"board_revision": "r1", "observation_hash": "same"}}
	b := &actionResult{Context: a.Context, Result: map[string]any{"board_revision": "r2", "observation_hash": "same"}}
	if !sameObservedContent(a, b) {
		t.Fatal("legacy epoch change invalidated identical content")
	}
	b.Result["observation_hash"] = "changed"
	if sameObservedContent(a, b) {
		t.Fatal("content change ignored")
	}
	delete(b.Result, "observation_hash")
	if sameObservedContent(a, b) {
		t.Fatal("missing evidence accepted")
	}
}
