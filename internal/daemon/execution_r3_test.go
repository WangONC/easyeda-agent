package daemon

import (
	"encoding/json"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"strings"
	"testing"

	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
	"github.com/zhoushoujianwork/easyeda-agent/internal/workflow"
)

func TestR3ConsumersPreserveUnresolvedEvidence(t *testing.T) {
	t.Setenv(workflow.EnvDir, t.TempDir())
	data, err := os.ReadFile("../protocol/testdata/execution.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Name     string
		Request  protocol.Request
		Response protocol.Response
	}
	if err = json.Unmarshal(data, &cases); err != nil {
		t.Fatal(err)
	}
	for _, c := range cases {
		if !strings.HasPrefix(c.Name, "r3_") {
			continue
		}
		t.Run(c.Name, func(t *testing.T) {
			c.Request.WindowID = "w"
			c.Request.Project = c.Name
			// Exercise the actual Connector projection before daemon consumers.
			c.Response.Execution = connectorExecution(t, c.Request, c.Response)
			for pass := 0; pass < 3; pass++ {
				c.Response.Execution = protocol.Interpret(&c.Request, &c.Response, false)
				if c.Response.Execution.RequestSatisfied || shouldAutosave(&c.Request, &c.Response) {
					t.Fatal("unresolved evidence granted success/save")
				}
				if effectFromResponse(&c.Request, &c.Response) != effectUnknown {
					t.Fatal("unresolved evidence became verified health failure")
				}
			}
			if strings.HasPrefix(c.Name, "r3_02") {
				g := newStaleGuard()
				g.observe(&c.Request, &c.Response)
				if g.last["w"] != "pcb.page.clear" {
					t.Fatal("preview suppressed observed side effects")
				}
				s := New(Options{})
				st, _ := workflow.Load(c.Name)
				st.Confirm(workflow.StagePlacementConfirmed, "old", "")
				_ = workflow.Save(st)
				s.maybeInvalidateStage(&c.Request, &c.Response)
				st, _ = workflow.Load(c.Name)
				if st.Has(workflow.StagePlacementConfirmed) {
					t.Fatal("preview side effects did not invalidate stage")
				}
			}
			if c.Name == "r3_05_invalid_unsettled" && (c.Response.Execution.NativeSettled == nil || *c.Response.Execution.NativeSettled) {
				t.Fatal("invalid structure lost unsettled flag")
			}
		})
	}
}

func TestR3RefusalDoesNotChangePriorStageOrStale(t *testing.T) {
	t.Setenv(workflow.EnvDir, t.TempDir())
	s := New(Options{})
	req := &protocol.Request{Action: "pcb.components.move", Project: "no-write", Envelope: protocol.Envelope{WindowID: "w"}}
	resp := &protocol.Response{OK: false}
	resp.Execution = protocol.Interpret(req, resp, true)
	st, _ := workflow.Load(req.Project)
	st.Confirm(workflow.StagePlacementConfirmed, "old", "")
	_ = workflow.Save(st)
	s.maybeInvalidateStage(req, resp)
	st, _ = workflow.Load(req.Project)
	if !st.Has(workflow.StagePlacementConfirmed) || shouldAutosave(req, resp) {
		t.Fatal("refusal changed stage or save permission")
	}
	g := newStaleGuard()
	g.last["w"] = "previous-write"
	g.observe(req, resp)
	if g.last["w"] != "previous-write" {
		t.Fatal("NO_WRITE cleared existing stale evidence")
	}
}

// Freeze the architectural boundary as well as behavioral examples: consumers
// cannot independently promote raw status or transport success to effect proof.
func TestCanonicalConsumersDoNotReadRawConclusions(t *testing.T) {
	for file, names := range map[string]map[string]bool{
		"autosave.go": {"shouldAutosave": true}, "writehealth.go": {"effectFromResponse": true},
		"stagegate.go": {"maybeInvalidateStage": true}, "stalereads.go": {"observe": true},
	} {
		tree, err := parser.ParseFile(token.NewFileSet(), file, nil, 0)
		if err != nil {
			t.Fatal(err)
		}
		for _, decl := range tree.Decls {
			f, ok := decl.(*ast.FuncDecl)
			if !ok || !names[f.Name.Name] {
				continue
			}
			ast.Inspect(f.Body, func(n ast.Node) bool {
				if s, ok := n.(*ast.SelectorExpr); ok {
					if base, ok := s.X.(*ast.Ident); ok && base.Name == "resp" && (s.Sel.Name == "OK" || s.Sel.Name == "Result" || s.Sel.Name == "Execution") {
						t.Errorf("%s.%s reads raw %s", file, f.Name, s.Sel.Name)
					}
				}
				return true
			})
		}
	}
}
