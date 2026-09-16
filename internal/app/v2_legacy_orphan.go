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
)

const legacyOrphanRetireProtocol = "execution.v2.legacy-orphan-retire.1"

func newV2LegacyOrphanRetireCmd(endpoint *string, out io.Writer) *cobra.Command {
	var digest, fingerprint, reason string
	var confirmHostState bool
	c := &cobra.Command{
		Use:   "retire-legacy-orphan [OPERATION_ID]",
		Short: "Retire one identified pre-durable legacy orphan after manual Host verification; never marks it successful",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if !confirmHostState {
				return fmt.Errorf("V2_LEGACY_ORPHAN_CONFIRMATION_REQUIRED: pass --confirm-host-state only after fresh Host verification")
			}
			digest = strings.TrimSpace(digest)
			fingerprint = strings.TrimSpace(fingerprint)
			reason = strings.TrimSpace(reason)
			if fingerprint == "" || reason == "" {
				return fmt.Errorf("V2_LEGACY_ORPHAN_IDENTITY_REQUIRED: --fingerprint and --reason are required")
			}
			base := strings.TrimRight(*endpoint, "/")
			client := &http.Client{Timeout: 10 * time.Second}
			healthResponse, err := client.Get(base + "/health")
			if err != nil {
				return err
			}
			defer healthResponse.Body.Close()
			var health struct {
				Service        string `json:"service"`
				V2Session      string `json:"v2_session"`
				V2LegacyOrphan *struct {
					OperationID       string `json:"operation_id"`
					Digest            string `json:"digest"`
					MarkerFingerprint string `json:"marker_fingerprint"`
				} `json:"v2_legacy_orphan"`
			}
			if healthResponse.StatusCode != http.StatusOK || json.NewDecoder(healthResponse.Body).Decode(&health) != nil || health.Service != "easyeda-agent" {
				return fmt.Errorf("V2_DAEMON_IDENTITY_MISMATCH")
			}
			if health.V2LegacyOrphan == nil || health.V2LegacyOrphan.MarkerFingerprint != fingerprint {
				return fmt.Errorf("V2_LEGACY_ORPHAN_IDENTITY_MISMATCH: use the exact v2_legacy_orphan identity reported by health")
			}
			operationID := ""
			if len(args) == 1 {
				operationID = args[0]
			}
			if health.V2LegacyOrphan.OperationID != operationID || health.V2LegacyOrphan.Digest != digest || (operationID != "" && digest == "") || (operationID == "" && digest != "") {
				return fmt.Errorf("V2_LEGACY_ORPHAN_IDENTITY_MISMATCH: identified orphan needs exact operation/digest; unrecognized marker needs neither")
			}
			payload, err := json.Marshal(map[string]any{
				"protocol": legacyOrphanRetireProtocol, "operation_id": operationID, "digest": digest, "marker_fingerprint": fingerprint,
				"daemon_session": health.V2Session, "reason": reason, "host_state_confirmed": true,
			})
			if err != nil {
				return err
			}
			request, _ := http.NewRequestWithContext(cmd.Context(), http.MethodPost, base+"/v2/operation?id="+url.QueryEscape(operationID)+"&view=retire-legacy-orphan", bytes.NewReader(payload))
			request.Header.Set("Content-Type", "application/json")
			response, err := client.Do(request)
			if err != nil {
				return err
			}
			defer response.Body.Close()
			if _, err := io.Copy(out, response.Body); err != nil {
				return err
			}
			if response.StatusCode != http.StatusOK {
				return errQuiet
			}
			return nil
		},
	}
	c.Flags().StringVar(&digest, "digest", "", "exact digest reported by health for this legacy orphan")
	c.Flags().StringVar(&fingerprint, "fingerprint", "", "exact raw lifecycle-marker fingerprint reported by health")
	c.Flags().StringVar(&reason, "reason", "", "operator audit reason after fresh Host state verification")
	c.Flags().BoolVar(&confirmHostState, "confirm-host-state", false, "confirm fresh Host state was checked; does not claim the old UNKNOWN succeeded")
	return c
}
