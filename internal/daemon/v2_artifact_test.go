package daemon

import (
	"encoding/base64"
	"encoding/json"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
	"os"
	"testing"
)

func artifactFixture() (executionv2.Request, executionv2.HandlerResult) {
	r := executionv2.Request{Protocol: executionv2.Version, Action: "schematic.export.netlist", ActionRevision: "1", Schema: "schema", RequestID: "r", OperationID: "op", Target: executionv2.Target{Scope: "DOCUMENT", Session: "s", Activation: "a", ProjectUUID: "p", DocumentUUID: "d", DocumentType: "schematic", TabID: "t"}, Input: map[string]any{}, BudgetMS: 1000}
	d, _ := r.Digest()
	evidence, _ := json.Marshal(map[string]any{"artifact_delivery": "v2", "artifacts": []protocol.Artifact{{ID: "file", FileName: "netlist.json", Kind: "netlist", InlineBase64: base64.StdEncoding.EncodeToString([]byte(`{"components":{}}`)), Path: "untrusted-host-path"}}})
	h := executionv2.HandlerResult{Protocol: executionv2.Version, OperationID: r.OperationID, Digest: d, Target: r.Target, Effects: executionv2.Effects{Scope: "UI_NATIVE", Started: executionv2.Bool(true), Changed: executionv2.Bool(false), Settled: true}, Verification: executionv2.Verification{Verdict: "satisfied", Complete: true, Required: 1, Satisfied: 1, Checked: []string{"native_file"}}, Value: json.RawMessage(`{"artifactId":"file"}`), Evidence: evidence}
	return r, h
}
func TestV2ArtifactDeliveryAndDuplicate(t *testing.T) {
	r, h := artifactFixture()
	dir := t.TempDir()
	s := &Server{opts: Options{ArtifactDir: dir}}
	a := s.completeArtifactV2(r, h)
	if a.Verification.Verdict != "satisfied" {
		t.Fatalf("%+v", a)
	}
	var evidence struct {
		Artifacts []protocol.Artifact `json:"artifacts"`
	}
	if e := json.Unmarshal(a.Evidence, &evidence); e != nil {
		t.Fatal(e)
	}
	f := evidence.Artifacts[0]
	if f.InlineBase64 != "" || f.Path == "untrusted-host-path" || f.SHA256 == "" || f.Size == 0 {
		t.Fatal(f)
	}
	if _, e := os.ReadFile(f.Path); e != nil {
		t.Fatal(e)
	}
	b := s.completeArtifactV2(r, h)
	if string(a.Value) != string(b.Value) {
		t.Fatal("duplicate changed artifact")
	}
	files, _ := os.ReadDir(dir)
	if len(files) != 1 {
		t.Fatal(files)
	}
	var changed struct {
		Version   string              `json:"artifact_delivery"`
		Artifacts []protocol.Artifact `json:"artifacts"`
	}
	_ = json.Unmarshal(h.Evidence, &changed)
	changed.Artifacts[0].InlineBase64 = base64.StdEncoding.EncodeToString([]byte("different"))
	h.Evidence, _ = json.Marshal(changed)
	if s.completeArtifactV2(r, h).Verification.Verdict != "unavailable" {
		t.Fatal("conflicting delivery accepted")
	}
}
func TestV2ArtifactForeignAndPendingHaveNoFilesystemEffect(t *testing.T) {
	for _, mode := range []string{"foreign_digest", "foreign_target", "pending", "malformed"} {
		t.Run(mode, func(t *testing.T) {
			r, h := artifactFixture()
			dir := t.TempDir()
			s := &Server{opts: Options{ArtifactDir: dir}}
			switch mode {
			case "foreign_digest":
				h.Digest = "foreign"
			case "foreign_target":
				h.Target.DocumentUUID = "other"
			case "pending":
				h.Effects.Settled = false
			case "malformed":
				h.Evidence = json.RawMessage(`{}`)
			}
			out := s.completeArtifactV2(r, h)
			files, _ := os.ReadDir(dir)
			if len(files) != 0 {
				t.Fatal(files)
			}
			if mode == "malformed" && out.Verification.Verdict != "unavailable" {
				t.Fatal(out)
			}
		})
	}
}

func TestV2ManufacturingDeliveryIsNotContentProof(t *testing.T) {
	t.Setenv("EASYEDA_WORKFLOW_DIR", t.TempDir())
	r, h := artifactFixture()
	r.Action = "pcb.manufacturing.export"
	h.Digest, _ = r.Digest()
	files := []protocol.Artifact{}
	for _, kind := range []string{"manufacturing_gerber", "manufacturing_bom", "manufacturing_pnp"} {
		files = append(files, protocol.Artifact{ID: kind, Kind: kind, FileName: kind + ".bin", InlineBase64: base64.StdEncoding.EncodeToString([]byte("not a manufacturing file"))})
	}
	h.Value = json.RawMessage(`{"artifactId":"manufacturing_gerber"}`)
	h.Evidence, _ = json.Marshal(map[string]any{"artifact_delivery": "v2", "artifacts": files})
	s := &Server{opts: Options{ArtifactDir: t.TempDir()}}
	out := s.completeArtifactV2(r, h)
	if out.Verification.Verdict != "unavailable" {
		t.Fatal("file presence certified manufacturing content")
	}
	var value map[string]any
	_ = json.Unmarshal(out.Value, &value)
	if value["content_qualification"] != "NOT_CERTIFIED" {
		t.Fatal(value)
	}
}
