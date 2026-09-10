package daemon

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
	"os"
	"path/filepath"
)

// Artifact transport is independent of legacy Response and of design qualification.
// Receipt evidence stores the bytes once; public value contains delivery paths.
func (s *Server) completeArtifactV2(req executionv2.Request, h executionv2.HandlerResult) executionv2.HandlerResult {
	switch req.Action {
	case "schematic.export.netlist", "schematic.export.bom", "schematic.export.image", "pcb.export.dsn", "pcb.snapshot", "pcb.manufacturing.export":
	default:
		return h
	}
	digest, err := req.Digest()
	if err != nil || h.Protocol != executionv2.Version || h.OperationID != req.OperationID || h.Digest != digest || h.Target != req.Target || !h.Effects.Settled || h.Verification.Verdict != "satisfied" || !h.Verification.Complete {
		return h
	}
	var evidence struct {
		Version   string              `json:"artifact_delivery"`
		Artifacts []protocol.Artifact `json:"artifacts"`
	}
	fail := func(e error) executionv2.HandlerResult {
		h.Verification = executionv2.Verification{Verdict: "unavailable"}
		h.Value, _ = json.Marshal(map[string]any{"delivery_error": e.Error()})
		return h
	}
	if err = json.Unmarshal(h.Evidence, &evidence); err != nil || evidence.Version != "v2" || len(evidence.Artifacts) != map[bool]int{true: 3, false: 1}[req.Action == "pcb.manufacturing.export"] {
		return fail(errors.New("V2_ARTIFACT_EVIDENCE_INVALID"))
	}
	var value map[string]any
	if err = json.Unmarshal(h.Value, &value); err != nil || value["artifactId"] != evidence.Artifacts[0].ID {
		return fail(errors.New("V2_ARTIFACT_ID_MISMATCH"))
	}
	ids := map[string]bool{}
	paths := []string{}
	for i := range evidence.Artifacts {
		a := &evidence.Artifacts[i]
		if ids[a.ID] {
			return fail(errors.New("V2_DUPLICATE_ARTIFACT"))
		}
		ids[a.ID] = true
		if err = s.persistArtifactV2(req, a); err != nil {
			return fail(err)
		}
		paths = append(paths, a.Path)
	}
	value["artifactPath"] = paths[0]
	if len(paths) > 1 {
		value["artifactPaths"] = paths
	}
	value["artifacts"] = evidence.Artifacts
	h.Value, _ = json.Marshal(value)
	h.Evidence, _ = json.Marshal(evidence)
	h.Verification.Checked = append(h.Verification.Checked, "artifact_bytes_persisted")
	return completeManufacturingV2(req, h)
}

func (s *Server) persistArtifactV2(req executionv2.Request, a *protocol.Artifact) error {
	data, e := base64.StdEncoding.DecodeString(a.InlineBase64)
	if e != nil || len(data) == 0 || a.ID == "" || a.FileName == "" {
		return errors.New("V2_ARTIFACT_BYTES_INVALID")
	}
	sum := sha256.Sum256(data)
	identity := sha256.Sum256([]byte(req.OperationID + ":" + a.ID))
	dir := s.artifactDir("")
	if e = os.MkdirAll(dir, 0755); e != nil {
		return e
	}
	ext := filepath.Ext(filepath.Base(a.FileName))
	if len(ext) > 12 {
		ext = ".bin"
	}
	path, e := filepath.Abs(filepath.Join(dir, fmt.Sprintf("v2-%x%s", identity[:16], ext)))
	if e != nil {
		return e
	}
	file, e := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0644)
	if e == nil {
		_, e = file.Write(data)
		closeErr := file.Close()
		if e == nil {
			e = closeErr
		}
	} else if os.IsExist(e) {
		var stored []byte
		stored, e = os.ReadFile(path)
		if e == nil && !bytes.Equal(stored, data) {
			e = errors.New("V2_ARTIFACT_ID_CONFLICT")
		}
	}
	if e != nil {
		return e
	}
	a.Path = path
	a.Size = int64(len(data))
	a.SHA256 = hex.EncodeToString(sum[:])
	a.InlineBase64 = ""
	return nil
}
