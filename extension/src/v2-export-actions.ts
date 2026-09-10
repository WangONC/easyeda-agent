import { type NativeAction, observed, unavailable } from './execution-v2';
import { array, declaredReadFields } from './v2-native-actions';
import { type ResponseArtifact } from './protocol';
type Pack = (blob: Blob, kind: string, name: string, mime: string) => Promise<ResponseArtifact>;
interface Assets {
    pack: Pack;
    sha: (blob: Blob) => Promise<string | null>;
    settle: () => Promise<void>;
    inject: (text: string) => Promise<{
        text: string;
        count: number;
    }>;
    formats: Record<string, {
        fileType: string;
        ext: string;
        mime: string;
    }>;
    objects: Record<string, string>;
}
// Export completion proves native file delivery, not circuit/manufacturing qualification.
export function exportAction(action: string, assets: Assets): NativeAction {
    return { mode: 'V2_NATIVE', scope: 'UI_NATIVE', validate: declaredReadFields(action), run: async (c) => {
            const p = c.request.input;
            let blob: Blob | undefined, artifact: ResponseArtifact | undefined, value: Record<string, unknown> = {}, mime = '', name = '', kind = '', deliveryComplete = false;
            let requestedSelection: string[] | undefined;
            if (action === 'pcb.snapshot' && p.tabId !== undefined && p.tabId !== c.request.target_ref.tab_id)
                throw Error('V2_TARGET_MISMATCH');
            c.prepare(async () => {
                if (!deliveryComplete || !blob || blob.size === 0)
                    return { changed: null, verification: unavailable() };
                if (requestedSelection) {
                    const selected = array(await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId());
                    if (selected.length !== requestedSelection.length || requestedSelection.some(id => !selected.includes(id)))
                        return { changed: null, verification: unavailable() };
                }
                if (!artifact)
                    artifact = await assets.pack(blob, kind, name, mime);
                return { ...observed({ ...value, artifactId: artifact.id }, ['native_file_delivered', 'artifact_bytes_available', ...(requestedSelection ? ['fresh_export_selection_identity'] : [])], null), evidence: { artifact_delivery: 'v2', artifacts: [artifact] } };
            });
            if (action === 'schematic.export.netlist') {
                let file: File | undefined;
                await c.effect(async () => { file = await eda.sch_ManufactureData.getNetlistFile(p.fileName as string | undefined, p.netlistType as ESYS_NetlistType | undefined); blob = file; });
                if (file) {
                    name = file.name || `${p.fileName ?? 'netlist'}.net`;
                    kind = 'schematic_netlist';
                    mime = 'text/plain';
                    value = { netlistType: p.netlistType ?? null };
                    deliveryComplete = true;
                }
            }
            else if (action === 'schematic.export.bom') {
                const type = (p.fileType as 'xlsx' | 'csv' | undefined) ?? 'xlsx';
                if (!['xlsx', 'csv'].includes(type))
                    throw Error('V2_INVALID_FILE_TYPE');
                let file: File | undefined;
                await c.effect(async () => { file = await eda.sch_ManufactureData.getBomFile(p.fileName as string | undefined, type, p.template as string | undefined, p.filterOptions as Parameters<typeof eda.sch_ManufactureData.getBomFile>[3], p.statistics as string[] | undefined, p.property as string[] | undefined, p.columns as Parameters<typeof eda.sch_ManufactureData.getBomFile>[6]); blob = file; });
                if (file) {
                    name = file.name || `${p.fileName ?? 'bom'}.${type}`;
                    kind = 'schematic_bom';
                    mime = type === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                    value = { fileType: type };
                    deliveryComplete = true;
                }
            }
            else if (action === 'pcb.export.dsn') {
                let file: File | undefined;
                await c.effect(async () => { file = await eda.pcb_ManufactureData.getDsnFile((p.fileName as string | undefined) ?? 'design.dsn'); });
                if (file) {
                    let text = await file.text(), keepouts = 0;
                    if (p.injectKeepout !== false)
                        try {
                            const x = await assets.inject(text);
                            text = x.text;
                            keepouts = x.count;
                        }
                        catch { /* baseline optional injection */ }
                    name = file.name || ((p.fileName as string | undefined) ?? 'design.dsn');
                    blob = new Blob([text], { type: 'text/plain' });
                    kind = 'pcb_dsn';
                    mime = 'text/plain';
                    value = { fileName: name, size: blob.size, keepouts };
                    deliveryComplete = true;
                }
            }
            else if (action === 'schematic.export.image') {
                const format = ((p.format as string | undefined) ?? 'svg').toLowerCase(), spec = assets.formats[format];
                if (!spec)
                    throw Error('UNSUPPORTED_EXPORT_FORMAT');
                const ids = typeof p.primitiveIds === 'string' ? [p.primitiveIds] : p.primitiveIds as string[] | undefined;
                const scope = (p.scope as string | undefined) ?? (ids?.length ? 'selection' : 'page'), object = assets.objects[scope];
                if (!object)
                    throw Error('UNSUPPORTED_EXPORT_SCOPE');
                if (ids?.length) {
                    requestedSelection = [...new Set(ids)];
                    await c.effect(() => eda.sch_SelectControl.doSelectPrimitives(ids));
                }
                const selected = array(await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId());
                if (scope === 'selection') {
                    if (!selected.length)
                        throw Error('EMPTY_SELECTION');
                    requestedSelection ??= [...selected];
                }
                name = (p.fileName as string | undefined) ?? `schematic-export.${spec.ext}`;
                kind = 'schematic_export';
                mime = spec.mime;
                await c.effect(async () => { const file = await eda.sch_ManufactureData.getExportDocumentFile(name, spec.fileType as ESCH_ExportDocumentFileType, { theme: (p.theme ?? 'Default') as 'Default', lineWidth: (p.lineWidth ?? 'Default') as 'Default' }, object); blob = file; if (file) {
                    name = file.name || name;
                    value = { format, scope, selectedCount: selected.length, bytes: file.size, fileName: name };
                    deliveryComplete = true;
                } });
                // Preserve the Host leaked-progress workaround inside the same ownership.
                await new Promise(r => setTimeout(r, 400));
                try {
                    await c.effect(() => eda.sys_LoadingAndProgressBar.destroyProgressBar());
                }
                catch { /* optional UI cleanup */ }
                try {
                    await c.effect(() => eda.sys_LoadingAndProgressBar.destroyLoading());
                }
                catch { /* optional UI cleanup */ }
            }
            else if (action === 'pcb.snapshot') {
                let fitted = false, staleRetry = false;
                if (p.fit !== false)
                    try {
                        await c.effect(async () => { await eda.dmt_EditorControl.zoomToAllPrimitives(); fitted = true; });
                    }
                    catch { /* optional fit */ }
                await assets.settle();
                blob = await eda.dmt_EditorControl.getCurrentRenderedAreaImage(c.request.target_ref.tab_id);
                let sha = blob ? await assets.sha(blob) : undefined;
                if (p.previousSha256 && sha === p.previousSha256) {
                    staleRetry = true;
                    try {
                        await c.effect(() => eda.pcb_Document.startCalculatingRatline());
                    }
                    catch { /* native settled; next admission checks deadline */ }
                    try {
                        await c.effect(() => eda.dmt_EditorControl.zoomToAllPrimitives());
                    }
                    catch { /* optional nudge */ }
                    await assets.settle();
                    blob = await eda.dmt_EditorControl.getCurrentRenderedAreaImage(c.request.target_ref.tab_id);
                    sha = blob ? await assets.sha(blob) : undefined;
                }
                name = 'pcb-snapshot.png';
                kind = 'pcb_snapshot';
                mime = 'image/png';
                value = { fitted, sha256: sha, stale: Boolean(p.previousSha256 && sha && sha === p.previousSha256), staleRetry, capturedAt: new Date().toISOString(), staleHint: 'Judge state by data; screenshot is layout evidence only.' };
                deliveryComplete = !!blob;
            }
            else
                throw Error('V2_UNSUPPORTED_EXPORT');
            return c.verify();
        } };
}
