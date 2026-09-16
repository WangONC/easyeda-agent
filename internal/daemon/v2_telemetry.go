package daemon

import (
	"encoding/json"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"time"
)

// Business telemetry is descriptive only; the finalizer never consumes it.
func telemetryV2(req executionv2.Request, started time.Time, source, h executionv2.HandlerResult) executionv2.HandlerResult {
	switch req.Action {
	case "board.snapshot_compact", "route.preflight", "route.apply_batch", "placement.preflight", "placement.apply_batch", "route.tuning_plan", "route.pair_plan":
	default:
		return h
	}
	digest, e := req.Digest()
	if e != nil || h.Digest != digest || h.OperationID != req.OperationID || h.Target != req.Target || h.Protocol != executionv2.Version {
		return h
	}
	var value, raw map[string]any
	if json.Unmarshal(h.Value, &value) != nil || value == nil {
		return h
	}
	_ = json.Unmarshal(source.Value, &raw)
	calls := raw["native_api_call_count"]
	if snapshot, ok := raw["snapshot"].(map[string]any); ok {
		calls = snapshot["native_api_call_count"]
	}
	before, after := value["revision_before"], value["revision_after"]
	if after == nil {
		after = value["board_revision"]
	}
	if before == nil {
		before = req.Input["base_revision"]
	}
	if before == nil {
		before = after
	}
	nets := map[string]bool{}
	if ops, ok := req.Input["operations"].([]any); ok {
		for _, op := range ops {
			if item, ok := op.(map[string]any); ok {
				if net, ok := item["net"].(string); ok && net != "" {
					nets[net] = true
				}
			}
		}
	}
	requestBytes, _ := json.Marshal(req.Input)
	duration := int64(0)
	if !started.IsZero() {
		duration = time.Since(started).Milliseconds()
	}
	telemetry := map[string]any{"operation_id": req.OperationID, "operation_name": req.Action, "duration_ms": duration, "board_revision_before": before, "board_revision_after": after, "request_bytes": len(requestBytes), "response_bytes": 0, "native_api_call_count": calls, "affected_nets_count": len(nets), "retry_count": 0, "error_code": ""}
	value["telemetry"] = telemetry
	for i := 0; i < 4; i++ {
		b, _ := json.Marshal(value)
		telemetry["response_bytes"] = len(b)
	}
	h.Value, _ = json.Marshal(value)
	return h
}
