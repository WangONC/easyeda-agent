package app

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/binary"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"github.com/spf13/cobra"
	"github.com/zhoushoujianwork/easyeda-agent/internal/fastpath"
	"github.com/zhoushoujianwork/easyeda-agent/internal/workflow"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf16"
)

// Count the explicit metric round-hit dialect emitted by the accepted Host.
// Routed slots, repeats, implicit coordinates and other dialects stay unresolved.
func nativeDrillHits(text string) ([]string, error) {
	if !strings.Contains(text, "METRIC,LZ,0000.000000") {
		return nil, fmt.Errorf("unsupported drill units/format")
	}
	toolRE := regexp.MustCompile(`^T([0-9]+)C([0-9]+\.[0-9]+)$`)
	hitRE := regexp.MustCompile(`^X(-?[0-9]+(?:\.[0-9]+)?)Y(-?[0-9]+(?:\.[0-9]+)?)$`)
	selectRE := regexp.MustCompile(`^T[0-9]+$`)
	tools := map[string]string{}
	diameter := ""
	hits := []string{}
	seen := map[string]bool{}
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, ";") || line == "M48" || line == "%" || line == "G05" || line == "G90" || line == "M30" || line == "METRIC,LZ,0000.000000" {
			continue
		}
		if m := toolRE.FindStringSubmatch(line); m != nil {
			tools["T"+m[1]] = m[2]
			continue
		}
		if selectRE.MatchString(line) {
			diameter = tools[line]
			if diameter == "" {
				return nil, fmt.Errorf("undefined drill tool")
			}
			continue
		}
		if m := hitRE.FindStringSubmatch(line); m != nil && diameter != "" {
			// Nonzero undotted coordinates may be zero-suppressed integers; do not guess.
			for _, v := range m[1:] {
				if !strings.Contains(v, ".") && v != "0" && v != "-0" {
					return nil, fmt.Errorf("ambiguous drill coordinate")
				}
			}
			x, _ := strconv.ParseFloat(m[1], 64)
			y, _ := strconv.ParseFloat(m[2], 64)
			d, _ := strconv.ParseFloat(diameter, 64)
			if d <= 0 {
				return nil, fmt.Errorf("invalid drill diameter")
			}
			key := fmt.Sprintf("%.6f,%.6f,%.6f", x, y, d)
			if seen[key] {
				return nil, fmt.Errorf("duplicate drill hit within program")
			}
			seen[key] = true
			hits = append(hits, key)
			continue
		}
		return nil, fmt.Errorf("unsupported drill command %q", line)
	}
	return hits, nil
}

func inspectManufacturingFile(a artifactRef) (map[string]any, error) {
	f, e := os.Open(a.Path)
	if e != nil {
		return nil, e
	}
	defer f.Close()
	st, e := f.Stat()
	if e != nil {
		return nil, e
	}
	if st.Size() == 0 || st.Size() > 256<<20 {
		return nil, fmt.Errorf("empty or oversized export")
	}
	hash := sha256.New()
	if _, e = io.Copy(hash, f); e != nil {
		return nil, e
	}
	result := map[string]any{"file": a.Path, "file_name": a.FileName, "bytes": st.Size(), "sha256": fmt.Sprintf("%x", hash.Sum(nil)), "format": a.Kind, "structure_verified": false}
	if a.Kind == "manufacturing_gerber" {
		archive, e := zip.OpenReader(a.Path)
		if e != nil {
			return result, e
		}
		defer archive.Close()
		if len(archive.File) > 512 {
			return result, fmt.Errorf("archive exceeds 512 entries")
		}
		gerber, drill, pth, npth := []string{}, []string{}, []string{}, []string{}
		members := []map[string]any{}
		pthHits, npthHits := map[string]bool{}, map[string]bool{}
		total := uint64(0)
		for _, entry := range archive.File {
			total += entry.UncompressedSize64
			if total > 256<<20 {
				return result, fmt.Errorf("archive uncompressed size exceeds limit")
			}
			if entry.FileInfo().IsDir() {
				continue
			}
			if entry.UncompressedSize64 > 32<<20 {
				return result, fmt.Errorf("oversized archive member")
			}
			reader, e := entry.Open()
			if e != nil {
				return result, e
			}
			data, e := io.ReadAll(io.LimitReader(reader, 32<<20))
			reader.Close()
			if e != nil {
				return result, e
			}
			text := strings.ToUpper(string(data))
			name := strings.ToUpper(entry.Name)
			if strings.Contains(text, "%FS") && strings.Contains(text, "M02*") {
				gerber = append(gerber, entry.Name)
				members = append(members, map[string]any{"artifact": a.Path, "member": entry.Name, "sha256": fmt.Sprintf("%x", sha256.Sum256(data)), "category": "Gerber", "status": "structure_verified"})
			}
			if strings.Contains(text, "M48") && (strings.Contains(text, "M30") || strings.Contains(text, "M00")) {
				drill = append(drill, entry.Name)
				hits, err := nativeDrillHits(text)
				if err != nil {
					return result, fmt.Errorf("%s: %w", entry.Name, err)
				}
				category := "UNKNOWN"
				if strings.Contains(name, "NPTH") {
					category = "NPTH"
					for _, hit := range hits {
						npthHits[hit] = true
					}
				} else if strings.Contains(name, "PTH") {
					category = "PTH"
					for _, hit := range hits {
						pthHits[hit] = true
					}
				}
				if category == "UNKNOWN" {
					return result, fmt.Errorf("unclassified drill program")
				}
				status := "structure_verified"
				if len(hits) == 0 {
					status = "EMPTY_UNCONFIRMED"
				}
				members = append(members, map[string]any{"artifact": a.Path, "member": entry.Name, "sha256": fmt.Sprintf("%x", sha256.Sum256(data)), "category": category, "status": status, "units": "mm", "hole_count": len(hits)})
				if strings.Contains(name, "NPTH") || strings.Contains(name, "NONPLATED") || strings.Contains(name, "NON-PLATED") {
					npth = append(npth, entry.Name)
				} else if strings.Contains(name, "PTH") || strings.Contains(name, "PLATED") {
					pth = append(pth, entry.Name)
				}
			}
		}
		result["members"] = members
		result["pth_hole_count"] = len(pthHits)
		result["npth_hole_count"] = len(npthHits)
		result["count_semantics"] = "unique coordinate/diameter hits per plating category; aggregate/via subset programs deduplicated"
		for hit := range npthHits {
			if pthHits[hit] {
				return result, fmt.Errorf("same drill hit in PTH and NPTH")
			}
		}
		result["gerber_files"] = gerber
		result["drill_files"] = drill
		result["plated_drill_files"] = pth
		result["non_plated_drill_files"] = npth
		result["structure_verified"] = len(gerber) > 0 && len(pth) > 0 && len(npth) > 0 && len(pthHits) > 0 && len(npthHits) > 0
		result["layer_mapping"] = "requires review of native filenames/FileFunction against requested profile"
		if result["structure_verified"] != true {
			return result, fmt.Errorf("archive lacks recognizable Gerber plus distinct plated/nonplated drill files")
		}
	} else {
		if _, e = f.Seek(0, 0); e != nil {
			return result, e
		}
		raw, e := io.ReadAll(f)
		if e != nil {
			return result, e
		}
		text := string(raw)
		encoding := "UTF-8"
		if len(raw) >= 2 && raw[0] == 0xff && raw[1] == 0xfe {
			if len(raw)%2 != 0 {
				return result, fmt.Errorf("odd UTF-16LE byte length")
			}
			units := make([]uint16, (len(raw)-2)/2)
			for i := range units {
				units[i] = binary.LittleEndian.Uint16(raw[2+i*2:])
			}
			text = string(utf16.Decode(units))
			encoding = "UTF-16LE"
		}
		reader := csv.NewReader(strings.NewReader(text))
		headerLine := strings.SplitN(text, "\n", 2)[0]
		if strings.Contains(headerLine, "\t") {
			reader.Comma = '\t'
			result["delimiter"] = "tab"
		} else {
			result["delimiter"] = "comma"
		}
		result["encoding"] = encoding
		reader.FieldsPerRecord = -1
		rows, e := reader.ReadAll()
		if e != nil {
			return result, e
		}
		if len(rows) < 2 || len(rows[0]) < 2 {
			return result, fmt.Errorf("CSV lacks header and data rows")
		}
		header := rows[0]
		for i, h := range header {
			header[i] = strings.TrimPrefix(h, "\ufeff")
		}
		for _, row := range rows[1:] {
			if len(row) != len(header) {
				return result, fmt.Errorf("CSV row shape differs from header")
			}
		}
		result["columns"] = header
		result["row_count"] = len(rows) - 1
		result["structure_verified"] = true
		if a.Kind == "manufacturing_pnp" {
			result["placement_count"] = len(rows) - 1
			result["units"] = "mm"
		}
		if a.Kind == "manufacturing_bom" {
			quantity := -1
			for i, h := range header {
				h = strings.ToLower(strings.TrimSpace(h))
				if h == "quantity" || h == "qty" || h == "数量" {
					quantity = i
				}
			}
			result["component_count"] = nil
			if quantity >= 0 {
				count := 0
				valid := true
				for _, r := range rows[1:] {
					n, e := strconv.Atoi(strings.TrimSpace(r[quantity]))
					if e != nil || n <= 0 {
						valid = false
						break
					}
					count += n
				}
				if valid {
					result["component_count"] = count
				}
			}
			if result["component_count"] == nil {
				result["warning"] = "BOM quantity column unresolved; row count is not component count"
			}
		}
	}
	return result, nil
}
func addManufacturingExport(pcb *cobra.Command, cfg *appConfig, stdout, stderr io.Writer) {
	var payload, window string
	c := &cobra.Command{Use: "manufacturing-export", Short: "Native manufacturing files with SHA256 and basic structure manifest", Args: cobra.NoArgs, RunE: func(_ *cobra.Command, _ []string) error {
		var p map[string]any
		if e := json.Unmarshal([]byte(payload), &p); e != nil {
			return e
		}
		doc, _ := p["document_uuid"].(string)
		project, _ := p["project_uuid"].(string)
		if doc == "" || project == "" {
			return fmt.Errorf("explicit project_uuid/document_uuid required")
		}
		pinned := *cfg
		pinned.doc = doc
		pinned.project = project
		cfg = &pinned
		scope := map[string]any{"project_uuid": project, "document_uuid": doc, "include": map[string]bool{"components": false, "pads": false, "traces": false, "vias": false, "fills": false}}
		before, e := requestAction(cfg, "board.snapshot_compact", window, scope)
		if e != nil {
			return e
		}
		native, e := requestActionTimed(cfg, "pcb.manufacturing.export", window, p, 120*time.Second)
		if e != nil {
			return e
		}
		after, e := requestAction(cfg, "board.snapshot_compact", window, scope)
		if e != nil {
			return e
		}
		complete := native.Result["status"] == "unverified" && len(native.Artifacts) == 3 && sameObservedContent(before, after)
		files := []map[string]any{}
		warnings := []string{"Basic structure validation does not certify DFM or fabrication correctness. Review native layer mapping against export profile."}
		for _, a := range native.Artifacts {
			r, e := inspectManufacturingFile(a)
			if e != nil {
				complete = false
				warnings = append(warnings, a.FileName+": "+e.Error())
			}
			files = append(files, r)
		}
		status := "partial"
		if complete {
			status = "structure_verified"
		}
		manifest := map[string]any{"status": status, "project_uuid": project, "document_uuid": doc, "revision": after.Result["board_revision"], "revision_before": before.Result["board_revision"], "export_profile": p["profile"], "relevant_verification_ids": p["verification_ids"], "files": files, "warnings": warnings, "native_api_call_count": native.Result["native_api_call_count"], "native_duration_ms": native.Result["duration_ms"]}
		id := fastpath.Hash(manifest)
		path := filepath.Join(workflow.Dir(), "export-manifests", id+".json")
		if e = os.MkdirAll(filepath.Dir(path), 0700); e != nil {
			return e
		}
		b, e := json.MarshalIndent(manifest, "", "  ")
		if e != nil {
			return e
		}
		if e = os.WriteFile(path, b, 0600); e != nil {
			return e
		}
		manifest["manifest_file"] = path
		manifest["manifest_id"] = id
		if e = json.NewEncoder(stdout).Encode(map[string]any{"ok": complete, "result": manifest}); e != nil {
			return e
		}
		if !complete {
			return errActionFailed
		}
		return nil
	}}
	c.Flags().StringVar(&payload, "payload", "{}", "Explicit identity and reviewed export profile")
	c.Flags().StringVar(&window, "window", "", "Connector window ID")
	pcb.AddCommand(c)
}
