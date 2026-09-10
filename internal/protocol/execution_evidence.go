package protocol

import (
	_ "embed"
	"encoding/json"
	"reflect"
	"strings"
)

// The shared inventory is the single raw/legacy fact adapter. Facts combine;
// request intent is deliberately absent. Fast receipt proofs are adapted below.
//
//go:embed execution-evidence.json
var evidenceInventoryJSON []byte

type evidenceAdapter struct {
	Field  string
	Test   string
	Facts  []string
	Sample any
	Shape  string
}

var evidenceInventory = func() []evidenceAdapter {
	var a []evidenceAdapter
	if err := json.Unmarshal(evidenceInventoryJSON, &a); err != nil {
		panic(err)
	}
	return a
}()

type evidenceSemantics map[string]bool

func adaptEvidence(v any) evidenceSemantics { return adaptReceiptFields(v, false) }
func adaptReceiptFields(v any, prewriteFast bool) evidenceSemantics {
	facts := evidenceSemantics{}
	r, ok := jsonValue(v).(map[string]any)
	if !ok {
		return facts
	}
	for _, a := range evidenceInventory {
		if prewriteFast && ((a.Field == "status" && (a.Test == "partial" || a.Test == "stale")) || a.Field == "readback_verified") {
			continue
		}
		value, present := r[a.Field]
		if !present {
			continue
		}
		matched := false
		switch a.Test {
		case "true":
			matched = value == true
		case "false":
			matched = value == false
		case "nonempty":
			matched = nonempty(value)
		case "positive":
			n, ok := value.(float64)
			matched = ok && n > 0
		case "applied":
			if items, ok := value.([]any); ok {
				for _, v := range items {
					if item, ok := v.(map[string]any); ok && item["status"] == "applied" {
						matched = true
					}
				}
			}
		default:
			matched = value == a.Test
		}
		if matched {
			for _, fact := range a.Facts {
				facts[fact] = true
			}
		}
	}
	return facts
}

// receiptFacts is ephemeral input to the unchanged R3 reconciliation flow.
type receiptFacts struct {
	side                                                                    evidenceSemantics
	fastNoWrite, fastPartial, fastComplete, recoveryConflict, itemsConflict bool
	acknowledged, saveAcknowledged, delivered, pending, restored, reload    bool
	items                                                                   any
}

func normalizeReceipt(f *executionFacts) receiptFacts {
	r, p := f.raw, f.prior
	n := receiptFacts{side: adaptEvidence(r), items: r["item_results"], acknowledged: f.resp != nil && f.resp.OK && r["ok"] != false && r["saved"] != false, saveAcknowledged: r["saved"] == true, restored: r["rollback_complete"] == true}
	// Bare legacy write_attempted:false is not a global absence proof.
	if !(f.contract.DryRun == "preview" && f.preview && r["dryRun"] == true && r["native_settled"] == true) {
		delete(n.side, "absence")
	}
	if f.req.Action == "route.apply_batch" {
		n.fastNoWrite = (r["status"] == "stale" || r["status"] == "partial") && r["mutation_started"] == false && fastNoWrite(r)
		n.fastPartial = r["status"] == "partial" && fastSettled(r, f.req.Payload, false)
		n.fastComplete = r["status"] == "complete" && fastComplete(r, f.req.Payload)
		// Fast partial/stale before-dispatch receipts are stronger than the status alone.
		if n.fastNoWrite {
			n.side = adaptReceiptFields(r, true)
			n.side["absence"] = true
		}
		if p != nil {
			n.recoveryConflict = (r["status"] == "complete" && p.Recovery["state"] != "NOT_REQUESTED") || (p.Recovery["state"] == "RESTORED" && (r["rollback_attempted"] != true || r["rollback_complete"] != true))
			n.itemsConflict = p.ItemResults != nil && !reflect.DeepEqual(jsonValue(p.ItemResults), jsonValue(n.items))
		}
	}
	if f.resp != nil {
		n.delivered = len(f.resp.Artifacts) > 0
		for _, a := range f.resp.Artifacts {
			n.delivered = n.delivered && a.Path != "" && a.SHA256 != ""
		}
		n.pending = pendingArtifacts(f.resp)
	}
	code, _ := f.req.Payload["code"].(string)
	n.reload = f.req.Action == "debug.exec_js" && strings.Contains(code, "closeDocument")
	return n
}

// Inventory shape validation covers every added adapter automatically.
func validAdapterFields(r map[string]any) bool {
	for _, a := range evidenceInventory {
		v, has := r[a.Field]
		if !has {
			continue
		}
		valid := false
		switch a.Shape {
		case "boolean":
			_, valid = v.(bool)
		case "string":
			_, valid = v.(string)
		case "collection":
			switch v.(type) {
			case []any, map[string]any:
				valid = true
			}
		case "boolean-or-collection":
			switch v.(type) {
			case bool, []any, map[string]any:
				valid = true
			}
		case "count":
			n, ok := v.(float64)
			valid = ok && n >= 0 && n == float64(int(n))
		case "items":
			valid = validItems(v)
		}
		if !valid {
			return false
		}
	}
	return true
}
