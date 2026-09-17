package app

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
)

func getV2JSON(cmd *cobra.Command, endpoint string, value any) error {
	req, err := http.NewRequestWithContext(cmd.Context(), http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	response, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
		return fmt.Errorf("%s", strings.TrimSpace(string(body)))
	}
	return json.NewDecoder(response.Body).Decode(value)
}

func postV2JSON(cmd *cobra.Command, endpoint string, payload any, value any) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(cmd.Context(), http.MethodPost, endpoint, bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	response, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
		return fmt.Errorf("%s", strings.TrimSpace(string(body)))
	}
	return json.NewDecoder(response.Body).Decode(value)
}

func newV2UnresolvedRetireCmd(base *string, out io.Writer) *cobra.Command {
	var reason string
	var confirm bool
	command := &cobra.Command{
		Use:   "retire-unresolved OPERATION_ID",
		Short: "Durably retire one settled unresolved V2 operation into scoped quarantine; never replay",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if !confirm || strings.TrimSpace(reason) == "" {
				return fmt.Errorf("V2_RETIRE_UNRESOLVED_CONFIRMATION_REQUIRED: pass --confirm-native-settled with an audit --reason")
			}
			var health struct {
				Session string `json:"v2_session"`
			}
			if err := getV2JSON(cmd, *base+"/health", &health); err != nil {
				return err
			}
			var status executionv2.Result
			operationURL := *base + "/v2/operation?id=" + url.QueryEscape(args[0])
			if err := getV2JSON(cmd, operationURL+"&view=status", &status); err != nil {
				return err
			}
			if status.Outcome != executionv2.Unknown || !status.Effects.Settled || status.Effects.Started == nil || !*status.Effects.Started {
				return fmt.Errorf("V2_RETIRE_UNRESOLVED_NOT_ELIGIBLE")
			}
			var evidence executionv2.HandlerResult
			if err := getV2JSON(cmd, operationURL+"&view=evidence", &evidence); err != nil {
				return err
			}
			payload := map[string]any{
				"protocol": "execution.v2.retire-unresolved.1", "operation_id": args[0],
				"digest": evidence.Digest, "evidence_fingerprint": executionv2.EvidenceFingerprint(evidence),
				"daemon_session": health.Session, "reason": strings.TrimSpace(reason),
				"native_settled_confirmed": true,
			}
			var response struct {
				Operation executionv2.Result `json:"operation"`
			}
			if err := postV2JSON(cmd, operationURL+"&view=retire-unresolved", payload, &response); err != nil {
				return err
			}
			return json.NewEncoder(out).Encode(response.Operation)
		},
	}
	command.Flags().StringVar(&reason, "reason", "", "auditable reason for retiring the settled unresolved operation")
	command.Flags().BoolVar(&confirm, "confirm-native-settled", false, "confirm status/evidence show the original native call has settled; this does not claim success")
	return command
}

func newV2RequalifyCmd(base *string, out io.Writer) *cobra.Command {
	return &cobra.Command{
		Use:   "requalify OPERATION_ID READ_OPERATION_ID",
		Short: "Apply one successful fresh NONE-effect read receipt to a quarantined scope",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			var health struct {
				Session string `json:"v2_session"`
			}
			if err := getV2JSON(cmd, *base+"/health", &health); err != nil {
				return err
			}
			payload := map[string]any{
				"protocol": "execution.v2.requalify.1", "operation_id": args[0],
				"read_operation_id": args[1], "daemon_session": health.Session,
			}
			var response map[string]any
			endpoint := *base + "/v2/operation?id=" + url.QueryEscape(args[0]) + "&view=requalify"
			if err := postV2JSON(cmd, endpoint, payload, &response); err != nil {
				return err
			}
			return json.NewEncoder(out).Encode(response)
		},
	}
}
