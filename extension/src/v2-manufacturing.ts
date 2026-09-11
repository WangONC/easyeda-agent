import { type NativeAction, observed, unavailable } from './execution-v2';
import { array, declaredReadFields } from './v2-native-actions';
import { type ResponseArtifact } from './protocol';
import { fastPath, canonical } from './fast-path';
import { nativePort } from './fast-path-native';
export function manufacture(pack: (b: Blob, k: string, n: string, m: string) => Promise<ResponseArtifact>, makePort: () => ReturnType<typeof nativePort> = nativePort): NativeAction {
    return { mode: 'V2_NATIVE', scope: 'UI_NATIVE', validate: declaredReadFields('pcb.manufacturing.export'), run: async (c) => {
            const p = c.request.input, t = c.request.target_ref, profile = p.profile as Record<string, unknown>;
            if (!profile || profile.reviewed !== true || typeof profile.id !== 'string' || !profile.id || profile.units !== 'mm' || !Array.isArray(profile.layers) || !profile.layers.length || profile.layers.length > 64 || profile.layers.some(x => !Number.isInteger(x)) || new Set(profile.layers).size !== profile.layers.length)
                throw Error('INVALID_EXPORT_PROFILE');
            if (p.project_uuid !== undefined && p.project_uuid !== t.project_uuid || p.document_uuid !== undefined && p.document_uuid !== t.document_uuid)
                throw Error('V2_TARGET_MISMATCH');
            const layers = array(await eda.pcb_Layer.getAllLayers());
            if (!(profile.layers as number[]).every(id => layers.some(l => l.id === id)))
                throw Error('INVALID_EXPORT_LAYER');
            const port = makePort(), scope = { project_uuid: t.project_uuid, document_uuid: t.document_uuid }, before = (await fastPath.snapshotData(port, scope)).data;
            const files = new Map<string, File>(), artifacts = new Map<string, ResponseArtifact>(), jobs: Array<[
                string,
                () => Promise<File | undefined>,
                string
            ]> = [['gerber', () => eda.pcb_ManufactureData.getGerberFile('manufacturing', false, 'mm' as ESYS_Unit.MILLIMETER, { integerNumber: 4, decimalNumber: 6 }, { metallicDrillingInformation: true, nonMetallicDrillingInformation: true, drillTable: true, flyingProbeTestingFile: false }, (profile.layers as number[]).map(layerId => ({ layerId, isMirror: false }))), 'application/zip'], ['bom', () => eda.pcb_ManufactureData.getBomFile('bom', 'csv'), 'text/csv'], ['pnp', () => eda.pcb_ManufactureData.getPickAndPlaceFile('pnp', 'csv', 'mm' as ESYS_Unit.MILLIMETER), 'text/csv']];
            c.prepare(async () => {
                const after = (await fastPath.snapshotData(port, scope)).data;
                const content = (s: typeof before) => { const { board_revision, native_api_call_count, ...x } = s; return x; };
                if (canonical(content(before)) !== canonical(content(after)))
                    return { changed: null, verification: unavailable() };
                for (const [format, , mime] of jobs) {
                    const file = files.get(format);
                    if (file?.size && !artifacts.has(format))
                        artifacts.set(format, await pack(file, `manufacturing_${format}`, file.name || `${format}.${format === 'gerber' ? 'zip' : 'csv'}`, mime));
                }
                if (artifacts.size !== 3)
                    return { value: { delivered: [...artifacts.keys()] }, changed: null, verification: unavailable() };
                const list = [...artifacts.values()];
                return { ...observed({ artifactId: list[0].id, profile, project_uuid: t.project_uuid, document_uuid: t.document_uuid, revision: after.board_revision, revision_before: before.board_revision, relevant_verification_ids: p.verification_ids, native_api_call_count: port.calls, content_qualification: 'NOT_EVALUATED' }, ['three_native_files_delivered', 'fresh_board_content_unchanged'], null), evidence: { artifact_delivery: 'v2', artifacts: list, drill_inventory: after.drill_inventory } };
            });
            for (const [format, run] of jobs) {
                await c.effect(async () => { const file = await run(); if (file)
                    files.set(format, file); });
                if (!files.get(format)?.size)
                    break;
            }
            return c.verify();
        } };
}
