package protocol

import (
	"os"
	"strings"
)

const DisabledActionsEnv = "EASYEDA_DISABLED_ACTIONS"

func disabledActions() map[string]bool {
	disabled := map[string]bool{}
	for _, value := range strings.Split(os.Getenv(DisabledActionsEnv), ",") {
		if name := strings.TrimSpace(value); name != "" {
			disabled[name] = true
		}
	}
	return disabled
}

// ActionDisabled matches full names only; this is process configuration, not authorization.
func ActionDisabled(name string) bool { return disabledActions()[name] }

// AvailableActions filters discovery without removing the underlying action definitions.
func AvailableActions() []ActionSpec {
	disabled := disabledActions()
	result := []ActionSpec{}
	for _, action := range AllActions() {
		if !disabled[action.Name] {
			result = append(result, action)
		}
	}
	return result
}
