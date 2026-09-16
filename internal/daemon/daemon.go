package daemon

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/zhoushoujianwork/easyeda-agent/internal/executionv2"
	"io"
	"net"
	"net/http"
	"sync"
	"sync/atomic"
	"time"
)

// Service is the identity string the connector and CLI use to confirm they are
// talking to an easyeda-agent daemon rather than some other local server.
const Service = "easyeda-agent"

// Options configures a daemon Server.
type Options struct {
	// V2HostStartupConfirmed is retained for CLI compatibility. It never releases
	// a lifecycle marker; legacy orphan recovery requires exact fingerprint retire.
	V2HostStartupConfirmed bool
	V2ReceiptFile          string

	Host           string
	PortStart      int
	PortEnd        int
	Version        string
	SourceRevision string

	// ArtifactDir is the FALLBACK directory for inline artifact bytes from the
	// connector, used only when a request carries no outputDir. The CLI sends its
	// own working directory as outputDir, so artifacts normally land in
	// <cwd>/.easyeda/artifacts (see artifactDir). Defaults to "artifacts"
	// (relative to the daemon's working directory) when empty.
	ArtifactDir string

	// AuditDir is where per-day JSONL action logs are appended. Defaults to
	// ~/.easyeda-agent/audit/ when empty.
	AuditDir string

	// AutosaveDebounce, when > 0, enables daemon-level debounced autosave: after a
	// successful mutating action the daemon saves the window once edits quiesce for
	// this long (a burst coalesces into one save). 0 disables it. See autosave.go.
	AutosaveDebounce time.Duration
}

// Server is the long-running local HTTP server. It serves /health, accepts
// connector WebSockets on /connect, and forwards typed actions on /action.
// Artifact storage and audit logging come later.
type Server struct {
	v2StartupErr         error
	v2UncleanStart       bool
	v2UncleanOwner       string
	v2UncleanDigest      string
	v2UncleanFingerprint string
	v2RestoredOwner      string
	v2Session            string
	v2                   *executionv2.Coordinator
	v2Mu                 sync.Mutex
	v2RecoveryMu         sync.Mutex
	v2Pending            map[string]v2Pending

	fastPlans fastPlans
	opts      Options
	hub       *hub
	reqSeq    atomic.Uint64
	log       io.Writer
	audit     *auditWriter
	autosave  *autosaver // nil when Options.AutosaveDebounce <= 0

	// staleReads tracks per-window PCB mutations that have not been followed by
	// a doc reload, so PCB reads can carry a staleRisk advisory (stalereads.go).
	staleReads *staleGuard

	// concurrentWrites tracks the last mutating client per window, so a
	// different client's mutation can carry a concurrentWriter advisory
	// (concurrentwrites.go, issue #108).
	concurrentWrites *concurrentGuard

	// writeHealth tracks a rolling per-window failure window so /health can
	// expose connector load degradation and failed writes can carry a
	// structured degraded advisory (writehealth.go, REPORT round2 新 3).
	writeHealth *writeHealthTracker

	// queueBlocks proves (or clears) "the connector's per-window FIFO is stuck
	// behind one wedged handler", so a command gets an instant, named answer
	// instead of burning its full dispatch budget behind a dead head
	// (queueblock.go).
	queueBlocks *queueBlockTracker

	// clientInflight counts client-issued actions currently forwarded per window,
	// so the debounced autosave never injects a 20-60s save into the middle of a
	// batch (autosave.go: 真机实测 4 次超时簇全部叠在 22s/36s/44s/59s 的 autosave 上).
	clientInflight sync.Map // windowID -> *atomic.Int64

	// inflight tracks non-reentrant actions currently forwarded, keyed
	// "<action>|<windowId>" — see acquireExclusive / nonReentrant.
	inflight sync.Map

	// connCtx is cancelled on shutdown so connector read loops unblock.
	connCtx    context.Context
	connCancel context.CancelFunc
	shutdown   chan struct{}
	stopOnce   sync.Once
}

// acquireExclusive claims the per-window slot for a non-reentrant action.
// The second return is false while another request holds the slot; on true,
// call release() when the action settles.
func (s *Server) acquireExclusive(action, windowID string) (release func(), acquired bool) {
	key := action + "|" + windowID
	if _, loaded := s.inflight.LoadOrStore(key, struct{}{}); loaded {
		return nil, false
	}
	return func() { s.inflight.Delete(key) }, true
}

// beginClientAction marks one client-issued action as in flight on a window and
// returns the release func. Used by the autosave gate: a save must land in an
// IDLE gap, never in the middle of a batch (autosave.go). Release is idempotent.
func (s *Server) beginClientAction(windowID string) (release func()) {
	if windowID == "" {
		return func() {}
	}
	v, _ := s.clientInflight.LoadOrStore(windowID, new(atomic.Int64))
	counter, ok := v.(*atomic.Int64)
	if !ok {
		return func() {}
	}
	counter.Add(1)
	var once sync.Once
	return func() { once.Do(func() { counter.Add(-1) }) }
}

// clientActionsInFlight reports how many client-issued actions are currently
// forwarded to a window (the autosave's own save is never counted — it does not
// go through /action).
func (s *Server) clientActionsInFlight(windowID string) int64 {
	if windowID == "" {
		return 0
	}
	v, ok := s.clientInflight.Load(windowID)
	if !ok {
		return 0
	}
	counter, ok := v.(*atomic.Int64)
	if !ok {
		return 0
	}
	return counter.Load()
}

// logf writes a diagnostic line to the server log, if one is set.
func (s *Server) logf(format string, args ...any) {
	if s.log != nil {
		fmt.Fprintf(s.log, "%s daemon: "+format+"\n", append([]any{Service}, args...)...)
	}
}

// New builds a Server. It does not bind a port until Run is called.
func New(opts Options) *Server {
	s := &Server{
		opts:             opts,
		hub:              newHub(),
		audit:            newAuditWriter(opts.AuditDir),
		staleReads:       newStaleGuard(),
		concurrentWrites: newConcurrentGuard(),
		writeHealth:      newWriteHealthTracker(),
		queueBlocks:      newQueueBlockTracker(),
		shutdown:         make(chan struct{}),
	}
	s.v2Session = fmt.Sprintf("daemon-%d", time.Now().UnixNano())
	s.v2Pending = make(map[string]v2Pending)
	s.v2 = executionv2.New(2048, s.validateV2, s.executeV2)
	s.v2.OnResolved(s.resolveV2)
	s.v2.OnResult(s.consumeV2Effects)
	s.v2.OnPersist(s.persistV2Snapshot)
	s.v2StartupErr = s.restoreV2Handoff()
	if s.v2StartupErr == nil {
		s.v2RestoredOwner = s.v2.EffectOwner()
		s.v2StartupErr = s.inspectV2Lifecycle()
	}
	return s
}

type health struct {
	V2EffectOwner   string                `json:"v2_effect_owner,omitempty"`
	V2Session       string                `json:"v2_session"`
	V2StartupFenced bool                  `json:"v2_startup_fenced"`
	V2LegacyOrphan  *v2LegacyOrphanStatus `json:"v2_legacy_orphan,omitempty"`
	Service         string                `json:"service"`
	Version         string                `json:"version"`
	SourceRevision  string                `json:"source_revision"`
	Status          string                `json:"status"`
	Port            int                   `json:"port"`
	Windows         []Window              `json:"windows"`
	// WriteHealth is the rolling per-window forwarded-action failure window
	// (writehealth.go): degraded=true flags a connector that is failing under
	// load (REPORT round2 新 3 — clients should insert light reads and verify
	// before any retry of a write). Rates are EFFECT-level — a call that
	// returned ok but was proven not to have landed counts as a failure — and
	// per-action buckets (actions / degradedActions) keep one broken road from
	// being averaged away. Omitted while no action has been forwarded.
	WriteHealth map[string]WindowWriteHealth `json:"writeHealth,omitempty"`
}

// routes builds the HTTP handlers. port is the bound port, reported in /health
// so callers can confirm which port in the range was selected.
func (s *Server) routes(port int) *http.ServeMux {
	mux := http.NewServeMux()
	if s.v2StartupErr != nil {
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) { http.Error(w, "V2_HANDOFF_RESTORE_FAILED", 503) })
		return mux
	}
	mux.HandleFunc("/v2/handoff", s.handleV2Handoff)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		// About uses the Host HTTP API; permit only this read-only public health response.
		w.Header().Set("Access-Control-Allow-Origin", "*")
		if r.Method != http.MethodGet {
			w.Header().Set("Allow", http.MethodGet)
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		enc := json.NewEncoder(w)
		enc.SetIndent("", "  ")
		_ = enc.Encode(health{
			V2Session:       s.v2Session,
			V2EffectOwner:   s.v2.EffectOwner(),
			V2StartupFenced: s.v2StartupFenced(),
			V2LegacyOrphan:  s.v2LegacyOrphan(),
			Service:         Service,
			Version:         s.opts.Version,
			SourceRevision:  s.opts.SourceRevision,
			Status:          "ok",
			Port:            port,
			Windows:         s.hub.listAnnotated(s.opts.Version),
			WriteHealth:     s.writeHealth.all(),
		})
	})
	mux.HandleFunc("/eda", s.handleConnect)
	mux.HandleFunc("/action", rejectLegacy)
	mux.HandleFunc("/v2/operations", s.handleV2)
	mux.HandleFunc("/v2/operation", s.handleV2Status)
	mux.HandleFunc("/v2/bind", s.handleV2Bind)
	mux.HandleFunc("/shutdown", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "POST required", http.StatusMethodNotAllowed)
			return
		}
		host, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil || net.ParseIP(host) == nil || !net.ParseIP(host).IsLoopback() {
			http.Error(w, "LOOPBACK_ONLY", http.StatusForbidden)
			return
		}
		s.stopOnce.Do(func() { close(s.shutdown) })
		writeV2(w, map[string]any{"service": Service, "shutdown": "accepted"})
	})
	// /writeverify is 通道 B of the write-health metric (writehealth.go): a
	// command that VERIFIED a write by reading the canvas back posts its verdict
	// here. Not a typed action on purpose — the verdict arrives after (and often
	// covers many of) the calls it judges, and keeping it daemon-local means the
	// connector never needs a rebuild for it.
	mux.HandleFunc("/writeverify", rejectLegacy)
	return mux
}

// listen binds the first free port in [PortStart, PortEnd] on Host.
func (s *Server) listen() (net.Listener, int, error) {
	host := s.opts.Host
	if host == "" {
		host = "127.0.0.1"
	}
	if s.opts.PortStart <= 0 || s.opts.PortEnd <= 0 || s.opts.PortStart > s.opts.PortEnd {
		return nil, 0, fmt.Errorf("invalid port range %d-%d", s.opts.PortStart, s.opts.PortEnd)
	}

	var lastErr error
	for port := s.opts.PortStart; port <= s.opts.PortEnd; port++ {
		ln, err := net.Listen("tcp", fmt.Sprintf("%s:%d", host, port))
		if err == nil {
			return ln, port, nil
		}
		lastErr = err
	}
	return nil, 0, fmt.Errorf("no free port in %d-%d: %w", s.opts.PortStart, s.opts.PortEnd, lastErr)
}

// Run binds a port, serves until ctx is cancelled, then shuts down gracefully.
func (s *Server) Run(ctx context.Context, log io.Writer) error {
	if s.v2StartupErr != nil {
		return fmt.Errorf("V2_HANDOFF_RESTORE_FAILED: %w", s.v2StartupErr)
	}
	listener, port, err := s.listen()
	if err != nil {
		return err
	}

	if err := s.markV2Running(); err != nil {
		listener.Close()
		return fmt.Errorf("V2_LIFECYCLE_MARK_FAILED: %w", err)
	}
	s.log = log
	s.connCtx, s.connCancel = context.WithCancel(context.Background())
	defer s.connCancel()

	httpServer := &http.Server{
		Handler:           s.routes(port),
		ReadHeaderTimeout: 5 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		errCh <- httpServer.Serve(listener)
	}()

	fmt.Fprintf(log, "%s daemon listening on http://%s:%d (health: /health, connector: /eda, operations: /v2/operations)\n", Service, s.opts.Host, port)
	if s.autosave != nil {
		s.logf("autosave on (debounce %s)", s.opts.AutosaveDebounce)
	}

	select {
	case <-ctx.Done():
	case <-s.shutdown:
	case err := <-errCh:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	}
	fmt.Fprintf(log, "%s daemon shutting down\n", Service)
	if s.opts.V2ReceiptFile != "" {
		if err := s.saveV2Handoff(); err != nil {
			listener.Close()
			return fmt.Errorf("V2_HANDOFF_SAVE_FAILED: %w", err)
		}
	}
	for _, c := range s.hub.connections() {
		notifyCtx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
		_ = c.write(notifyCtx, map[string]any{"type": "daemon_restarting", "retry_after_ms": 500})
		cancel()
	}
	s.autosave.stop()
	// Unblock connector read loops so their handlers return and Shutdown
	// does not wait the full timeout on long-lived WebSockets.
	s.connCancel()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return httpServer.Shutdown(shutdownCtx)
}
