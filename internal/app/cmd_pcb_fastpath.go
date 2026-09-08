package app

import (
	"encoding/json"
	"fmt"
	"github.com/spf13/cobra"
	"io"
	"time"
)

func addFastPCBCommands(pcb *cobra.Command, cfg *appConfig, stdout, stderr io.Writer) {
	for _, entry := range []struct{ name, action string }{{"snapshot-compact", "board.snapshot_compact"}, {"route-preflight", "route.preflight"}, {"route-apply-batch", "route.apply_batch"}} {
		var payload, window string
		var timeout time.Duration
		cmd := &cobra.Command{Use: entry.name, Short: "Fast manual PCB V0.1: " + entry.action, Args: cobra.NoArgs,
			RunE: func(cmd *cobra.Command, args []string) error {
				var value map[string]any
				if err := json.Unmarshal([]byte(payload), &value); err != nil {
					return fmt.Errorf("invalid --payload: %w", err)
				}
				return dispatchTimed(cfg, entry.action, window, value, timeout, stdout, stderr)
			}}
		cmd.Flags().StringVar(&payload, "payload", "{}", "Explicit typed JSON payload (mil); no generated route geometry")
		cmd.Flags().StringVar(&window, "window", "", "Connector window ID")
		cmd.Flags().DurationVar(&timeout, "timeout", 60*time.Second, "Total caller budget; timeout never cancels native writes")
		pcb.AddCommand(cmd)
	}
}
