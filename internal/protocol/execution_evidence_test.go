package protocol

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"strings"
	"testing"
)

func TestEvidenceNormalizationBoundary(t *testing.T) {
	tree, err := parser.ParseFile(token.NewFileSet(), "execution_reducer.go", nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	for _, d := range tree.Decls {
		f, ok := d.(*ast.FuncDecl)
		if !ok || (f.Name.Name != "reconcileExecution" && f.Name.Name != "deriveExecution") {
			continue
		}
		ast.Inspect(f.Body, func(n ast.Node) bool {
			if s, ok := n.(*ast.SelectorExpr); ok && (s.Sel.Name == "raw" || s.Sel.Name == "Result" || s.Sel.Name == "OK") {
				t.Errorf("%s reinterprets raw %s", f.Name, s.Sel.Name)
			}
			return true
		})
	}
	b, err := os.ReadFile("../../extension/src/execution.ts")
	if err != nil {
		t.Fatal(err)
	}
	s := string(b)
	start := strings.Index(s, "function reconcileExecution(")
	end := strings.Index(s, "// Shared inventory:")
	if start < 0 || end < start {
		t.Fatal("missing boundary")
	}
	for _, forbidden := range []string{"f.raw", ".result", ".ok", "negativeResult(", "fastSettled(", "fastComplete("} {
		if strings.Contains(s[start:end], forbidden) {
			t.Errorf("TS reducer reads %s", forbidden)
		}
	}
	for _, a := range evidenceInventory {
		if a.Field == "" || a.Shape == "" || len(a.Facts) == 0 {
			t.Fatal("incomplete adapter", a)
		}
		sample := map[string]any{a.Field: a.Sample}
		if !validAdapterFields(sample) {
			t.Fatal("unvalidated adapter", a.Field)
		}
		facts := adaptEvidence(sample)
		for _, fact := range a.Facts {
			if !facts[fact] {
				t.Fatal("adapter not exercised", a.Field, fact)
			}
		}
		sample[a.Field] = nil
		if validAdapterFields(sample) {
			t.Fatal("null adapter accepted", a.Field)
		}
	}
}

func TestOracleIndependentOfProductionFacts(t *testing.T) {
	for _, file := range []string{"../../scripts/execution-semantic-oracle.cjs", "../../scripts/execution-evidence-properties.cjs"} {
		b, err := os.ReadFile(file)
		if err != nil {
			t.Fatal(err)
		}
		if strings.Contains(string(b), ".facts") || strings.Contains(string(b), "['facts']") {
			t.Fatal(file, "oracle reads production facts")
		}
	}
}
