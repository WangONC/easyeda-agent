package daemon

import (
	"encoding/json"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Fast engine geometry/receipt tests remain in internal/fastpath. Its old HTTP
// success semantics are deliberately unavailable until the V2 migration.
func TestFastActionsRejectWithoutLegacyDispatch(t *testing.T) {
	s := New(Options{})
	for _, action := range []string{"board.snapshot_compact", "route.apply_batch"} {
		r := executionv2.Request{Protocol: executionv2.Version, Action: action, ActionRevision: "1", Schema: "not-migrated", RequestID: "r", OperationID: action, Target: executionv2.Target{Scope: "DOCUMENT", Session: "s", Activation: "a", ProjectUUID: "p", DocumentUUID: "d", DocumentType: "pcb", TabID: "t"}, Input: map[string]any{}, BudgetMS: 1000}
		body, err := json.Marshal(r)
		if err != nil {
			t.Fatal(err)
		}
		w := httptest.NewRecorder()
		s.routes(0).ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/v2/operations", strings.NewReader(string(body))))
		if w.Code == http.StatusOK || !strings.Contains(w.Body.String(), "V2_ACTION_NOT_MIGRATED") {
			t.Fatalf("%s: %d %s", action, w.Code, w.Body.String())
		}
	}
}
