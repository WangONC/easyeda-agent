//go:build ignore

// Read-only baseline API inventory. This is an audit tool, not a runtime registry.
package main

import (
	"encoding/json"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"os/exec"
	"sort"
	"strconv"
)

type entry struct {
	Name        string         `json:"action"`
	Description string         `json:"baseline_description"`
	Inputs      []string       `json:"baseline_inputs"`
	Outputs     []string       `json:"baseline_outputs"`
	Source      string         `json:"baseline_source"`
	V2          map[string]any `json:"v2,omitempty"`
}

func stringValue(expr ast.Expr) string {
	switch x := expr.(type) {
	case *ast.BasicLit:
		if x.Kind == token.STRING {
			v, _ := strconv.Unquote(x.Value)
			return v
		}
	case *ast.BinaryExpr:
		if x.Op == token.ADD {
			return stringValue(x.X) + stringValue(x.Y)
		}
	}
	return ""
}
func stringsValue(expr ast.Expr) []string {
	values := []string{}
	if x, ok := expr.(*ast.CompositeLit); ok {
		for _, item := range x.Elts {
			values = append(values, stringValue(item))
		}
	}
	return values
}
func main() {
	generated, err := os.ReadFile("extension/src/v2-catalog.generated.json")
	if err != nil {
		panic(err)
	}
	v2 := map[string]map[string]any{}
	if err = json.Unmarshal(generated, &v2); err != nil {
		panic(err)
	}
	rows := []entry{}
	seen := map[string]bool{}
	for _, path := range []string{"internal/protocol/actions.go", "internal/protocol/actions_closure.go"} {
		source, err := exec.Command("git", "show", "a583bf731d946d2d39f1223e078d711bd41710d5:"+path).Output()
		if err != nil {
			panic(err)
		}
		positions := token.NewFileSet()
		file, err := parser.ParseFile(positions, path, source, 0)
		if err != nil {
			panic(err)
		}
		ast.Inspect(file, func(node ast.Node) bool {
			literal, ok := node.(*ast.CompositeLit)
			if !ok {
				return true
			}
			row := entry{Inputs: []string{}, Outputs: []string{}}
			for _, element := range literal.Elts {
				kv, ok := element.(*ast.KeyValueExpr)
				if !ok {
					continue
				}
				key, ok := kv.Key.(*ast.Ident)
				if !ok {
					continue
				}
				switch key.Name {
				case "Name":
					row.Name = stringValue(kv.Value)
				case "Description":
					row.Description = stringValue(kv.Value)
				case "Inputs":
					row.Inputs = stringsValue(kv.Value)
				case "Outputs":
					row.Outputs = stringsValue(kv.Value)
				}
			}
			if row.Name != "" {
				if seen[row.Name] {
					panic("duplicate baseline action: " + row.Name)
				}
				seen[row.Name] = true
				row.Source = fmt.Sprintf("%s:%d", path, positions.Position(literal.Pos()).Line)
				row.V2 = v2[row.Name]
				rows = append(rows, row)
			}
			return true
		})
	}
	for name := range v2 {
		if !seen[name] {
			panic("V2 action absent from baseline: " + name)
		}
	}
	sort.Slice(rows, func(i, j int) bool { return rows[i].Name < rows[j].Name })
	output := json.NewEncoder(os.Stdout)
	output.SetIndent("", "  ")
	if err := output.Encode(rows); err != nil {
		panic(err)
	}
}
