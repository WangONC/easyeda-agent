import { type NativeAction, unavailable } from './execution-v2';
import { declaredReadFields, verifyDrcReport } from './v2-native-actions';
import { fastPath, canonical } from './fast-path';
import { nativePort } from './fast-path-native';
export const compareDrc: NativeAction = { mode: 'V2_NATIVE', scope: 'NATIVE_RECOMPUTE', validate: declaredReadFields('pcb.drc.compare'), run: async (c) => {
        const p = c.request.input, t = c.request.target_ref;
        if (p.run_native !== true)
            throw Error('V2_EXPLICIT_DRC_REQUIRED');
        if (p.project_uuid !== undefined && p.project_uuid !== t.project_uuid || p.document_uuid !== undefined && p.document_uuid !== t.document_uuid)
            throw Error('V2_TARGET_MISMATCH');
        const port = nativePort(), scope = { project_uuid: t.project_uuid, document_uuid: t.document_uuid }, before = (await fastPath.snapshotData(port, scope)).data;
        let raw: unknown;
        c.prepare(async () => {
            const report = await verifyDrcReport(raw);
            if (report.verification.verdict !== 'satisfied')
                return report;
            // The flattened comparison parser requires explanation on every leaf. Never
            // silently drop a malformed native violation and compare an empty report.
            if ((raw as Array<{
                list: Array<{
                    list: Array<Record<string, unknown>>;
                }>;
            }>).some(g => g.list.some(n => n.list.some(e => typeof e.errorType !== 'string' || !e.errorType || !Object.hasOwn(e, 'explanation')))))
                return { changed: null, verification: unavailable() };
            const after = (await fastPath.snapshotData(port, scope)).data;
            const content = (s: typeof before) => { const { board_revision, native_api_call_count, ...data } = s; return data; };
            if (canonical(content(before)) !== canonical(content(after)))
                return { changed: null, verification: unavailable() };
            return { ...report, value: { drc_comparison: 'v2', report: report.value, before, after } };
        });
        await c.effect(async () => { raw = await eda.pcb_Drc.check(true, false, true); });
        return c.verify();
    } };
