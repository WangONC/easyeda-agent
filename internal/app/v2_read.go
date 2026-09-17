package app

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
	"io"
	"net/http"
	"strings"
	"time"
)

type v2ReadBinding struct {
	receiptTarget *executionv2.Target
	window        string
	nextProject   string
	nextDocument  string
	nextDocType   string
	nextReload    bool
	endpoint      string
	target        executionv2.Target
}

// Workflow consumers read V2 values directly. No legacy envelope, native write,
// implicit navigation or replay is available through this read-only boundary.
func readStageV2(cfg *appConfig, action, window string, input map[string]any) (map[string]any, error) {
	if cfg.v2Read == nil {
		first, last, err := cfg.portRange()
		if err != nil {
			return nil, err
		}
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		scan := scanHealth(ctx, hostPortOptions{host: cfg.host, portStart: first, portEnd: last})
		if scan.Found == nil {
			return nil, fmt.Errorf("V2_DAEMON_UNAVAILABLE")
		}
		var health struct {
			Windows []struct {
				TransportID string        `json:"transportId"`
				WindowID    string        `json:"windowId"`
				Activation  string        `json:"activationId"`
				Context     actionContext `json:"context"`
			} `json:"windows"`
		}
		if err = json.Unmarshal(scan.Found.Raw, &health); err != nil {
			return nil, err
		}
		matches := []v2ReadBinding{}
		for _, w := range health.Windows {
			if window != "" && window != w.WindowID {
				continue
			}
			if cfg.project != "" && cfg.project != w.Context.ProjectUUID && cfg.project != w.Context.ProjectName {
				continue
			}
			if w.Activation == "" || w.TransportID == "" || w.Context.ProjectUUID == "" || w.Context.DocumentUUID == "" || w.Context.TabID == "" {
				continue
			}
			t := executionv2.Target{Scope: "DOCUMENT", Session: w.TransportID, Activation: w.Activation, ProjectUUID: w.Context.ProjectUUID, DocumentUUID: w.Context.DocumentUUID, DocumentType: w.Context.DocumentType, TabID: w.Context.TabID}
			if err = t.Validate(); err != nil {
				continue
			}
			matches = append(matches, v2ReadBinding{endpoint: fmt.Sprintf("http://%s:%d", cfg.host, scan.Found.Port), target: t})
		}
		if len(matches) != 1 {
			return nil, fmt.Errorf("V2_WORKFLOW_TARGET_AMBIGUOUS: select exact project/window with one active document")
		}
		binding := matches[0]
		if cfg.doc != "" && cfg.doc != binding.target.DocumentUUID {
			listAction, listKey := "pcb.documents.list", "pcbs"
			if binding.target.DocumentType == "schematic" {
				listAction, listKey = "schematic.pages.list", "pages"
			}
			list, err := binding.read(listAction, nil)
			if err != nil {
				return nil, err
			}
			rows, ok := list[listKey].([]any)
			if !ok {
				return nil, fmt.Errorf("V2_DOCUMENT_INVENTORY_INVALID")
			}
			ids := []string{}
			for _, r := range rows {
				m, ok := r.(map[string]any)
				if ok && m["name"] == cfg.doc {
					if id, ok := m["uuid"].(string); ok {
						ids = append(ids, id)
					}
				}
			}
			if len(ids) != 1 || ids[0] != binding.target.DocumentUUID {
				return nil, fmt.Errorf("V2_TARGET_MISMATCH: open the requested document through V2 before confirmation")
			}
		}
		cfg.v2Read = &binding
	}
	return cfg.v2Read.read(action, input)
}
func (b *v2ReadBinding) read(action string, input map[string]any) (map[string]any, error) {
	var spec *protocol.V2Action
	for _, a := range protocol.AllActions() {
		if a.Name == action {
			spec = a.V2
			break
		}
	}
	if spec == nil || spec.EffectScope != "NONE" {
		return nil, fmt.Errorf("V2_WORKFLOW_READ_ONLY:%s", action)
	}
	if input == nil {
		input = map[string]any{}
	}
	id := make([]byte, 16)
	if _, err := rand.Read(id); err != nil {
		return nil, err
	}
	op := hex.EncodeToString(id)
	target := b.target
	if spec.Target == "PROJECT" {
		target = executionv2.Target{Scope: "PROJECT", Session: b.target.Session, Activation: b.target.Activation, ProjectUUID: b.target.ProjectUUID}
	}
	req := executionv2.Request{Protocol: executionv2.Version, Action: action, ActionRevision: spec.Revision, Schema: spec.SchemaID(), RequestID: op, OperationID: op, Target: target, Input: input, BudgetMS: 20000}
	if _, err := protocol.ValidateV2(req); err != nil {
		return nil, err
	}
	payload, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}
	response, err := (&http.Client{Timeout: 30 * time.Second}).Post(b.endpoint+"/v2/operations", "application/json", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
		return nil, fmt.Errorf("V2_WORKFLOW_READ: %s", strings.TrimSpace(string(raw)))
	}
	var result executionv2.Result
	if err = json.NewDecoder(io.LimitReader(response.Body, 16<<20)).Decode(&result); err != nil {
		return nil, err
	}
	if result.Protocol != executionv2.Version || result.OperationID != op || result.EvidenceRef != op || result.Effects.Scope != "NONE" {
		return nil, fmt.Errorf("V2_FOREIGN_RESULT")
	}
	if result.Outcome != executionv2.Succeeded {
		return nil, fmt.Errorf("V2_WORKFLOW_READ:%s:%s", result.Outcome, result.Code)
	}
	var value map[string]any
	if err = json.Unmarshal(result.Value, &value); err != nil || value == nil {
		return nil, fmt.Errorf("V2_WORKFLOW_VALUE_INVALID")
	}
	return value, nil
}
