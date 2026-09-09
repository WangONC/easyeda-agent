package daemon

import (
	"encoding/json"
	"fmt"
	"github.com/zhoushoujianwork/easyeda-agent/internal/fastpath"
	"github.com/zhoushoujianwork/easyeda-agent/internal/workflow"
	"os"
	"path/filepath"
)

func routingProfilePath(project, doc, id string) string {
	return filepath.Join(workflow.Dir(), "routing-profiles", fastpath.Hash([]string{project, doc}), fastpath.Hash(id)+".json")
}
func loadRoutingProfile(project, doc, id string) (fastpath.RoutingProfile, error) {
	var p fastpath.RoutingProfile
	b, e := os.ReadFile(routingProfilePath(project, doc, id))
	if e != nil {
		return p, e
	}
	if e = json.Unmarshal(b, &p); e != nil {
		return p, e
	}
	if e = p.Validate(); e != nil {
		return p, e
	}
	if p.ID != id {
		return p, fmt.Errorf("profile identity mismatch")
	}
	return p, nil
}
func storeRoutingProfile(project, doc string, p fastpath.RoutingProfile) error {
	if e := p.Validate(); e != nil {
		return e
	}
	path := routingProfilePath(project, doc, p.ID)
	if e := os.MkdirAll(filepath.Dir(path), 0700); e != nil {
		return e
	}
	// Reviewed IDs are immutable. A change requires an explicit new profile ID.
	// Exclusive create also prevents concurrent requests overwriting a review.
	f, e := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if os.IsExist(e) {
		old, readErr := loadRoutingProfile(project, doc, p.ID)
		if readErr != nil {
			return readErr
		}
		if fastpath.Hash(old) != fastpath.Hash(p) {
			return fmt.Errorf("profile ID already contains a different review; use a new ID")
		}
		return nil
	}
	if e != nil {
		return e
	}
	e = json.NewEncoder(f).Encode(p)
	closeErr := f.Close()
	if e != nil {
		return e
	}
	return closeErr
}
func profileOperation(s fastpath.Snapshot, project, doc string, payload map[string]any) (map[string]any, error) {
	stackup, rules := fastpath.ProfileTokens(s)
	result := map[string]any{"board_revision": s.Revision, "stackup_hash": stackup, "rules_hash": rules, "project_uuid": project, "document_uuid": doc, "units": "mil"}
	result["host_physical_stackup"] = "UNAVAILABLE"
	result["host_crosscheck"] = "NOT_AVAILABLE_ON_EDA_3_2_OR_UNSUPPORTED_HOST"
	result["host_limitation"] = "HOST_PHYSICAL_STATE_UNVERIFIABLE"
	if stackup != "" {
		result["host_physical_stackup"] = "OBSERVED_UNACCEPTED"
		result["host_crosscheck"] = "SEPARATE_HOST_ACCEPTANCE_REQUIRED"
	}
	result["observed_layers_hash"] = fastpath.ProfileLayersHash(s)
	operation, _ := payload["operation"].(string)
	if operation == "context" {
		result["physical_stackup"] = s.PhysicalStackup
		result["copper_layers"] = s.Layers
		result["state"] = "UNKNOWN"
		if stackup != "" && rules != "" {
			result["state"] = "OBSERVED"
		}
		return result, nil
	}
	var p fastpath.RoutingProfile
	var e error
	if operation == "put" {
		if e = fastpath.Decode(payload["profile"], &p); e != nil {
			return nil, e
		}
		if p.EvidenceBasis == "manufacturer" {
			computed := p.ManufacturerStackupHash()
			if p.StackupHash != "" && p.StackupHash != computed {
				return nil, fmt.Errorf("PROFILE_STALE: reviewed stackup hash mismatch")
			}
			p.StackupHash = computed
			if p.ObservedLayersHash == "" {
				return nil, fmt.Errorf("obtain observed_layers_hash from current context")
			}
		}
		if e = p.Validate(); e != nil {
			return nil, e
		}
		if p.EvidenceBasis != "manufacturer" && (stackup == "" || rules == "" || p.StackupHash != stackup || p.RulesHash != rules) {
			return nil, fmt.Errorf("PROFILE_STALE_OR_UNKNOWN: obtain current context before recording review")
		}
		if state, reason := p.EvidenceState(s); state == "STALE" || state == "UNKNOWN" {
			return nil, fmt.Errorf("PROFILE_%s: %s", state, reason)
		}
		if e = storeRoutingProfile(project, doc, p); e != nil {
			return nil, e
		}
	} else if operation == "get" {
		id, _ := payload["profile_id"].(string)
		if id == "" {
			return nil, fmt.Errorf("profile_id required")
		}
		if p, e = loadRoutingProfile(project, doc, id); e != nil {
			return nil, e
		}
	} else {
		return nil, fmt.Errorf("operation must be context, put or get")
	}
	result["profile"] = p
	result["state"], result["stale_reason"] = p.EvidenceState(s)
	result["profile_hash"] = fastpath.Hash(p)
	result["stackup_hash"] = p.StackupHash
	result["layer_count"] = len(p.LayerOrder)
	result["verification_meaning"] = "manufacturer-reviewed inputs bound to observable copper inventory/rules; no Host physical certification"
	return result, nil
}

// Optional helper profile selection validates explicit caller geometry; it never
// chooses a layer, width, gap, target or route on the caller's behalf.
func checkHelperProfile(s fastpath.Snapshot, project, doc, action string, payload map[string]any, plan fastpath.Plan) (string, error) {
	raw, exists := payload["profile_id"]
	if !exists {
		return "", nil
	}
	id, ok := raw.(string)
	if !ok || id == "" {
		return "", fmt.Errorf("profile_id must be a nonempty string")
	}
	p, e := loadRoutingProfile(project, doc, id)
	if e != nil {
		return "", e
	}
	if state, reason := p.EvidenceState(s); !fastpath.ProfileUsable(state) {
		return "", fmt.Errorf("selected profile is %s: %s", state, reason)
	}
	for _, r := range plan.Routes {
		if e = p.CheckRoute(r); e != nil {
			return "", e
		}
	}
	if action == "route.pair_plan" {
		gap, ok := payload["gap"].(float64)
		if p.Kind != "differential" || !ok || gap != p.Gap {
			return "", fmt.Errorf("explicit pair gap/kind differs from reviewed profile")
		}
	} else if p.Kind != "single-ended" {
		return "", fmt.Errorf("single-ended tuning requires a single-ended profile")
	}
	return id, nil
}
