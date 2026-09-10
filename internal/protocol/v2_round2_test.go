package protocol

import (
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"strings"
	"testing"
)

func TestV2TerminalDispositionsFailClosed(t *testing.T) {
	count := 0
	for _, a := range AllActions() {
		if a.V2Disposition == nil {
			continue
		}
		count++
		if a.V2 != nil || a.V2Disposition.Reason == "" {
			t.Fatal(a.Name)
		}
		_, e := ValidateV2(executionv2.Request{Action: a.Name})
		if e == nil || !strings.Contains(e.Error(), "V2_ACTION_"+a.V2Disposition.Mode) {
			t.Fatal(a.Name, e)
		}
	}
	if count != 7 {
		t.Fatal(count)
	}
}

func TestV2Round2CompleteCatalog(t *testing.T) {
	actions := AllActions()
	if len(actions) != 151 {
		t.Fatal(len(actions))
	}
	native := 0
	for _, a := range actions {
		if a.V2 != nil {
			native++
			if a.V2Disposition != nil {
				t.Fatal(a.Name)
			}
		} else if a.V2Disposition == nil {
			t.Fatalf("unmigrated: %s", a.Name)
		}
	}
	if native != 144 {
		t.Fatal(native)
	}
}
