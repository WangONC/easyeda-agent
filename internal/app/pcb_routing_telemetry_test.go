package app

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"reflect"
	"testing"

	"github.com/zhoushoujianwork/easyeda-agent/internal/fastpath"
)

func telemetryLine(net string, layer int, points ...fastpath.Point) fastpath.Primitive {
	return fastpath.Primitive{Kind: "trace", Net: net, Layer: layer, Points: points}
}
func TestRoutingTelemetryStatistics(t *testing.T) {
	s := fastpath.Snapshot{Revision: "r", Layers: []int{1, 2}, Traces: []fastpath.Primitive{
		telemetryLine("N", 1, fastpath.Point{0, 0}, fastpath.Point{10, 0}, fastpath.Point{10, 0}),
		telemetryLine("N", 2, fastpath.Point{0, 0}, fastpath.Point{0, 20}),
		{Kind: "arc", Net: "A", Layer: 1, ArcLength: 15, Points: []fastpath.Point{{0, 0}, {10, 10}}},
		telemetryLine("A", 3, fastpath.Point{0, 0}, fastpath.Point{999, 0}),
	}, Vias: []fastpath.Primitive{{Net: "N"}}}
	result, err := routingTelemetry(s, []string{"N", "A", "unrouted"}, nil, false)
	if err != nil {
		t.Fatal(err)
	}
	b := result["summary"].(*routingStats)
	if b.Total != 45 || b.Traces != 2 || b.Arcs != 1 || b.Vias != 1 {
		t.Fatal(b)
	}
	if b.Segments.Count != 4 || *b.Segments.Min != 0 || *b.Segments.Median != 10 || *b.Segments.P90 != 20 || *b.Segments.Max != 20 {
		t.Fatal(b.Segments)
	}
	if b.Orientation[0].Count != 1 || b.Orientation[6].Length != 20 {
		t.Fatal(b.Orientation)
	}
	count := 0
	for _, bucket := range b.Orientation {
		count += bucket.Count
	}
	if count != 2 {
		t.Fatal("arc or zero entered histogram")
	}
	if !reflect.DeepEqual(b.Layers, []routingLayer{{Layer: 1, TraceLength: 25, TraceCount: 2}, {Layer: 2, TraceLength: 20, TraceCount: 1}}) {
		t.Fatal(b.Layers)
	}
	d := result["netLengthDistribution"].(routingDistribution)
	if d.Count != 2 || *d.Min != 15 || *d.Median != 15 || *d.Max != 30 {
		t.Fatal(d)
	}
	if _, ok := result["nets"]; ok {
		t.Fatal("board leaks net details")
	}
	scoped, err := routingTelemetry(s, []string{"N", "A"}, []string{"N", "N"}, true)
	if err != nil {
		t.Fatal(err)
	}
	rows := scoped["nets"].([]*routingStats)
	if len(rows) != 1 || rows[0].Net != "N" || rows[0].Total != 30 || rows[0].Arcs != 0 {
		t.Fatal(rows)
	}
	if _, err = routingTelemetry(s, []string{"N"}, []string{"missing"}, true); err == nil {
		t.Fatal("missing net accepted")
	}
	empty, err := routingTelemetry(fastpath.Snapshot{}, nil, nil, false)
	if err != nil {
		t.Fatal(err)
	}
	e := empty["summary"].(*routingStats)
	if e.Segments.Count != 0 || e.Segments.Min != nil || e.Segments.P90 != nil {
		t.Fatal(e)
	}
	if _, err = json.Marshal(empty); err != nil {
		t.Fatal(err)
	}
	s.Traces[0].Unsupported = true
	if _, err = routingTelemetry(s, []string{"N"}, nil, false); err == nil {
		t.Fatal("unknown geometry accepted")
	}
}
func TestRoutingTelemetryOrientation(t *testing.T) {
	for _, sample := range []struct {
		angle  float64
		bucket int
	}{{0, 0}, {45, 3}, {90, 6}, {135, 9}, {22, 1}, {37, 2}, {179, 0}, {173, 0}, {7.49, 0}, {7.51, 1}, {172.49, 11}, {172.51, 0}} {
		angle := sample.angle
		for _, reverse := range []bool{false, true} {
			a, b := fastpath.Point{0, 0}, fastpath.Point{10 * math.Cos(angle*math.Pi/180), 10 * math.Sin(angle*math.Pi/180)}
			if reverse {
				a, b = b, a
			}
			s := fastpath.Snapshot{Layers: []int{1}, Traces: []fastpath.Primitive{telemetryLine("N", 1, a, b)}}
			result, err := routingTelemetry(s, []string{"N"}, nil, false)
			if err != nil {
				t.Fatal(err)
			}
			buckets := result["summary"].(*routingStats).Orientation
			if buckets[sample.bucket].Count != 1 || buckets[sample.bucket].Center != sample.bucket*15 {
				t.Fatalf("angle=%v reverse=%v: %v", angle, reverse, buckets)
			}
		}
	}
}
func TestRoutingTelemetryReadPath(t *testing.T) {
	for _, size := range []int{8, 32} {
		t.Run(fmt.Sprint(size), func(t *testing.T) {
			names := []string{}
			netRows := []any{}
			traces := []fastpath.Primitive{}
			for i := 0; i < size; i++ {
				n := fmt.Sprintf("N%d", i)
				names = append(names, n)
				netRows = append(netRows, map[string]any{"net": n})
				traces = append(traces, telemetryLine(n, 1, fastpath.Point{0, 0}, fastpath.Point{10, 0}))
			}
			cfg, daemon, closeDaemon := newAutolayoutTestDaemon(t, func(_ int, c autolayoutTestCall) string {
				result := map[string]any{}
				switch c.Action {
				case "document.current":
					result["document"] = map[string]any{"uuid": "d", "documentType": 3}
				case "schematic.pages.list":
					result["pages"] = []any{}
				case "pcb.documents.list":
					result["pcbs"] = []any{map[string]any{"uuid": "d", "parentProjectUuid": "p"}}
				case "pcb.nets.list":
					result["nets"] = netRows
				case "board.snapshot_compact":
					result = map[string]any{"board_revision": "r", "copper_layers": []int{1}, "traces": traces}
				default:
					t.Errorf("unexpected telemetry action %s", c.Action)
				}
				data, _ := json.Marshal(map[string]any{"ok": true, "result": result, "context": map[string]any{"projectUuid": "p", "documentUuid": "d", "documentType": "pcb"}})
				return string(data)
			})
			defer closeDaemon()
			payload, _ := json.Marshal(map[string]any{"telemetry": true, "project_uuid": "p", "document_uuid": "d", "nets": names})
			var out, stderr bytes.Buffer
			if err := pcbReportScoped(cfg, "w1", string(payload), &out, &stderr); err != nil {
				t.Fatal(err, stderr.String())
			}
			counts := map[string]int{}
			for _, c := range daemon.snapshot() {
				counts[c.Action]++
				if c.Action == "board.snapshot_compact" {
					include := c.Payload["include"].(map[string]any)
					if include["pads"] != false || include["components"] != false || include["fills"] != false {
						t.Fatal(include)
					}
				}
			}
			if counts["pcb.nets.list"] != 1 || counts["board.snapshot_compact"] != 1 || len(daemon.snapshot()) != 5 {
				t.Fatal(counts)
			}
			var response struct {
				Result struct {
					Telemetry struct {
						Nets []routingStats `json:"nets"`
					} `json:"routingTelemetry"`
				}
			}
			if err := json.Unmarshal(out.Bytes(), &response); err != nil {
				t.Fatal(err)
			}
			if len(response.Result.Telemetry.Nets) != size {
				t.Fatal(out.String())
			}
		})
	}
}
func TestRoutingTelemetryDefaultUnchanged(t *testing.T) {
	cfg, daemon, closeDaemon := newAutolayoutTestDaemon(t, func(_ int, c autolayoutTestCall) string {
		if c.Action != "pcb.report" {
			t.Fatal(c.Action)
		}
		return `{"ok":true,"result":{"nets":[],"units":"mil"}}`
	})
	defer closeDaemon()
	for _, payload := range []string{"{}", `{"telemetry":false}`} {
		var out, stderr bytes.Buffer
		if err := pcbReportScoped(cfg, "w1", payload, &out, &stderr); err != nil {
			t.Fatal(err)
		}
		var envelope map[string]any
		if json.Unmarshal(out.Bytes(), &envelope) != nil || !reflect.DeepEqual(envelope["result"], map[string]any{"nets": []any{}, "units": "mil"}) || envelope["execution"] == nil {
			t.Fatal(out.String())
		}
	}
	if len(daemon.snapshot()) != 2 {
		t.Fatal(daemon.snapshot())
	}
}

func TestRoutingTelemetryRoutedDistribution(t *testing.T) {
	for _, routed := range []int{0, 1, 2} {
		s := fastpath.Snapshot{Layers: []int{1}}
		names := []string{"A", "B"}
		for i := 0; i < routed; i++ {
			s.Traces = append(s.Traces, telemetryLine(names[i], 1, fastpath.Point{0, 0}, fastpath.Point{10, 0}))
		}
		result, err := routingTelemetry(s, names, nil, false)
		if err != nil {
			t.Fatal(err)
		}
		if result["netCount"] != 2 || result["routedNetCount"] != routed || result["unroutedNetCount"] != 2-routed {
			t.Fatal(result)
		}
		d := result["netLengthDistribution"].(routingDistribution)
		if d.Count != routed {
			t.Fatal(d)
		}
		if routed == 0 {
			if d.Min != nil || d.Median != nil || d.P90 != nil || d.Max != nil {
				t.Fatal(d)
			}
		} else {
			if *d.Min != 10 || *d.Median != 10 || *d.P90 != 10 || *d.Max != 10 {
				t.Fatal(d)
			}
		}
	}
}

func TestRoutingTelemetryCopperComposition(t *testing.T) {
	line := telemetryLine("L", 1, fastpath.Point{0, 0}, fastpath.Point{10, 0})
	arc := fastpath.Primitive{Kind: "arc", Net: "A", Layer: 1, ArcLength: 15, Points: []fastpath.Point{{0, 0}, {10, 10}}}
	for _, tc := range []struct {
		name                  string
		traces                []fastpath.Primitive
		selected              []string
		lineLength, arcLength float64
		lines, arcs, vias     int
	}{
		{"line", []fastpath.Primitive{line}, nil, 10, 0, 1, 0, 2},
		{"arc", []fastpath.Primitive{arc}, nil, 0, 15, 0, 1, 2},
		{"mixed", []fastpath.Primitive{line, arc}, nil, 10, 15, 1, 1, 2},
		{"scoped line", []fastpath.Primitive{line, arc}, []string{"L"}, 10, 0, 1, 0, 1},
		{"scoped arc", []fastpath.Primitive{line, arc}, []string{"A"}, 0, 15, 0, 1, 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := fastpath.Snapshot{Layers: []int{1}, Traces: tc.traces, Vias: []fastpath.Primitive{{Net: "L"}, {Net: "A"}}}
			result, err := routingTelemetry(s, []string{"L", "A"}, tc.selected, tc.selected != nil)
			if err != nil {
				t.Fatal(err)
			}
			var r *routingStats
			if tc.selected != nil {
				r = result["nets"].([]*routingStats)[0]
			} else {
				r = result["summary"].(*routingStats)
			}
			if r.Lines != tc.lines || r.Traces != r.Lines || r.Arcs != tc.arcs || r.Vias != tc.vias || r.LineLength != tc.lineLength || r.ArcLength != tc.arcLength || r.Total != r.LineLength+r.ArcLength {
				t.Fatalf("%+v", r)
			}
			orientationLength := 0.0
			orientationCount := 0
			for _, b := range r.Orientation {
				orientationLength += b.Length
				orientationCount += b.Count
			}
			if orientationLength != r.LineLength || orientationCount != tc.lines {
				t.Fatal(r.Orientation)
			}
			data, err := json.Marshal(r)
			if err != nil {
				t.Fatal(err)
			}
			var fields map[string]any
			json.Unmarshal(data, &fields)
			for _, key := range []string{"lineCount", "lineLength", "arcCount", "arcLength", "viaCount", "totalCopperLength"} {
				if _, ok := fields[key]; !ok {
					t.Fatal("missing field", key)
				}
			}
			for _, key := range []string{"fillCount", "polygonCount", "pourCount"} {
				if _, ok := fields[key]; ok {
					t.Fatal("unobserved area count", key)
				}
			}
		})
	}
}
