package app

import (
	"strings"
	"time"

	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
)

type deadlineClass string

const (
	deadlineLightRead       deadlineClass = "lightweight_read"
	deadlineRoutineSchWrite deadlineClass = "routine_schematic_mutation"
	deadlineVerifiedWrite   deadlineClass = "verified_mutation"
	deadlineNativeCompute   deadlineClass = "native_recompute_or_drc"
	deadlineSaveReload      deadlineClass = "save_reload_or_navigation"
)

type actionDeadline struct {
	Class   deadlineClass
	Timeout time.Duration
}

// deadlineForAction is the built-in budget policy used only when a caller did
// not supply an explicit timeout. It keeps cheap reads fail-fast while giving
// ordinary verified writes enough time for their mandatory fresh readback.
func deadlineForAction(action string) actionDeadline {
	lower := strings.ToLower(action)
	if strings.Contains(lower, "save") || strings.Contains(lower, "reload") ||
		lower == "project.open" || lower == "document.open" || lower == "schematic.page.open" {
		return actionDeadline{deadlineSaveReload, 120 * time.Second}
	}
	if strings.Contains(lower, ".drc") || strings.Contains(lower, "rebuild") ||
		strings.Contains(lower, "recompute") || strings.Contains(lower, "import_changes") ||
		strings.Contains(lower, ".export.") || lower == "pcb.manufacturing.export" {
		return actionDeadline{deadlineNativeCompute, 150 * time.Second}
	}
	for _, spec := range protocol.AllActions() {
		if spec.Name != action {
			continue
		}
		if !spec.Mutates {
			return actionDeadline{deadlineLightRead, defaultActionTimeout}
		}
		if spec.Domain == "schematic" {
			return actionDeadline{deadlineRoutineSchWrite, 60 * time.Second}
		}
		return actionDeadline{deadlineVerifiedWrite, 90 * time.Second}
	}
	return actionDeadline{deadlineLightRead, defaultActionTimeout}
}

func actionTimeout(action string) time.Duration { return deadlineForAction(action).Timeout }
