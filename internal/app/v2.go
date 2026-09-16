package app

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/spf13/cobra"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

func newV2Cmd(out io.Writer) *cobra.Command {
	base := "http://127.0.0.1:60832"
	root := &cobra.Command{Use: "v2", Short: "Explicit Execution V2 requests and operation receipts"}
	root.PersistentFlags().StringVar(&base, "endpoint", base, "daemon endpoint")
	root.AddCommand(newV2CheckpointCmd(&base, out))
	root.AddCommand(newV2LegacyOrphanRetireCmd(&base, out))
	root.AddCommand(&cobra.Command{Use: "catalog", Args: cobra.NoArgs, RunE: func(cmd *cobra.Command, args []string) error {
		list := []map[string]any{}
		for _, a := range protocol.AllActions() {
			item := map[string]any{"name": a.Name, "domain": a.Domain, "mode": "NOT_MIGRATED", "description": a.Description, "inputs": a.Inputs, "outputs": a.Outputs, "mutates": a.Mutates}
			if a.V2Disposition != nil {
				item["mode"] = a.V2Disposition.Mode
				item["reason"] = a.V2Disposition.Reason
			}
			if a.V2 != nil {
				item["mode"] = "V2_NATIVE"
				item["v2"] = a.V2
				item["schema"] = a.V2.SchemaID()
			}
			list = append(list, item)
		}
		return json.NewEncoder(out).Encode(list)
	}})
	root.AddCommand(&cobra.Command{Use: "call JSON_OR_@FILE", Args: cobra.ExactArgs(1), RunE: func(cmd *cobra.Command, args []string) error {
		payload := []byte(args[0])
		if strings.HasPrefix(args[0], "@") {
			var e error
			payload, e = os.ReadFile(args[0][1:])
			if e != nil {
				return e
			}
		}
		var req executionv2.Request
		d := json.NewDecoder(bytes.NewReader(payload))
		d.DisallowUnknownFields()
		if e := d.Decode(&req); e != nil {
			return e
		}
		if e := req.Validate(); e != nil {
			return e
		}
		response, e := (&http.Client{Timeout: time.Duration(req.BudgetMS+10000) * time.Millisecond}).Post(base+"/v2/operations", "application/json", bytes.NewReader(payload))
		if e != nil {
			return e
		}
		defer response.Body.Close()
		if response.StatusCode != 200 {
			b, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
			return fmt.Errorf("%s", b)
		}
		var result executionv2.Result
		if e := json.NewDecoder(response.Body).Decode(&result); e != nil {
			return e
		}
		if result.Protocol != executionv2.Version || result.OperationID != req.OperationID {
			return fmt.Errorf("V2_FOREIGN_RESULT")
		}
		switch result.Outcome {
		case executionv2.Succeeded, executionv2.NotApplied, executionv2.Partial, executionv2.Unknown:
		default:
			return fmt.Errorf("V2_MALFORMED_RESULT")
		}
		if result.EvidenceRef != req.OperationID || result.Effects.Scope == "" {
			return fmt.Errorf("V2_MALFORMED_RESULT")
		}
		if e := json.NewEncoder(out).Encode(result); e != nil {
			return e
		}
		// Projection only: no data, verification, or native flags are interpreted.
		if result.Outcome != executionv2.Succeeded {
			return errQuiet
		}
		return nil
	}})
	for _, view := range []string{"status", "evidence", "reconcile"} {
		root.AddCommand(&cobra.Command{Use: view + " OPERATION_ID", Args: cobra.ExactArgs(1), RunE: func(cmd *cobra.Command, args []string) error {
			method := "GET"
			if view == "reconcile" {
				method = "POST"
			}
			req, _ := http.NewRequestWithContext(cmd.Context(), method, base+"/v2/operation?id="+url.QueryEscape(args[0])+"&view="+view, nil)
			response, e := (&http.Client{Timeout: 10 * time.Second}).Do(req)
			if e != nil {
				return e
			}
			defer response.Body.Close()
			_, e = io.Copy(out, response.Body)
			if e != nil {
				return e
			}
			if response.StatusCode != 200 {
				return errQuiet
			}
			return nil
		}})
	}
	root.AddCommand(newV2CaptureHandoff(out, &base))
	return root
}
