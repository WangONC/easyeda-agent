package app

import (
	"encoding/json"
	"fmt"
	"github.com/spf13/cobra"
	"io"
	"time"
)

// RETIRED: historical CLI interpretation, never registered.
func archivedAddPlaneRefresh(pcb *cobra.Command, cfg *appConfig, stdout, stderr io.Writer) {
	var payload, window string
	c := &cobra.Command{Use: "plane-refresh", Short: "Refresh explicit logical planes and return authoritative revision evidence", Args: cobra.NoArgs, RunE: func(_ *cobra.Command, _ []string) error {
		var p map[string]any
		if e := json.Unmarshal([]byte(payload), &p); e != nil {
			return e
		}
		doc, _ := p["document_uuid"].(string)
		project, _ := p["project_uuid"].(string)
		base, _ := p["base_revision"].(string)
		if doc == "" || project == "" || base == "" {
			return fmt.Errorf("exact project_uuid/document_uuid and base_revision required")
		}
		scope := map[string]any{"project_uuid": project, "document_uuid": doc, "include": map[string]bool{"components": false, "pads": false, "traces": false, "vias": false, "fills": false}}
		before, e := requestAction(cfg, "board.snapshot_compact", window, scope)
		if e != nil {
			return e
		}
		if before.Result["board_revision"] != base {
			return fmt.Errorf("STALE_REVISION: no plane rebuild started")
		}
		mutation, e := requestActionTimed(cfg, "pcb.pour.rebuild", window, p, 60*time.Second)
		if e != nil {
			return fmt.Errorf("plane refresh outcome uncertain; do not replay: %w", e)
		}
		result := mutation.Result
		result["revision_before"] = base
		after, e := requestAction(cfg, "board.snapshot_compact", window, scope)
		if e != nil {
			result["status"] = "uncertain"
			result["freshness"] = "unverified"
			result["readback_error"] = e.Error()
		} else {
			result["revision_after"] = after.Result["board_revision"]
			result["revision"] = after.Result["board_revision"]
			result["freshness"] = "observed"
			if after.Result["board_revision"] == base {
				result["status"] = "uncertain"
				result["readback_error"] = "mutation did not change observable revision"
			}
		}
		result["connectivity"] = "unknown"
		if err := json.NewEncoder(stdout).Encode(map[string]any{"ok": result["status"] == "complete", "result": result}); err != nil {
			return err
		}
		if result["status"] != "complete" {
			return errActionFailed
		}
		return nil
	}}
	c.Flags().StringVar(&payload, "payload", "{}", "Explicit identity, base revision and logical_ids")
	c.Flags().StringVar(&window, "window", "", "Connector window ID")
	pcb.AddCommand(c)
}

// The production native action owns revision verification and finalization.
func addPlaneRefresh(pcb *cobra.Command, cfg *appConfig, stdout, stderr io.Writer) {
	var payload, window string
	c := &cobra.Command{Use: "plane-refresh", Short: "Refresh logical planes through the V2 native action", Args: cobra.NoArgs, RunE: func(*cobra.Command, []string) error {
		var input map[string]any
		if err := json.Unmarshal([]byte(payload), &input); err != nil {
			return err
		}
		return dispatchTimed(cfg, "pcb.plane.refresh", window, input, 60*time.Second, stdout, stderr)
	}}
	c.Flags().StringVar(&payload, "payload", "{}", "Base revision and optional logical_ids")
	c.Flags().StringVar(&window, "window", "", "Logical Host window")
	pcb.AddCommand(c)
}
