package app

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"github.com/spf13/cobra"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
	"io"
	"net/http"
	"os"
	"reflect"
	"sort"
	"strings"
	"time"
)

// Fixed checkpoint orchestration. Every Host effect uses an ordinary V2 operation.
// This compares persistence evidence; it never reinterprets an operation Outcome.
func newV2CheckpointCmd(base *string, out io.Writer) *cobra.Command {
	return &cobra.Command{Use: "checkpoint TARGET_JSON_OR_@FILE", Short: "Save/reload, exact session rebind and semantic persistence check", Args: cobra.ExactArgs(1), RunE: func(cmd *cobra.Command, args []string) error {
		raw := []byte(args[0])
		if strings.HasPrefix(args[0], "@") {
			var e error
			raw, e = os.ReadFile(args[0][1:])
			if e != nil {
				return e
			}
		}
		var target executionv2.Target
		d := json.NewDecoder(bytes.NewReader(raw))
		d.DisallowUnknownFields()
		if e := d.Decode(&target); e != nil {
			return e
		}
		if e := target.Validate(); e != nil {
			return e
		}
		if target.Scope != "DOCUMENT" || (target.DocumentType != "pcb" && target.DocumentType != "schematic") {
			return fmt.Errorf("V2_CHECKPOINT_DOCUMENT_REQUIRED")
		}
		if _, e := checkpointCall(*base, target, target.DocumentType+".save", map[string]any{}); e != nil {
			return e
		}
		action, input := "board.snapshot_compact", map[string]any{}
		if target.DocumentType == "schematic" {
			action = "schematic.read"
			input["includeCheck"] = false
		}
		before, e := (&v2ReadBinding{endpoint: *base, target: target}).read(action, input)
		if e != nil {
			return e
		}
		baseline, e := checkpointSemantic(target.DocumentType, before)
		if e != nil {
			return e
		}
		receipt, e := checkpointCall(*base, target, "document.open", map[string]any{"uuid": target.DocumentUUID, "reload": true})
		if e != nil {
			return e
		}
		// A compact receipt is emitted before any wait, allowing status/recovery after interruption.
		if e = json.NewEncoder(out).Encode(map[string]any{"reload_operation": receipt}); e != nil {
			return e
		}
		var next executionv2.Target
		until := time.Now().Add(30 * time.Second)
		for time.Now().Before(until) {
			next, e = checkpointBinding(*base, target)
			if e != nil {
				return e
			}
			if next.Session != "" {
				break
			}
			select {
			case <-cmd.Context().Done():
				return cmd.Context().Err()
			case <-time.After(250 * time.Millisecond):
			}
		}
		if next.Session == "" {
			return fmt.Errorf("V2_CHECKPOINT_NEW_SESSION_REQUIRED: use operation status/reconcile; never repeat reload")
		}
		if _, e = checkpointCall(*base, target, "document.current", map[string]any{}); e == nil || (!strings.Contains(e.Error(), "V2_SESSION_LOST") && !strings.Contains(e.Error(), "V2_ACTIVATION_MISMATCH")) {
			return fmt.Errorf("V2_CHECKPOINT_OLD_SESSION_NOT_REJECTED")
		}
		body, _ := json.Marshal(next)
		res, e := (&http.Client{Timeout: 10 * time.Second}).Post(*base+"/v2/bind", "application/json", bytes.NewReader(body))
		if e != nil {
			return e
		}
		defer res.Body.Close()
		if res.StatusCode != 200 {
			return fmt.Errorf("V2_CHECKPOINT_REBIND_REJECTED")
		}
		after, e := (&v2ReadBinding{endpoint: *base, target: next}).read(action, input)
		if e != nil {
			return e
		}
		fresh, e := checkpointSemantic(target.DocumentType, after)
		if e != nil {
			return e
		}
		normalized, identityMaterialization, equal := checkpointEquivalent(target.DocumentType, baseline, fresh)
		if !equal {
			return fmt.Errorf("V2_CHECKPOINT_SEMANTIC_MISMATCH: reload operation %s; inspect fresh evidence before resume", receipt.OperationID)
		}
		encoded, _ := json.Marshal(normalized)
		hash := sha256.Sum256(encoded)
		fields := []string{}
		for k := range baseline {
			fields = append(fields, k)
		}
		sort.Strings(fields)
		return json.NewEncoder(out).Encode(map[string]any{"checkpoint_proven": true, "old_target": target, "target_ref": next, "reload_operation_id": receipt.OperationID, "semantic_fields": fields, "semantic_sha256": hex.EncodeToString(hash[:]), "resume_ready": true, "identity_materialization": identityMaterialization})
	}}
}
func checkpointCall(base string, target executionv2.Target, action string, input map[string]any) (executionv2.Result, error) {
	var result executionv2.Result
	var spec *protocol.V2Action
	for _, a := range protocol.AllActions() {
		if a.Name == action {
			spec = a.V2
			break
		}
	}
	if spec == nil {
		return result, fmt.Errorf("V2_ACTION_UNSUPPORTED")
	}
	seed := make([]byte, 16)
	if _, e := rand.Read(seed); e != nil {
		return result, e
	}
	id := hex.EncodeToString(seed)
	request := executionv2.Request{Protocol: executionv2.Version, Action: action, ActionRevision: spec.Revision, Schema: spec.SchemaID(), RequestID: id, OperationID: id, Target: target, Input: input, BudgetMS: 30000}
	if _, e := protocol.ValidateV2(request); e != nil {
		return result, e
	}
	body, _ := json.Marshal(request)
	r, e := (&http.Client{Timeout: 40 * time.Second}).Post(base+"/v2/operations", "application/json", bytes.NewReader(body))
	if e != nil {
		return result, e
	}
	defer r.Body.Close()
	if r.StatusCode != 200 {
		msg, _ := io.ReadAll(io.LimitReader(r.Body, 4096))
		return result, fmt.Errorf("V2_CHECKPOINT_REQUEST: %s", msg)
	}
	if e = json.NewDecoder(io.LimitReader(r.Body, 16<<20)).Decode(&result); e != nil {
		return result, e
	}
	if result.Protocol != executionv2.Version || result.OperationID != id || result.EvidenceRef != id || result.Effects.Scope != spec.EffectScope {
		return result, fmt.Errorf("V2_FOREIGN_RESULT")
	}
	if result.Outcome != executionv2.Succeeded {
		return result, fmt.Errorf("V2_CHECKPOINT_STOP:%s:%s; no replay", id, result.Outcome)
	}
	return result, nil
}
func checkpointBinding(base string, old executionv2.Target) (executionv2.Target, error) {
	var empty executionv2.Target
	r, e := (&http.Client{Timeout: 5 * time.Second}).Get(base + "/health")
	if e != nil {
		return empty, e
	}
	defer r.Body.Close()
	var h struct {
		Windows []struct {
			Session    string `json:"windowId"`
			Activation string `json:"activationId"`
			Context    struct {
				Project  string `json:"projectUuid"`
				Document string `json:"documentUuid"`
				Type     string `json:"documentType"`
				Tab      string `json:"tabId"`
			} `json:"context"`
		} `json:"windows"`
	}
	if r.StatusCode != 200 {
		return empty, fmt.Errorf("V2_HEALTH_UNAVAILABLE")
	}
	if e = json.NewDecoder(r.Body).Decode(&h); e != nil {
		return empty, e
	}
	var matches []executionv2.Target
	for _, w := range h.Windows {
		if w.Context.Project == old.ProjectUUID && w.Context.Document == old.DocumentUUID && w.Context.Type == old.DocumentType && w.Session != old.Session && w.Activation != "" && w.Context.Tab != "" {
			matches = append(matches, executionv2.Target{Scope: "DOCUMENT", Session: w.Session, Activation: w.Activation, ProjectUUID: w.Context.Project, DocumentUUID: w.Context.Document, DocumentType: w.Context.Type, TabID: w.Context.Tab})
		}
	}
	if len(matches) > 1 {
		return empty, fmt.Errorf("V2_CHECKPOINT_AMBIGUOUS_TARGET")
	}
	if len(matches) == 1 {
		return matches[0], nil
	}
	return empty, nil
}
func checkpointSemantic(kind string, value map[string]any) (map[string]any, error) {
	keys := []string{"components", "pads", "traces", "vias", "fills", "copper_layers", "rule_profile"}
	if kind == "schematic" {
		keys = []string{"components", "nets"}
	}
	out := map[string]any{}
	for _, key := range keys {
		v, ok := value[key]
		if !ok || v == nil {
			return nil, fmt.Errorf("V2_CHECKPOINT_MISSING_SEMANTIC_FIELD:%s", key)
		}
		out[key] = v
	}
	return out, nil
}

// A Host may materialize a previously explicit empty uniqueId at persistence.
// This is directional evidence alignment, never removal of existing identity.
// All other fields, ordering and collections remain byte-for-value equivalent.
func checkpointEquivalent(kind string, before, after map[string]any) (map[string]any, []map[string]string, bool) {
	changes := []map[string]string{}
	if reflect.DeepEqual(before, after) {
		return after, changes, true
	}
	if kind != "schematic" {
		return before, changes, false
	}
	raw, err := json.Marshal(before)
	if err != nil {
		return before, changes, false
	}
	var aligned map[string]any
	if json.Unmarshal(raw, &aligned) != nil {
		return before, changes, false
	}
	old, ok := aligned["components"].([]any)
	if !ok {
		return before, changes, false
	}
	next, ok := after["components"].([]any)
	if !ok || len(old) != len(next) {
		return before, changes, false
	}
	ids := map[string]bool{}
	primitives := map[string]bool{}
	for _, item := range next {
		c, ok := item.(map[string]any)
		if !ok {
			return before, changes, false
		}
		id, ok := c["primitiveId"].(string)
		if !ok || id == "" || primitives[id] {
			return before, changes, false
		}
		primitives[id] = true
		if uid, ok := c["uniqueId"].(string); ok && uid != "" {
			if ids[uid] {
				return before, changes, false
			}
			ids[uid] = true
		}
	}
	for i, item := range old {
		c, ok := item.(map[string]any)
		if !ok {
			return before, changes, false
		}
		n := next[i].(map[string]any)
		uid, explicit := c["uniqueId"].(string)
		assigned, valid := n["uniqueId"].(string)
		if explicit && uid == "" && valid && assigned != "" && c["componentType"] == "part" && c["primitiveId"] == n["primitiveId"] {
			c["uniqueId"] = assigned
			changes = append(changes, map[string]string{"primitive_id": c["primitiveId"].(string), "before": "", "after": assigned})
		}
	}
	if !reflect.DeepEqual(aligned, after) {
		return before, []map[string]string{}, false
	}
	return aligned, changes, true
}
