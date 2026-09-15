package app

import (
	"testing"
	"time"
)

func TestDeadlinePolicySeparatesActionCostClasses(t *testing.T) {
	tests := []struct {
		action string
		class  deadlineClass
		want   time.Duration
	}{
		{"schematic.read", deadlineLightRead, 20 * time.Second},
		{"schematic.wire.create", deadlineRoutineSchWrite, 60 * time.Second},
		{"pcb.line.create", deadlineVerifiedWrite, 90 * time.Second},
		{"schematic.drc.check", deadlineNativeCompute, 150 * time.Second},
		{"pcb.manufacturing.export", deadlineNativeCompute, 150 * time.Second},
		{"schematic.save", deadlineSaveReload, 120 * time.Second},
		{"document.open", deadlineSaveReload, 120 * time.Second},
	}
	for _, tt := range tests {
		t.Run(tt.action, func(t *testing.T) {
			got := deadlineForAction(tt.action)
			if got.Class != tt.class || got.Timeout != tt.want {
				t.Fatalf("got %+v, want %s/%s", got, tt.class, tt.want)
			}
		})
	}
}
