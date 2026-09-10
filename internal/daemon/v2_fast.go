package daemon

import (
	"encoding/json"
	"fmt"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"github.com/zhoushoujianwork/easyeda-agent/internal/fastpath"
	"github.com/zhoushoujianwork/easyeda-agent/internal/workflow"
	"strconv"
)

// Pure business computation over the one operation's fresh native observation.
// This function neither consumes legacy Response nor decides public Outcome.
func (s *Server) completeFastReadV2(req executionv2.Request, h executionv2.HandlerResult) executionv2.HandlerResult {
	if req.Action != "board.snapshot_compact" && req.Action != "route.tuning_plan" && req.Action != "route.pair_plan" && req.Action != "route.preflight" && req.Action != "pcb.routing_profile" {
		return h
	}
	digest, e := req.Digest()
	if e != nil || h.Protocol != executionv2.Version || h.OperationID != req.OperationID || h.Digest != digest || h.Target != req.Target || !h.Effects.Settled || h.Verification.Verdict != "satisfied" || !h.Verification.Complete {
		return h
	}
	value, e := s.fastReadValueV2(req, h.Value)
	h.Evidence = h.Value
	if e != nil {
		h.Value = nil
		h.Verification = executionv2.Verification{Verdict: "unavailable"}
		h.Evidence, _ = json.Marshal(map[string]any{"error": e.Error(), "observation": json.RawMessage(h.Evidence)})
		return h
	}
	h.Value, _ = json.Marshal(value)
	h.Verification.Checked = append(h.Verification.Checked, "fast_business_computation")
	return h
}
func (s *Server) fastReadValueV2(req executionv2.Request, raw json.RawMessage) (any, error) {
	var bundle struct {
		Version  string          `json:"fast_observation"`
		Snapshot json.RawMessage `json:"snapshot"`
	}
	if e := json.Unmarshal(raw, &bundle); e != nil {
		return nil, e
	}
	if bundle.Version != "v2" {
		return nil, fmt.Errorf("V2_FAST_OBSERVATION_INVALID")
	}
	var snapshot fastpath.Snapshot
	if e := json.Unmarshal(bundle.Snapshot, &snapshot); e != nil {
		return nil, e
	}
	if snapshot.Revision == "" || snapshot.Components == nil || snapshot.Pads == nil || snapshot.Traces == nil || snapshot.Vias == nil || snapshot.Fills == nil {
		return nil, fmt.Errorf("V2_FAST_OBSERVATION_INCOMPLETE")
	}
	var observation map[string]any
	_ = json.Unmarshal(bundle.Snapshot, &observation)
	delete(observation, "board_revision")
	delete(observation, "native_api_call_count")
	snapshot.ObservationHash = fastpath.Hash(observation)
	p := req.Input
	if req.Action == "route.preflight" {
		return s.preflightV2(req, snapshot)
	}
	if req.Action == "pcb.routing_profile" {
		return profileOperation(snapshot, req.Target.ProjectUUID, req.Target.DocumentUUID, req.Input)
	}
	if req.Action == "board.snapshot_compact" {
		var scope fastpath.Scope
		if e := fastpath.Decode(p, &scope); e != nil {
			return nil, e
		}
		return fastpath.Filter(snapshot, scope)
	}
	var value any
	var e error
	if req.Action == "route.tuning_plan" {
		value, e = fastpath.TunePayload(snapshot, p)
	} else {
		var q fastpath.PairRequest
		if e = fastpath.Decode(p, &q); e == nil {
			value, e = fastpath.Pair(snapshot, q)
		}
	}
	if e != nil {
		return nil, e
	}
	var data map[string]any
	if e = fastpath.Decode(value, &data); e != nil {
		return nil, e
	}
	var plan fastpath.Plan
	if e = fastpath.Decode(data["plan"], &plan); e != nil {
		return nil, e
	}
	id, e := checkHelperProfile(snapshot, req.Target.ProjectUUID, req.Target.DocumentUUID, req.Action, p, plan)
	if e != nil {
		return nil, e
	}
	if id != "" {
		data["profile_id"] = id
	}
	data["board_revision"] = snapshot.Revision
	return data, nil
}

func (s *Server) preflightV2(req executionv2.Request, snapshot fastpath.Snapshot) (any, error) {
	p := req.Input
	project, doc := req.Target.ProjectUUID, req.Target.DocumentUUID
	if id, ok := p["profile_id"].(string); ok {
		profile, e := loadRoutingProfile(project, doc, id)
		if e != nil {
			return nil, e
		}
		state, reason := profile.EvidenceState(snapshot)
		if !fastpath.ProfileUsable(state) {
			return nil, fmt.Errorf("PROFILE_REJECTED: %s %s", state, reason)
		}
		var routes []fastpath.Route
		if e = fastpath.Decode(p["routes"], &routes); e != nil {
			return nil, e
		}
		for _, r := range routes {
			if e = profile.CheckRoute(r); e != nil {
				return nil, e
			}
		}
	}
	keys := []string{project}
	if c, ok := s.hub.get(req.Target.Session); ok {
		ctx := c.snapshot().Context
		if ctx.ProjectUUID == project && ctx.ProjectName != "" {
			keys = append(keys, ctx.ProjectName)
		}
	}
	st, e := workflow.LoadAny(keys...)
	if e != nil {
		return nil, e
	}
	if st != nil {
		if st.LayoutFP != nil {
			poses := []workflow.ComponentPose{}
			for _, c := range snapshot.Components {
				poses = append(poses, workflow.ComponentPose{Designator: c.Designator, X: c.X, Y: c.Y, Rotation: c.Rotation, Layer: strconv.Itoa(c.Layer)})
			}
			if workflow.HashLayout(poses) != st.LayoutFP.Hash {
				return nil, fmt.Errorf("WORKFLOW_FINGERPRINT_STALE")
			}
		}
		if st.OutlineFP != nil && (snapshot.Outline == nil || fastpath.Hash(snapshot.Outline) != st.OutlineFP.Hash) {
			return nil, fmt.Errorf("WORKFLOW_FINGERPRINT_STALE")
		}
	}
	if e = fastpath.ExplicitViaCoordinates(p, "vias"); e != nil {
		return nil, e
	}
	var plan fastpath.Plan
	if e = fastpath.Decode(p, &plan); e != nil {
		return nil, e
	}
	checked, e := fastpath.Preflight(snapshot, plan)
	if e != nil {
		return nil, e
	}
	if checked.OK {
		s.fastPlans.Lock()
		defer s.fastPlans.Unlock()
		if s.fastPlans.receipts == nil {
			s.fastPlans.receipts = map[string]fastReceipt{}
		}
		if _, exists := s.fastPlans.receipts[checked.Hash]; !exists && len(s.fastPlans.receipts) >= 2048 {
			return nil, fmt.Errorf("PLAN_CACHE_FULL")
		}
		s.fastPlans.receipts[checked.Hash] = fastReceipt{plan.Base, doc, project, fastpath.Hash(checked.Operations), checked.Nets}
	}
	// checked.OK is a geometry preflight business answer, never the execution Outcome.
	return checked, nil
}

func (s *Server) validateBatchV2(req executionv2.Request) error {
	p := req.Input
	if p["client_transaction_id"] != req.OperationID {
		return fmt.Errorf("V2_TRANSACTION_ID_MISMATCH")
	}
	for key, want := range map[string]string{"project_uuid": req.Target.ProjectUUID, "document_uuid": req.Target.DocumentUUID} {
		if got, exists := p[key]; exists && got != want {
			return fmt.Errorf("V2_TARGET_MISMATCH")
		}
	}
	if e := fastpath.ExplicitViaCoordinates(p, "operations"); e != nil {
		return e
	}
	var ops []fastpath.Operation
	if e := fastpath.Decode(p["operations"], &ops); e != nil {
		return e
	}
	if e := fastpath.ValidateOperations(ops); e != nil {
		return e
	}
	hash, _ := p["plan_hash"].(string)
	base, _ := p["base_revision"].(string)
	s.fastPlans.Lock()
	receipt, ok := s.fastPlans.receipts[hash]
	s.fastPlans.Unlock()
	if !ok || receipt.Base != base || receipt.Document != req.Target.DocumentUUID || receipt.Project != req.Target.ProjectUUID || receipt.OperationsHash != fastpath.Hash(ops) {
		return fmt.Errorf("PREFLIGHT_REQUIRED")
	}
	return nil
}
