// Package executionv2 owns the only public execution outcome finalizer.
package executionv2

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"time"
)

const Version = "execution.v2"

type Outcome string

const (
	Succeeded  Outcome = "SUCCEEDED"
	NotApplied Outcome = "NOT_APPLIED"
	Partial    Outcome = "PARTIAL"
	Unknown    Outcome = "UNKNOWN"
)

type Target struct {
	Scope        string `json:"scope"`
	Session      string `json:"session"`
	Activation   string `json:"activation"`
	ProjectUUID  string `json:"project_uuid,omitempty"`
	DocumentUUID string `json:"document_uuid,omitempty"`
	DocumentType string `json:"document_type,omitempty"`
	TabID        string `json:"tab_id,omitempty"`
	LibraryUUID  string `json:"library_uuid,omitempty"`
}

func (t Target) Validate() error {
	if t.Scope != "DOCUMENT" && (t.DocumentUUID != "" || t.DocumentType != "" || t.TabID != "") {
		return errors.New("V2_TARGET_SCOPE_MISMATCH")
	}
	if t.Scope != "LIBRARY" && t.LibraryUUID != "" {
		return errors.New("V2_TARGET_SCOPE_MISMATCH")
	}
	if t.Session == "" || t.Activation == "" {
		return errors.New("V2_TARGET_IDENTITY_REQUIRED")
	}
	switch t.Scope {
	case "HOME":
		if t.ProjectUUID != "" || t.DocumentUUID != "" || t.LibraryUUID != "" {
			return errors.New("V2_TARGET_SCOPE_MISMATCH")
		}
	case "PROJECT":
		if t.ProjectUUID == "" || t.DocumentUUID != "" {
			return errors.New("V2_TARGET_IDENTITY_REQUIRED")
		}
	case "DOCUMENT":
		if t.ProjectUUID == "" || t.DocumentUUID == "" || t.DocumentType == "" || t.TabID == "" {
			return errors.New("V2_TARGET_IDENTITY_REQUIRED")
		}
	case "LIBRARY":
		if t.LibraryUUID == "" {
			return errors.New("V2_TARGET_IDENTITY_REQUIRED")
		}
	default:
		return errors.New("V2_TARGET_SCOPE_UNSUPPORTED")
	}
	return nil
}

type Request struct {
	ExecutionDeadline time.Time      `json:"-"`
	Protocol          string         `json:"protocol"`
	Action            string         `json:"action"`
	ActionRevision    string         `json:"action_revision"`
	Schema            string         `json:"schema"`
	RequestID         string         `json:"request_id"`
	OperationID       string         `json:"operation_id"`
	ParentOperationID string         `json:"parent_operation_id,omitempty"`
	Target            Target         `json:"target_ref"`
	Input             map[string]any `json:"input"`
	ExpectedRevision  *uint64        `json:"expected_revision,omitempty"`
	BudgetMS          int            `json:"budget_ms"`
}

func (r Request) Validate() error {
	if r.Protocol != Version || r.RequestID == "" || r.OperationID == "" || r.Action == "" || r.ActionRevision == "" || r.Schema == "" || r.Input == nil || r.BudgetMS < 1 || r.BudgetMS > 600000 {
		return errors.New("V2_INVALID_REQUEST")
	}
	return r.Target.Validate()
}

// Wait budget and transport request ID do not change operation identity.
func (r Request) Digest() (string, error) {
	r.RequestID = ""
	r.BudgetMS = 0
	b, e := json.Marshal(r)
	if e != nil {
		return "", e
	}
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:]), nil
}

type Effects struct {
	Started    *bool  `json:"effect_started"`
	Changed    *bool  `json:"state_changed"`
	Settled    bool   `json:"native_settled"`
	Scope      string `json:"effect_scope"`
	Reconciled bool   `json:"reconciled"`
}

// Verification is authored at fresh observation sites, never extracted from data.
type Verification struct {
	Verdict   string   `json:"verdict"`
	Checked   []string `json:"checked"`
	Complete  bool     `json:"complete"`
	Required  int      `json:"required"`
	Satisfied int      `json:"satisfied"`
	Residual  int      `json:"residual"`
}
type HandlerResult struct {
	Protocol     string          `json:"protocol"`
	OperationID  string          `json:"operation_id"`
	Digest       string          `json:"digest"`
	Target       Target          `json:"target_ref"`
	Effects      Effects         `json:"effects"`
	Verification Verification    `json:"verification"`
	Value        json.RawMessage `json:"value,omitempty"`
	Evidence     json.RawMessage `json:"evidence,omitempty"`
}
type Result struct {
	Protocol    string          `json:"protocol"`
	OperationID string          `json:"operation_id"`
	Outcome     Outcome         `json:"outcome"`
	Effects     Effects         `json:"effects"`
	Code        string          `json:"code,omitempty"`
	Value       json.RawMessage `json:"value,omitempty"`
	EvidenceRef string          `json:"evidence_ref"`
}

func Bool(v bool) *bool { return &v }

// Finalize does not read Value/Evidence, action names, error strings, or prior results.
func Finalize(r Request, digest string, h HandlerResult, timedOut bool) Result {
	out := Result{Protocol: Version, OperationID: r.OperationID, Outcome: Unknown, Effects: h.Effects, EvidenceRef: r.OperationID}
	if h.Protocol != Version || h.OperationID != r.OperationID || h.Digest != digest || h.Target != r.Target {
		out.Effects = Effects{}
		out.Code = "V2_FOREIGN_OR_MALFORMED_RESULT"
		return out
	}
	if ((h.Effects.Started == nil || !*h.Effects.Started) && h.Effects.Changed != nil && *h.Effects.Changed) || h.Effects.Scope == "" {
		out.Code = "V2_MALFORMED_EFFECTS"
		return out
	}
	if len(h.Value) <= 8192 {
		out.Value = h.Value
	}
	if h.Effects.Started == nil {
		out.Effects = Effects{}
		return out
	}
	v := h.Verification
	if !h.Effects.Settled || (timedOut && !h.Effects.Reconciled) || !v.Complete || len(v.Checked) == 0 || v.Required < 1 || v.Satisfied < 0 || v.Residual < 0 || v.Required != v.Satisfied+v.Residual {
		return out
	}
	switch v.Verdict {
	case "satisfied":
		// Completion and the measured amount of state change are independent.
		// A save/notification ACK proves its command contract, not persistence.
		if v.Residual == 0 {
			out.Outcome = Succeeded
		}
	case "unchanged":
		if h.Effects.Changed != nil && !*h.Effects.Changed && v.Satisfied == 0 {
			out.Outcome = NotApplied
		}
	case "partial":
		if h.Effects.Changed != nil && *h.Effects.Changed && h.Effects.Started != nil && *h.Effects.Started && v.Satisfied > 0 && v.Residual > 0 {
			out.Outcome = Partial
		}
	}
	return out
}
