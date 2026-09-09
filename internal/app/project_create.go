package app

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
)

// Name-only Personal creation acquires the existing guards in Go, never in MCP.
// Explicit destinations and fully guarded requests retain their exact semantics.
func prepareProjectCreate(cfg *appConfig, window string, payload any) (map[string]any, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	var p map[string]any
	if err = json.Unmarshal(data, &p); err != nil {
		return nil, err
	}
	if p == nil {
		return nil, fmt.Errorf("project name required")
	}
	name, _ := p["name"].(string)
	if name == "" {
		return nil, fmt.Errorf("project name required")
	}
	_, hasProject := p["expected_project_uuid"]
	_, hasSession := p["session_token"]
	if hasProject || hasSession {
		if !hasProject || !hasSession {
			return nil, fmt.Errorf("supply both expected_project_uuid and session_token, or neither")
		}
		return p, nil
	}
	current, err := requestAction(cfg, "project.current", window, nil)
	uuid := ""
	if err != nil {
		var native *actionError
		if !errors.As(err, &native) || native.Code != "EDA_CALL_FAILED" || native.Message != "No current project is open." {
			return nil, err
		}
		// Only a confirmed home tab may supply the explicit empty project guard.
		// Other failures and documents with missing identity remain fail closed.
		doc, readErr := requestAction(cfg, "document.current", window, nil)
		if readErr != nil {
			return nil, readErr
		}
		if doc.Result["documentType"] != "home" {
			return nil, fmt.Errorf("empty project identity is not confirmed by a home document")
		}
		if parent, _ := doc.Result["parentProjectUuid"].(string); parent != "" {
			return nil, fmt.Errorf("home document has an unexpected project identity")
		}
	} else {
		uuid, _ = current.Result["uuid"].(string)
		if uuid == "" {
			return nil, fmt.Errorf("project.current returned no project identity")
		}
	}
	scope := map[string]any{}
	for _, k := range []string{"team_uuid", "folder_uuid"} {
		if v, ok := p[k]; ok {
			scope[k] = v
		}
	}
	inventory, err := requestAction(cfg, "project.list", window, scope)
	if err != nil {
		return nil, err
	}
	token, _ := inventory.Result["session_token"].(string)
	if token == "" {
		return nil, fmt.Errorf("project.list returned no session token")
	}
	p["expected_project_uuid"] = uuid
	p["session_token"] = token
	if _, ok := p["client_transaction_id"]; !ok {
		var id [16]byte
		if _, err = rand.Read(id[:]); err != nil {
			return nil, err
		}
		p["client_transaction_id"] = "project-create-" + hex.EncodeToString(id[:])
	}
	return p, nil
}
