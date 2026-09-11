package app

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/spf13/cobra"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"time"
)

func newV2CaptureHandoff(out io.Writer, endpoint *string) *cobra.Command {
	return &cobra.Command{Use: "capture-held-handoff REQUEST_FILE RECEIPT_FILE", Short: "Capture one explicitly held settled UNKNOWN from a pre-handoff local daemon; never stops it", Args: cobra.ExactArgs(2), RunE: func(cmd *cobra.Command, args []string) error {
		u, err := url.Parse(*endpoint)
		if err != nil {
			return err
		}
		ip := net.ParseIP(u.Hostname())
		if u.Scheme != "http" || ip == nil || !ip.IsLoopback() || u.User != nil {
			return fmt.Errorf("V2_LOCAL_DAEMON_REQUIRED")
		}
		data, err := os.ReadFile(args[0])
		if err != nil {
			return err
		}
		var r executionv2.Request
		decoder := json.NewDecoder(bytes.NewReader(data))
		decoder.DisallowUnknownFields()
		if err = decoder.Decode(&r); err != nil {
			return err
		}
		a, err := protocol.ValidateV2(r)
		if err != nil {
			return err
		}
		if a.EffectScope == "NONE" {
			return fmt.Errorf("V2_HELD_EFFECT_REQUIRED")
		}
		client := &http.Client{Timeout: 10 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return fmt.Errorf("V2_REDIRECT_REFUSED") }}
		read := func(view string, v any) error {
			request, err := http.NewRequestWithContext(cmd.Context(), "GET", *endpoint+"/v2/operation?id="+url.QueryEscape(r.OperationID)+"&view="+view, nil)
			if err != nil {
				return err
			}
			response, err := client.Do(request)
			if err != nil {
				return err
			}
			defer response.Body.Close()
			if response.StatusCode != 200 {
				return fmt.Errorf("V2_CAPTURE_HTTP_%d", response.StatusCode)
			}
			return json.NewDecoder(io.LimitReader(response.Body, 64<<20)).Decode(v)
		}
		var before, after executionv2.Result
		var evidence executionv2.HandlerResult
		if err = read("status", &before); err != nil {
			return err
		}
		if err = read("evidence", &evidence); err != nil {
			return err
		}
		if err = read("status", &after); err != nil {
			return err
		}
		b, _ := json.Marshal(before)
		aJSON, _ := json.Marshal(after)
		if !bytes.Equal(b, aJSON) {
			return fmt.Errorf("V2_RECEIPT_CHANGED_DURING_CAPTURE")
		}
		if err = executionv2.SaveHeldReceipt(args[1], r, after, evidence); err != nil {
			return err
		}
		return json.NewEncoder(out).Encode(map[string]any{"handoff": "saved", "operation_id": r.OperationID, "outcome": after.Outcome, "ownership": "held", "file": args[1], "old_daemon_stopped": false})
	}}
}
