package app

// pcb drc --json — flatten the SDK's nested DRC violation tree into one row per
// violation, with board coordinates in REAL mil.
//
// The raw `pcb.drc.check` result mirrors the UI panel: groups nested by error
// type then net/object-type, with the actual violation leaves at the bottom
// ({errorType, explanation, pos, objs, …}). Two traps this flattener owns so
// callers stop hand-rolling python for them (optimization-loop.md B/P0 + A5):
//
//   - leaf pos {x,y} is in mil/10 — every coordinate is multiplied by 10 here
//     so the output aligns with `pcb list` / `pcb layout-lint` mil coordinates
//     (cross-checked: a 4mil clearance rule stores clearance=0.40157).
//   - the net is scattered: `net` on Connection leaves, errData.net, or only
//     embedded in the object suffix "(+3V3): C2_2" — normalized to one field.
//
// Pure functions, unit-tested against real leaves captured from the audit log.

import (
	"context"
	"errors"
	"fmt"
	"github.com/zhoushoujianwork/easyeda-agent/internal/drc"
	"io"
	"net"
	"strings"
)

// drcTimeoutHint decorates a `pcb drc` dispatch error: when the round-trip
// timed out, it appends the one fix that actually works — bring EasyEDA to the
// foreground — because a background/occluded window never finishes the DRC
// canvas recompute (optimization-loop.md A4) and blind retries only pile more
// recompute tasks onto the webview. Non-timeout errors pass through untouched.
func drcTimeoutHint(err error, stderr io.Writer) error {
	if err == nil {
		return nil
	}
	var netErr net.Error
	timedOut := errors.Is(err, context.DeadlineExceeded) ||
		(errors.As(err, &netErr) && netErr.Timeout()) ||
		strings.Contains(err.Error(), "context deadline exceeded") ||
		strings.Contains(err.Error(), "Client.Timeout")
	if timedOut {
		fmt.Fprintln(stderr, "hint: DRC did not return in time — EasyEDA is likely in the BACKGROUND; its canvas recompute never finishes there. Bring the EasyEDA window to the foreground and run `pcb drc` ONCE (do not retry in a loop: each retry piles another recompute onto the webview). For a heavy board, raise --timeout.")
	}
	return err
}

type drcFlatViolation = drc.Violation
type drcFlatReport = drc.Report

func flattenDrcResult(v map[string]any) drcFlatReport { return drc.Flatten(v) }
