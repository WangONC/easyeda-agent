package daemon

import (
	"encoding/json"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"github.com/zhoushoujianwork/easyeda-agent/internal/fastpath"
	"github.com/zhoushoujianwork/easyeda-agent/internal/manufacture"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
	"github.com/zhoushoujianwork/easyeda-agent/internal/workflow"
	"os"
	"path/filepath"
)

func completeManufacturingV2(req executionv2.Request, h executionv2.HandlerResult) executionv2.HandlerResult {
	if req.Action != "pcb.manufacturing.export" || h.Verification.Verdict != "satisfied" || !h.Verification.Complete || !h.Effects.Settled {
		return h
	}
	digest, e := req.Digest()
	if e != nil || h.Protocol != executionv2.Version || h.OperationID != req.OperationID || h.Digest != digest || h.Target != req.Target {
		return h
	}
	var value map[string]any
	var evidence struct {
		Drills    *manufacture.DrillInventory `json:"drill_inventory,omitempty"`
		Artifacts []protocol.Artifact         `json:"artifacts"`
	}
	if json.Unmarshal(h.Value, &value) != nil || json.Unmarshal(h.Evidence, &evidence) != nil || len(evidence.Artifacts) != 3 {
		h.Verification = executionv2.Verification{Verdict: "unavailable"}
		return h
	}
	files := []map[string]any{}
	warnings := []string{"Basic structure inspection does not certify DFM or fabrication correctness; review native layer mapping against export profile."}
	complete := true
	seen := map[string]bool{}
	for _, a := range evidence.Artifacts {
		if seen[a.Kind] || !(a.Kind == "manufacturing_gerber" || a.Kind == "manufacturing_bom" || a.Kind == "manufacturing_pnp") {
			complete = false
		}
		seen[a.Kind] = true
		r, e := manufacture.Inspect(manufacture.ArtifactRef{Kind: a.Kind, Path: a.Path, FileName: a.FileName, MimeType: a.MimeType, ObservedDrills: evidence.Drills})
		if e != nil {
			complete = false
			warnings = append(warnings, a.FileName+": "+e.Error())
		}
		files = append(files, r)
	}
	status := "unverified"
	if complete {
		status = "structure_verified"
	}
	manifest := map[string]any{"status": status, "project_uuid": req.Target.ProjectUUID, "document_uuid": req.Target.DocumentUUID, "revision": value["revision"], "revision_before": value["revision_before"], "export_profile": req.Input["profile"], "relevant_verification_ids": req.Input["verification_ids"], "files": files, "warnings": warnings, "native_api_call_count": value["native_api_call_count"], "content_qualification": "NOT_CERTIFIED", "artifact_delivery": "complete"}
	id := fastpath.Hash(manifest)
	path := filepath.Join(workflow.Dir(), "export-manifests", id+".json")
	data, _ := json.MarshalIndent(manifest, "", "  ")
	if e = os.MkdirAll(filepath.Dir(path), 0700); e == nil {
		e = os.WriteFile(path, data, 0600)
	}
	if e != nil {
		complete = false
		manifest["manifest_error"] = e.Error()
	} else {
		manifest["manifest_file"] = path
		manifest["manifest_id"] = id
	}
	h.Value, _ = json.Marshal(manifest)
	if !complete {
		h.Verification = executionv2.Verification{Verdict: "unavailable"}
	} else {
		h.Verification.Checked = append(h.Verification.Checked, "actual_gerber_drill_csv_structure_inspected")
	}
	return h
}
