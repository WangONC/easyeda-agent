package app

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
)

// Public callers supply business inputs and optional discovery selectors only.
// A command pins the first exact session/activation. No retarget on reconnect.
func bindPublicV2(cfg *appConfig, window string) (*v2ReadBinding, error) {
	return bindPublicExecutor(cfg, window, false)
}

func bindPublicExecutor(cfg *appConfig, window string, daemonLocal bool) (*v2ReadBinding, error) {
	if cfg.v2Read != nil && !daemonLocal {
		if window != "" && cfg.v2Read.window != "" && cfg.v2Read.window != window {
			return nil, fmt.Errorf("V2_WINDOW_CHANGED")
		}
		if cfg.v2Read.nextProject != "" || cfg.v2Read.nextDocument != "" {
			return finishPublicNavigation(cfg)
		}
		return cfg.v2Read, nil
	}
	first, last, e := cfg.portRange()
	if e != nil {
		return nil, e
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	scan := scanHealth(ctx, hostPortOptions{host: cfg.host, portStart: first, portEnd: last})
	if scan.Found == nil {
		return nil, fmt.Errorf("V2_DAEMON_UNAVAILABLE: run easyeda daemon start")
	}
	if e = checkVersionGate(cfg, scan.Found.Raw, io.Discard); e != nil {
		return nil, e
	}
	var h struct {
		Windows []healthWindow `json:"windows"`
		Session string         `json:"v2_session"`
	}
	if e = json.Unmarshal(scan.Found.Raw, &h); e != nil {
		return nil, e
	}
	if daemonLocal {
		target := executionv2.Target{Scope: "HOME", Session: h.Session, Activation: h.Session}
		if err := target.Validate(); err != nil {
			return nil, err
		}
		return &v2ReadBinding{endpoint: fmt.Sprintf("http://%s:%d", cfg.host, scan.Found.Port), target: target}, nil
	}
	var candidates []healthWindow
	for _, w := range h.Windows {
		if window != "" && window != w.WindowID {
			continue
		}
		if cfg.project != "" && cfg.project != w.Context.ProjectUUID && cfg.project != w.Context.ProjectName {
			continue
		}
		candidates = append(candidates, w)
	}
	if len(candidates) == 0 {
		return nil, fmt.Errorf("V2_CONNECTOR_UNAVAILABLE: no connected logical window matches the selectors")
	}
	if len(candidates) != 1 {
		return nil, fmt.Errorf("V2_WINDOW_AMBIGUOUS: select one logical window using --window")
	}
	w := candidates[0]
	if w.ActivationID == "" || w.TransportID == "" {
		return nil, fmt.Errorf("V2_CONNECTOR_REQUIRED")
	}
	t := executionv2.Target{Scope: "HOME", Session: w.TransportID, Activation: w.ActivationID}
	if w.Context.ProjectUUID != "" {
		t.Scope = "PROJECT"
		t.ProjectUUID = w.Context.ProjectUUID
		if w.Context.DocumentType != "home" && w.Context.DocumentType != "blank" && w.Context.DocumentUUID != "" && w.Context.TabID != "" {
			t.Scope = "DOCUMENT"
			t.DocumentUUID = w.Context.DocumentUUID
			t.DocumentType = w.Context.DocumentType
			t.TabID = w.Context.TabID
		}
	}
	if e = t.Validate(); e != nil {
		return nil, e
	}
	b := &v2ReadBinding{window: w.WindowID, endpoint: fmt.Sprintf("http://%s:%d", cfg.host, scan.Found.Port), target: t}
	cfg.v2Read = b
	return b, nil
}

func publicActionV2(cfg *appConfig, action, window string, payload any, timeout time.Duration) ([]byte, error) {
	if cfg.forceStaleRead != "" {
		return nil, fmt.Errorf("RETIRED_ENTRYPOINT: --force-stale-read is not a V2 recovery mechanism; use operation status/reconcile")
	}
	if protocol.ActionDisabled(action) {
		return nil, fmt.Errorf("CAPABILITY_DISABLED: %s", action)
	}
	if e := dryRunGuard(action); e != nil {
		return nil, e
	}
	var spec *protocol.V2Action
	for _, a := range protocol.AllActions() {
		if a.Name == action {
			spec = a.V2
			break
		}
	}
	if spec == nil {
		return nil, fmt.Errorf("V2_ACTION_UNSUPPORTED: %s", action)
	}
	input := map[string]any{}
	if payload != nil {
		raw, e := json.Marshal(payload)
		if e != nil {
			return nil, e
		}
		if e = json.Unmarshal(raw, &input); e != nil {
			return nil, e
		}
	}
	if input == nil {
		input = map[string]any{}
	}
	if doc, ok := input["document_uuid"].(string); ok && doc != "" && cfg.doc != "" && doc != cfg.doc {
		return nil, fmt.Errorf("document_uuid conflicts with --doc")
	}
	b, e := bindPublicExecutor(cfg, window, action == "system.health")
	if e != nil {
		return nil, e
	}
	t := b.target
	if spec.Target == "PROJECT" && (action != "schematic.components.list" || t.DocumentType != "schematic") {
		t = executionv2.Target{Scope: "PROJECT", Session: t.Session, Activation: t.Activation, ProjectUUID: t.ProjectUUID}
	}
	// Explicit --doc is discovery followed by the same controlled V2 open.
	if cfg.doc != "" && cfg.doc != b.target.DocumentUUID && action != "document.open" {
		id, err := resolvePublicDocument(b, cfg.doc)
		if err != nil {
			return nil, err
		}
		if id != b.target.DocumentUUID {
			scoped := *cfg
			scoped.doc = ""
			raw, err := publicActionV2(&scoped, "document.open", window, map[string]any{"uuid": id}, timeout)
			if err != nil {
				return nil, err
			}
			if _, err = actionValueV2(raw, "document.open"); err != nil {
				return nil, err
			}
			cfg.v2Read = scoped.v2Read
			b, err = bindPublicV2(cfg, window)
			if err != nil {
				return nil, err
			}
			t = b.target
			if spec.Target == "PROJECT" && (action != "schematic.components.list" || t.DocumentType != "schematic") {
				t = executionv2.Target{Scope: "PROJECT", Session: t.Session, Activation: t.Activation, ProjectUUID: t.ProjectUUID}
			}
		}
	}
	if spec.Target == "LIBRARY" {
		lib, _ := input["libraryUuid"].(string)
		if lib == "" {
			libraries, err := b.read("library.list", nil)
			if err != nil {
				return nil, err
			}
			scope, _ := input["scope"].(string)
			if scope != "" && scope != "personal" && scope != "project" {
				return nil, fmt.Errorf("invalid library scope")
			}
			key := "personalLibraryUuid"
			if scope == "project" {
				key = "projectLibraryUuid"
			}
			lib, _ = libraries[key].(string)
		}
		if lib == "" {
			return nil, fmt.Errorf("V2_LIBRARY_IDENTITY_UNAVAILABLE")
		}
		t = executionv2.Target{Scope: "LIBRARY", Session: b.target.Session, Activation: b.target.Activation, ProjectUUID: b.target.ProjectUUID, LibraryUUID: lib}
	}
	id := make([]byte, 16)
	if _, e = rand.Read(id); e != nil {
		return nil, e
	}
	op := hex.EncodeToString(id)
	if action == "project.create" || action == "schematic.create" {
		_, project := input["expected_project_uuid"]
		_, session := input["session_token"]
		if project != session {
			return nil, fmt.Errorf("supply paired project/session guards or omit both")
		}
		if !project {
			input["expected_project_uuid"] = b.target.ProjectUUID
			input["session_token"] = b.target.Activation
		}
		if _, ok := input["client_transaction_id"]; !ok {
			input["client_transaction_id"] = op
		}
	}
	if action == "project.open" {
		if _, ok := input["expected_project_uuid"]; !ok {
			input["expected_project_uuid"] = b.target.ProjectUUID
		}
	}
	if timeout <= 0 {
		timeout = defaultActionTimeout
	}
	req := executionv2.Request{Protocol: executionv2.Version, Action: action, ActionRevision: spec.Revision, Schema: spec.SchemaID(), RequestID: op, OperationID: op, Target: t, Input: input, BudgetMS: int(timeout / time.Millisecond)}
	if e = req.Validate(); e != nil {
		return nil, e
	}
	if _, e = protocol.ValidateV2(req); e != nil {
		return nil, e
	}
	result, e := submitV2(b.endpoint, req)
	if e != nil {
		return nil, e
	}
	if result.Outcome == executionv2.Succeeded && action != "system.health" {
		next := *b
		next.receiptTarget = &t
		switch action {
		case "project.open":
			next.nextProject, _ = input["project_uuid"].(string)
		case "document.open", "schematic.page.open":
			next.nextProject = b.target.ProjectUUID
			next.nextDocument, _ = input["uuid"].(string)
			if next.nextDocument == "" {
				next.nextDocument, _ = input["schematicPageUuid"].(string)
			}
		}
		cfg.v2Read = &next
	}
	return json.Marshal(result)
}

// Only the daemon decides Outcome. Transport/admission failures stay errors,
// not invented UNKNOWN receipts or instructions to query nonexistent operations.
func submitV2(endpoint string, req executionv2.Request) (executionv2.Result, error) {
	var result executionv2.Result
	raw, e := json.Marshal(req)
	if e != nil {
		return result, e
	}
	response, e := (&http.Client{Timeout: time.Duration(req.BudgetMS+10000) * time.Millisecond}).Post(endpoint+"/v2/operations", "application/json", bytes.NewReader(raw))
	if e != nil {
		return result, fmt.Errorf("V2_TRANSPORT_ERROR operation=%s: %w; query status, do not replay", req.OperationID, e)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
		return result, fmt.Errorf("V2_REQUEST_REJECTED HTTP %d: %s", response.StatusCode, strings.TrimSpace(string(body)))
	}
	if e = json.NewDecoder(io.LimitReader(response.Body, 32<<20)).Decode(&result); e != nil {
		return result, e
	}
	if result.Protocol != executionv2.Version || result.OperationID != req.OperationID || result.EvidenceRef != req.OperationID {
		return result, fmt.Errorf("V2_FOREIGN_RESULT")
	}
	switch result.Outcome {
	case executionv2.Succeeded, executionv2.NotApplied, executionv2.Partial, executionv2.Unknown:
	default:
		return result, fmt.Errorf("V2_MALFORMED_RESULT")
	}
	if result.Effects.Scope == "" {
		return result, fmt.Errorf("V2_MALFORMED_RESULT")
	}
	return result, nil
}

// Only an explicitly completed navigation can request a new document binding.
// Reconnect/session drift is never adopted by an ordinary action sequence.
func finishPublicNavigation(cfg *appConfig) (*v2ReadBinding, error) {
	old := cfg.v2Read
	res, err := (&http.Client{Timeout: 5 * time.Second}).Get(old.endpoint + "/health")
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return nil, fmt.Errorf("V2_HEALTH_UNAVAILABLE")
	}
	var health struct {
		Windows []healthWindow `json:"windows"`
	}
	if err = json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(&health); err != nil {
		return nil, err
	}
	var matches []healthWindow
	for _, w := range health.Windows {
		if w.WindowID == old.window && w.TransportID == old.target.Session && w.ActivationID == old.target.Activation && w.Context.ProjectUUID == old.nextProject && (old.nextDocument == "" || w.Context.DocumentUUID == old.nextDocument) {
			matches = append(matches, w)
		}
	}
	if len(matches) != 1 {
		return nil, fmt.Errorf("V2_NAVIGATION_REBIND_REQUIRED: exact target/session unavailable; do not replay navigation")
	}
	w := matches[0]
	t := executionv2.Target{Scope: "PROJECT", Session: w.TransportID, Activation: w.ActivationID, ProjectUUID: w.Context.ProjectUUID}
	if w.Context.DocumentUUID != "" && w.Context.TabID != "" && w.Context.DocumentType != "home" && w.Context.DocumentType != "blank" {
		t.Scope = "DOCUMENT"
		t.DocumentUUID = w.Context.DocumentUUID
		t.DocumentType = w.Context.DocumentType
		t.TabID = w.Context.TabID
	}
	if err = t.Validate(); err != nil {
		return nil, err
	}
	fresh := &v2ReadBinding{window: old.window, endpoint: old.endpoint, target: t}
	// This read is target guarded by the Connector, unlike the registration snapshot.
	if _, err = fresh.read("document.current", nil); err != nil {
		return nil, err
	}
	cfg.v2Read = fresh
	return fresh, nil
}
func resolvePublicDocument(b *v2ReadBinding, selector string) (string, error) {
	ids := map[string]bool{}
	for _, q := range []struct{ action, key string }{{"schematic.pages.list", "pages"}, {"pcb.documents.list", "pcbs"}} {
		value, err := b.read(q.action, nil)
		if err != nil {
			return "", err
		}
		rows, ok := value[q.key].([]any)
		if !ok {
			return "", fmt.Errorf("V2_DOCUMENT_INVENTORY_INVALID")
		}
		for _, row := range rows {
			m, ok := row.(map[string]any)
			if !ok {
				return "", fmt.Errorf("V2_DOCUMENT_INVENTORY_INVALID")
			}
			id, _ := m["uuid"].(string)
			if id != "" && (id == selector || m["name"] == selector) {
				ids[id] = true
			}
		}
	}
	if len(ids) != 1 {
		return "", fmt.Errorf("V2_DOCUMENT_NOT_UNIQUE: use a document UUID")
	}
	for id := range ids {
		return id, nil
	}
	panic("unreachable")
}
