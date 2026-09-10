package app

import (
	"encoding/json"
	"fmt"
	"github.com/spf13/cobra"
	"github.com/zhoushoujianwork/easyeda-agent/internal/fastpath"
	"github.com/zhoushoujianwork/easyeda-agent/internal/manufacture"
	"github.com/zhoushoujianwork/easyeda-agent/internal/workflow"
	"io"
	"os"
	"path/filepath"
	"time"
)

func nativeDrillHits(s string) ([]string, error) { return manufacture.NativeDrillHits(s) }
func inspectManufacturingFile(a artifactRef) (map[string]any, error) {
	return manufacture.Inspect(manufacture.ArtifactRef{Kind: a.Kind, Path: a.Path, FileName: a.FileName, MimeType: a.MimeType})
}
func addManufacturingExport(pcb *cobra.Command, cfg *appConfig, stdout, stderr io.Writer) {
	var payload, window string
	c := &cobra.Command{Use: "manufacturing-export", Short: "Native manufacturing files with SHA256 and basic structure manifest", Args: cobra.NoArgs, RunE: func(_ *cobra.Command, _ []string) error {
		var p map[string]any
		if e := json.Unmarshal([]byte(payload), &p); e != nil {
			return e
		}
		doc, _ := p["document_uuid"].(string)
		project, _ := p["project_uuid"].(string)
		if doc == "" || project == "" {
			return fmt.Errorf("explicit project_uuid/document_uuid required")
		}
		pinned := *cfg
		pinned.doc = doc
		pinned.project = project
		cfg = &pinned
		scope := map[string]any{"project_uuid": project, "document_uuid": doc, "include": map[string]bool{"components": false, "pads": false, "traces": false, "vias": false, "fills": false}}
		before, e := requestAction(cfg, "board.snapshot_compact", window, scope)
		if e != nil {
			return e
		}
		native, e := requestActionTimed(cfg, "pcb.manufacturing.export", window, p, 120*time.Second)
		if e != nil {
			return e
		}
		after, e := requestAction(cfg, "board.snapshot_compact", window, scope)
		if e != nil {
			return e
		}
		complete := native.Result["status"] == "unverified" && len(native.Artifacts) == 3 && sameObservedContent(before, after)
		files := []map[string]any{}
		warnings := []string{"Basic structure validation does not certify DFM or fabrication correctness. Review native layer mapping against export profile."}
		for _, a := range native.Artifacts {
			r, e := inspectManufacturingFile(a)
			if e != nil {
				complete = false
				warnings = append(warnings, a.FileName+": "+e.Error())
			}
			files = append(files, r)
		}
		status := "partial"
		if complete {
			status = "structure_verified"
		}
		manifest := map[string]any{"status": status, "project_uuid": project, "document_uuid": doc, "revision": after.Result["board_revision"], "revision_before": before.Result["board_revision"], "export_profile": p["profile"], "relevant_verification_ids": p["verification_ids"], "files": files, "warnings": warnings, "native_api_call_count": native.Result["native_api_call_count"], "native_duration_ms": native.Result["duration_ms"]}
		id := fastpath.Hash(manifest)
		path := filepath.Join(workflow.Dir(), "export-manifests", id+".json")
		if e = os.MkdirAll(filepath.Dir(path), 0700); e != nil {
			return e
		}
		b, e := json.MarshalIndent(manifest, "", "  ")
		if e != nil {
			return e
		}
		if e = os.WriteFile(path, b, 0600); e != nil {
			return e
		}
		manifest["manifest_file"] = path
		manifest["manifest_id"] = id
		if e = json.NewEncoder(stdout).Encode(map[string]any{"ok": complete, "result": manifest}); e != nil {
			return e
		}
		if !complete {
			return errActionFailed
		}
		return nil
	}}
	c.Flags().StringVar(&payload, "payload", "{}", "Explicit identity and reviewed export profile")
	c.Flags().StringVar(&window, "window", "", "Connector window ID")
	pcb.AddCommand(c)
}
