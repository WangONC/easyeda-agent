package daemon

import (
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"github.com/zhoushoujianwork/easyeda-agent/internal/workflow"
)

// Outcome is deliberately not an argument. An idempotent success is not a write.
func v2MayChangeDesign(e executionv2.Effects) bool {
	if e.Scope != "DESIGN_CONTENT" && e.Scope != "PROJECT_TOPOLOGY" && e.Scope != "LIBRARY_ASSET" {
		return false
	}
	return e.Changed == nil || *e.Changed
}
func (s *Server) consumeV2Effects(r executionv2.Request, result executionv2.Result) {
	if !v2MayChangeDesign(result.Effects) {
		return
	}
	stage, ok := invalidatesForAction[r.Action]
	if !ok || r.Target.ProjectUUID == "" {
		return
	}
	keys := []string{r.Target.ProjectUUID}
	if c, ok := s.hub.get(r.Target.Session); ok {
		snapshot := c.snapshot()
		if snapshot.Context.ProjectUUID == r.Target.ProjectUUID && snapshot.Context.ProjectName != "" {
			keys = append(keys, snapshot.Context.ProjectName)
		}
	}
	// Reuse persisted stage storage directly, not a legacy Response/OK adapter.
	workflow.InvalidateAll(keys, stage, "Execution V2 operation "+r.OperationID)
}
