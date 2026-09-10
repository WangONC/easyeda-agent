// Generates the Connector/MCP projection of the existing ActionSpec catalog.
package main

import (
	"encoding/json"
	"github.com/zhoushoujianwork/easyeda-agent/internal/protocol"
	"os"
)

func main() {
	out := map[string]protocol.ActionContract{}
	for _, a := range protocol.AllActions() {
		out[a.Name] = a.Contract
	}
	b, e := json.MarshalIndent(out, "", "  ")
	if e != nil {
		panic(e)
	}
	if e = os.WriteFile("extension/src/action-contracts.json", append(b, '\n'), 0644); e != nil {
		panic(e)
	}
}
