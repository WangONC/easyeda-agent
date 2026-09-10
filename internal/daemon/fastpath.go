package daemon

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/zhoushoujianwork/easyeda-agent/internal/fastpath"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
	"github.com/zhoushoujianwork/easyeda-agent/internal/workflow"
	"slices"
	"strconv"
	"sync"
	"time"
)

type fastReceipt struct {
	Base, Document, Project, OperationsHash string
	Nets                                    []string
}
type fastPlans struct {
	sync.Mutex
	receipts map[string]fastReceipt
}

func isFastAction(a string) bool {
	return a == "board.snapshot_compact" || a == "route.preflight" || a == "route.apply_batch" || a == "route.tuning_plan" || a == "route.pair_plan" || a == "pcb.routing_profile"
}

type fastDispatch func(context.Context, protocol.Request) (*protocol.Response, error)

// The existing dispatch pipeline owns routing gates, FIFO, audit, health and autosave.
// Fast reads and deterministic helpers reuse one authoritative WS snapshot.
func (s *Server) forwardFast(ctx context.Context, req protocol.Request, forward fastDispatch, caps []string) (resp *protocol.Response, err error) {
	// A derived operation owns a stable parent identity even for legacy callers.
	if req.Action != "board.snapshot_compact" && req.Action != "route.apply_batch" && req.OperationID == "" {
		req.OperationID = req.ID
	}
	started := req.CreatedAt
	if started.IsZero() {
		started = time.Now()
	}
	nativeCalls := any(nil)
	observedRevision := ""
	var child *protocol.Response
	defer func() {
		if child != nil && resp != nil {
			resp.ID = req.ID
			resp.Execution = nil
			resp.Execution = protocol.Interpret(&req, resp, false)
			resp.Execution.ChildResponses = []protocol.Response{*child}
		}
	}()
	defer func() {
		if resp == nil {
			r := errorResponse(req.ID, "FAST_DISPATCH_UNCERTAIN", "Fast Path connector response unavailable", fmt.Sprint(err))
			resp = &r
			err = nil
			if req.Action == "route.apply_batch" {
				resp.Result = uncertainBatch(req.Payload["base_revision"])
			}
		}
		if resp.Result == nil {
			resp.Result = map[string]any{}
		}
		if n, ok := resp.Result["native_api_call_count"]; ok {
			nativeCalls = n
			delete(resp.Result, "native_api_call_count")
		}
		if observedRevision != "" && req.Action != "route.apply_batch" && resp.Result["board_revision"] == nil {
			resp.Result["board_revision"] = observedRevision
		}
		before := req.Payload["base_revision"]
		after := resp.Result["board_revision"]
		if v, ok := resp.Result["revision_before"]; ok {
			before = v
		}
		if v, ok := resp.Result["revision_after"]; ok {
			after = v
		}
		if before == nil {
			before = after
		}
		requestBytes, _ := json.Marshal(req.Payload)
		code := ""
		if req.Action == "route.preflight" && resp.Result["ok"] == false {
			code = "PREFLIGHT_CONFLICT"
		}
		if resp.Error != nil {
			code = resp.Error.Code
		}
		nets := 0
		switch ns := resp.Result["touched_nets"].(type) {
		case []string:
			nets = len(ns)
		case []any:
			nets = len(ns)
		}
		if req.Action == "route.apply_batch" && nets == 0 {
			var ops []fastpath.Operation
			_ = fastpath.Decode(req.Payload["operations"], &ops)
			set := map[string]bool{}
			for _, o := range ops {
				if o.Net != "" {
					set[o.Net] = true
				}
			}
			nets = len(set)
		}
		telemetry := map[string]any{"operation_id": req.ID, "operation_name": req.Action, "duration_ms": time.Since(started).Milliseconds(), "board_revision_before": before, "board_revision_after": after, "request_bytes": len(requestBytes), "response_bytes": 0, "native_api_call_count": nativeCalls, "affected_nets_count": nets, "retry_count": 0, "error_code": code}
		resp.Result["telemetry"] = telemetry
		// response_bytes counts compact result JSON including telemetry, not HTTP framing.
		for i := 0; i < 4; i++ {
			b, _ := json.Marshal(resp.Result)
			telemetry["response_bytes"] = len(b)
		}
	}()
	reject := func(code, msg string) (*protocol.Response, error) {
		r := errorResponse(req.ID, code, msg, "")
		return &r, nil
	}
	if !slices.Contains(caps, fastpath.Capability) {
		return reject("CONNECTOR_UPGRADE_REQUIRED", "Install a Connector advertising "+fastpath.Capability)
	}
	if req.Payload == nil {
		return reject("BAD_FAST_ARGUMENTS", "payload is required")
	}
	doc, _ := req.Payload["document_uuid"].(string)
	project, _ := req.Payload["project_uuid"].(string)
	if doc == "" || project == "" {
		return reject("DOCUMENT_GUARD", "document_uuid and project_uuid are required; Fast Path never opens or switches documents")
	}
	if req.Action == "route.apply_batch" {
		if req.Payload["dryRun"] == true {
			return reject("INVALID_DRY_RUN", "Use route.preflight; apply_batch never runs as a dry-run mutation")
		}
		if e := fastpath.ExplicitViaCoordinates(req.Payload, "operations"); e != nil {
			return reject("BAD_FAST_ARGUMENTS", e.Error())
		}
		var ops []fastpath.Operation
		if e := fastpath.Decode(req.Payload["operations"], &ops); e != nil {
			return reject("BAD_FAST_ARGUMENTS", e.Error())
		}
		if e := fastpath.ValidateOperations(ops); e != nil {
			return reject("BAD_FAST_ARGUMENTS", e.Error())
		}
		hash, _ := req.Payload["plan_hash"].(string)
		base, _ := req.Payload["base_revision"].(string)
		s.fastPlans.Lock()
		receipt, ok := s.fastPlans.receipts[hash]
		s.fastPlans.Unlock()
		if !ok || receipt.Base != base || receipt.Document != doc || receipt.Project != project || receipt.OperationsHash != fastpath.Hash(ops) {
			return reject("PREFLIGHT_REQUIRED", "No matching successful preflight in this daemon session; geometry, order, revision and document must match")
		}
		// Canonicalized explicit operations only. No hidden path/layer/size defaults.
		_ = fastpath.Decode(ops, &ops)
		wire := req
		wire.Payload = map[string]any{}
		for k, v := range req.Payload {
			wire.Payload[k] = v
		}
		wire.Payload["operations"] = ops
		deadline, _ := ctx.Deadline()
		if deadline.IsZero() {
			deadline = time.Now().Add(requestTimeout(&req))
		}
		wire.Payload["expires_at_ms"] = deadline.Add(-time.Second).UnixMilli()
		resp, err = forward(ctx, wire)
		if err != nil {
			return resp, err
		}
		if resp.Result == nil {
			resp.Result = map[string]any{}
		}
		resp.Result["touched_nets"] = receipt.Nets
		return resp, nil
	}
	wire := req
	wire.Action = "board.snapshot_compact"
	if req.Action != wire.Action {
		wire.ID = req.ID + "/snapshot"
		wire.ParentOperationID = req.OperationID
		if wire.ParentOperationID == "" {
			wire.ParentOperationID = req.ID
		}
		wire.OperationID = wire.ParentOperationID + "/snapshot"
	}
	if req.ContractVersion != "" || req.ContractHash != "" {
		c, _ := protocol.ContractFor(wire.Action)
		wire.ContractVersion = c.Version
		wire.ContractHash = c.Hash
	}
	wire.Payload = map[string]any{"document_uuid": doc, "project_uuid": project}
	resp, err = forward(ctx, wire)
	if resp != nil && req.Action != wire.Action {
		// Preserve the complete child receipt before producing the parent result.
		b, _ := json.Marshal(resp)
		child = &protocol.Response{}
		_ = json.Unmarshal(b, child)
	}
	if err != nil || !resp.OK {
		return resp, err
	}
	if resp.Execution != nil && !resp.Execution.RequestSatisfied {
		return reject("FAST_DEPENDENCY_FAILED", "Snapshot execution did not satisfy its contract")
	}
	nativeCalls = resp.Result["native_api_call_count"]
	var snapshot fastpath.Snapshot
	if e := fastpath.Decode(resp.Result, &snapshot); e != nil {
		return reject("BAD_SNAPSHOT", e.Error())
	}
	// Content identity is separate from the conservative legacy action epoch.
	// Read-only legacy actions may advance board_revision without changing PCB.
	observation := map[string]any{}
	for k, v := range resp.Result {
		if k != "board_revision" && k != "native_api_call_count" {
			observation[k] = v
		}
	}
	snapshot.ObservationHash = fastpath.Hash(observation)
	observedRevision = snapshot.Revision
	if snapshot.Revision == "" {
		return reject("BAD_SNAPSHOT", "Connector omitted board_revision")
	}
	if req.Action == "pcb.routing_profile" {
		value, e := profileOperation(snapshot, project, doc, req.Payload)
		if e != nil {
			return reject("PROFILE_REJECTED", e.Error())
		}
		resp.Result = value
		return resp, nil
	}
	if req.Action == "route.preflight" && req.Payload["profile_id"] != nil {
		id, ok := req.Payload["profile_id"].(string)
		if !ok || id == "" {
			return reject("PROFILE_REJECTED", "profile_id must be a nonempty string")
		}
		p, e := loadRoutingProfile(project, doc, id)
		if e != nil {
			return reject("PROFILE_REJECTED", e.Error())
		}
		state, reason := p.EvidenceState(snapshot)
		if !fastpath.ProfileUsable(state) {
			return reject("PROFILE_REJECTED", "Selected profile is "+state+": "+reason)
		}
		var routes []fastpath.Route
		if e = fastpath.Decode(req.Payload["routes"], &routes); e != nil {
			return reject("PROFILE_REJECTED", e.Error())
		}
		for _, r := range routes {
			if e = p.CheckRoute(r); e != nil {
				return reject("PROFILE_REJECTED", e.Error())
			}
		}
	}
	if req.Action == "board.snapshot_compact" {
		var scope fastpath.Scope
		if e := fastpath.Decode(req.Payload, &scope); e != nil {
			return reject("BAD_FAST_ARGUMENTS", e.Error())
		}
		compact, e := fastpath.Filter(snapshot, scope)
		if e != nil {
			return reject("BAD_FAST_ARGUMENTS", e.Error())
		}
		resp.Result = map[string]any{}
		_ = fastpath.Decode(compact, &resp.Result)
		return resp, nil
	}
	if req.Action == "route.tuning_plan" || req.Action == "route.pair_plan" {
		var value any
		var e error
		if req.Action == "route.tuning_plan" {
			value, e = fastpath.TunePayload(snapshot, req.Payload)
		} else {
			var q fastpath.PairRequest
			if e = fastpath.Decode(req.Payload, &q); e == nil {
				value, e = fastpath.Pair(snapshot, q)
			}
		}
		if e != nil {
			return reject("PLAN_REJECTED", e.Error())
		}
		resp.Result = map[string]any{}
		_ = fastpath.Decode(value, &resp.Result)
		var explicit fastpath.Plan
		if e = fastpath.Decode(resp.Result["plan"], &explicit); e != nil {
			return reject("PLAN_REJECTED", e.Error())
		}
		profileID, e := checkHelperProfile(snapshot, project, doc, req.Action, req.Payload, explicit)
		if e != nil {
			return reject("PROFILE_REJECTED", e.Error())
		}
		if profileID != "" {
			resp.Result["profile_id"] = profileID
		}
		return resp, nil
	}
	// Reuse stored workflow fingerprints using the same projection as CLI route gates.
	st, stateErr := workflow.LoadAny(s.stageKeyCandidates(&req)...)
	if stateErr != nil {
		return reject("STAGE_BLOCKED", stateErr.Error())
	}
	if st != nil {
		if st.LayoutFP != nil {
			poses := []workflow.ComponentPose{}
			for _, c := range snapshot.Components {
				poses = append(poses, workflow.ComponentPose{Designator: c.Designator, X: c.X, Y: c.Y, Rotation: c.Rotation, Layer: strconv.Itoa(c.Layer)})
			}
			if workflow.HashLayout(poses) != st.LayoutFP.Hash {
				return reject("WORKFLOW_FINGERPRINT_STALE", "Placement changed since workflow confirmation")
			}
		}
		if st.OutlineFP != nil && (snapshot.Outline == nil || fastpath.Hash(snapshot.Outline) != st.OutlineFP.Hash) {
			return reject("WORKFLOW_FINGERPRINT_STALE", "Outline changed since workflow confirmation")
		}
	}
	if e := fastpath.ExplicitViaCoordinates(req.Payload, "vias"); e != nil {
		return reject("BAD_FAST_ARGUMENTS", e.Error())
	}
	var plan fastpath.Plan
	if e := fastpath.Decode(req.Payload, &plan); e != nil {
		return reject("BAD_FAST_ARGUMENTS", e.Error())
	}
	checked, e := fastpath.Preflight(snapshot, plan)
	if e != nil {
		code := "PREFLIGHT_REJECTED"
		if e.Error() == "STALE_REVISION" {
			code = "STALE_REVISION"
		}
		r, _ := reject(code, e.Error())
		r.Result = map[string]any{"ok": false, "board_revision": snapshot.Revision, "plan_hash": ""}
		return r, nil
	}
	resp.Result = map[string]any{}
	_ = fastpath.Decode(checked, &resp.Result)
	if checked.OK {
		s.fastPlans.Lock()
		defer s.fastPlans.Unlock()
		if s.fastPlans.receipts == nil {
			s.fastPlans.receipts = map[string]fastReceipt{}
		}
		if _, exists := s.fastPlans.receipts[checked.Hash]; !exists && len(s.fastPlans.receipts) >= 2048 {
			return reject("PLAN_CACHE_FULL", "Daemon plan cache is full; restart invalidates all old preflight receipts")
		}
		s.fastPlans.receipts[checked.Hash] = fastReceipt{plan.Base, doc, project, fastpath.Hash(checked.Operations), checked.Nets}
	}
	return resp, nil
}
func uncertainBatch(base any) map[string]any {
	return map[string]any{"status": "uncertain", "created_ids": []string{}, "deleted_ids": []string{}, "item_results": []any{}, "failed_index": nil, "revision_before": base, "revision_after": nil, "readback_verified": false, "rollback_attempted": false, "rollback_complete": false, "warnings": []string{"No definitive response. IDs and rollback state are unknown; the queued/native action may execute late. Preserve client_transaction_id."}}
}
