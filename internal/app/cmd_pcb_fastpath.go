package app

import (
	"encoding/json"
	"fmt"
	"github.com/spf13/cobra"
	"github.com/zhoushoujianwork/easyeda-agent/internal/fastpath"
	"io"
	"time"
)

func addFastPCBCommands(pcb *cobra.Command, cfg *appConfig, stdout, stderr io.Writer) {
	addPlaneRefresh(pcb, cfg, stdout, stderr)
	addDRCCompare(pcb, cfg, stdout, stderr)
	addManufacturingExport(pcb, cfg, stdout, stderr)
	for _, entry := range []struct{ name, action string }{{"snapshot-compact", "board.snapshot_compact"}, {"route-preflight", "route.preflight"}, {"route-apply-batch", "route.apply_batch"}, {"placement-preflight", "placement.preflight"}, {"placement-apply-batch", "placement.apply_batch"}, {"tuning-plan", "route.tuning_plan"}, {"pair-plan", "route.pair_plan"}, {"routing-profile", "pcb.routing_profile"}} {
		var payload, window string
		var timeout time.Duration
		cmd := &cobra.Command{Use: entry.name, Short: "Fast manual PCB V0.1: " + entry.action, Args: cobra.NoArgs,
			RunE: func(cmd *cobra.Command, args []string) error {
				var value map[string]any
				if err := json.Unmarshal([]byte(payload), &value); err != nil {
					return fmt.Errorf("invalid --payload: %w", err)
				}
				if entry.action == "route.tuning_plan" || entry.action == "route.pair_plan" {
					res, err := requestActionTimed(cfg, entry.action, window, value, timeout)
					if err != nil {
						return err
					}
					var plan fastpath.Plan
					if err = fastpath.Decode(res.Result["plan"], &plan); err != nil {
						return err
					}
					ops, err := fastpath.HelperOperations(plan)
					if err != nil {
						return err
					}
					projected := make([]map[string]any, 0, len(ops))
					for _, op := range ops {
						var item map[string]any
						if err = fastpath.Decode(op, &item); err != nil {
							return err
						}
						if op.Type != "add_via" {
							delete(item, "x")
							delete(item, "y")
						}
						projected = append(projected, item)
					}
					res.Result["operations"] = projected
					return json.NewEncoder(stdout).Encode(res)
				}
				return dispatchTimed(cfg, entry.action, window, value, timeout, stdout, stderr)
			}}
		cmd.Flags().StringVar(&payload, "payload", "{}", "Explicit typed JSON payload (mil); no generated route geometry")
		cmd.Flags().StringVar(&window, "window", "", "Connector window ID")
		cmd.Flags().DurationVar(&timeout, "timeout", 60*time.Second, "Total caller budget; timeout never cancels native writes")
		pcb.AddCommand(cmd)
	}
}
