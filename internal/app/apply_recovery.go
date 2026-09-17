package app

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
)

var applyReconcilePollInterval = 250 * time.Millisecond

type applyReconcileError struct{ err error }

func (e *applyReconcileError) Error() string { return e.err.Error() }
func (e *applyReconcileError) Unwrap() error { return e.err }

func applyReconcileBudget(actionBudget time.Duration) time.Duration {
	budget := actionBudget / 2
	if budget < 10*time.Second {
		budget = 10 * time.Second
	}
	if budget > 60*time.Second {
		budget = 60 * time.Second
	}
	return budget
}

// reconcileApplyOperation asks the Connector to re-run only the verifier that
// belongs to operationID, then polls the same immutable operation receipt. It
// never submits the original action or its input again.
func (r *applyRunner) reconcileApplyOperation(action, operationID string, actionBudget time.Duration) (any, error) {
	if operationID == "" || r.cfg.v2Read == nil || r.cfg.v2Read.endpoint == "" {
		return nil, fmt.Errorf("V2_APPLY_RECONCILE_UNAVAILABLE: operation binding missing")
	}
	endpoint := r.cfg.v2Read.endpoint
	deadline := time.Now().Add(applyReconcileBudget(actionBudget))
	result, err := readApplyOperation(endpoint, operationID, http.MethodPost, "reconcile")
	if err != nil {
		return nil, err
	}
	for {
		switch result.Outcome {
		case executionv2.Succeeded:
			raw, err := json.Marshal(result)
			if err != nil {
				return nil, err
			}
			parsed, err := actionValueV2(raw, action)
			if err != nil {
				return nil, err
			}
			return anyResult(parsed.Result), nil
		case executionv2.NotApplied, executionv2.Partial, executionv2.RetiredUnresolved:
			return nil, fmt.Errorf("operation %s reconcile resolved %s; mutation was not replayed", operationID, result.Outcome)
		case executionv2.Unknown:
			if time.Now().After(deadline) {
				return nil, fmt.Errorf("operation %s remains UNKNOWN after formal reconcile; mutation was not replayed", operationID)
			}
		default:
			return nil, fmt.Errorf("operation %s returned malformed outcome %q", operationID, result.Outcome)
		}
		time.Sleep(applyReconcilePollInterval)
		result, err = readApplyOperation(endpoint, operationID, http.MethodGet, "status")
		if err != nil {
			return nil, err
		}
	}
}

func readApplyOperation(endpoint, operationID, method, view string) (executionv2.Result, error) {
	var result executionv2.Result
	req, err := http.NewRequest(method, endpoint+"/v2/operation?id="+url.QueryEscape(operationID)+"&view="+view, nil)
	if err != nil {
		return result, err
	}
	response, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
	if err != nil {
		return result, fmt.Errorf("V2_APPLY_RECONCILE_TRANSPORT: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
		return result, fmt.Errorf("V2_APPLY_RECONCILE_REJECTED HTTP %d: %s", response.StatusCode, body)
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 32<<20)).Decode(&result); err != nil {
		return result, err
	}
	if result.Protocol != executionv2.Version || result.OperationID != operationID || result.EvidenceRef != operationID {
		return result, fmt.Errorf("V2_FOREIGN_RESULT")
	}
	return result, nil
}
