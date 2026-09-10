import test from 'node:test';
import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import { ControlledExecutor, V2, type Request } from './execution-v2';
import { exportAction } from './v2-export-actions';
import { covered } from './v2-batch-actions';
const target = { scope: 'DOCUMENT' as const, session: 's', activation: 'a', project_uuid: 'p', document_uuid: 'd', document_type: 'schematic', tab_id: 't' };
const assets = { pack: async (b: Blob, k: string, n: string, m: string) => ({ id: 'artifact', kind: k, fileName: n, mimeType: m, inlineBase64: Buffer.from(await b.arrayBuffer()).toString('base64') }), sha: async () => null, settle: async () => { }, inject: async (text: string) => ({ text, count: 0 }), formats: { svg: { fileType: 'SVG', ext: 'svg', mime: 'image/svg+xml' } }, objects: { page: 'Current Page', selection: 'Current Page Selected Items', project: 'Project' } };
function request(action: string, input: Record<string, unknown> = {}): Request { return { protocol: V2, action, input, action_revision: '1', schema: 'test', request_id: 'r', operation_id: 'op', target_ref: target, budget_ms: 1000 }; }
for (const mode of ['normal', 'empty', 'late'] as const)
    test('V2 export netlist ' + mode, async () => {
        let calls = 0, release!: () => void;
        (globalThis as any).eda = { sch_ManufactureData: { getNetlistFile: async () => { calls++; if (mode === 'late')
                    await new Promise<void>(r => release = r); return new File([mode === 'empty' ? '' : 'NET CONTENT'], 'n.net'); } } };
        const x = new ControlledExecutor(() => exportAction('schematic.export.netlist', assets), async () => target), r = request('schematic.export.netlist');
        if (mode === 'late')
            r.budget_ms = 5;
        const promise = x.execute(r, 'd');
        if (mode === 'late') {
            await new Promise(r => setTimeout(r, 20));
            await assert.rejects(x.execute({ ...r, operation_id: 'second' }, 'x'), /BARRIER/);
            release();
        }
        const result = await promise;
        assert.equal(result.verification.verdict, mode === 'empty' ? 'unavailable' : 'satisfied');
        if (mode === 'late')
            assert.equal(result.effects.reconciled, true);
        await x.reconcile('op');
        assert.equal(calls, 1);
    });
test('V2 empty batch proves observed empty scope rather than invalid zero requirements', () => { const result = covered({}, 0, 0, false, ['fresh_inventory']); assert.equal(result.verification.verdict, 'satisfied'); assert.ok(result.verification.required > 0); assert.equal(result.verification.satisfied, result.verification.required); });
test('V2 export target mismatch no native call', async () => { let calls = 0; (globalThis as any).eda = { sch_ManufactureData: { getNetlistFile: async () => { calls++; } } }; const x = new ControlledExecutor(() => exportAction('schematic.export.netlist', assets), async () => ({ ...target, document_uuid: 'foreign' })); const r = await x.execute(request('schematic.export.netlist'), 'd'); assert.equal(r.effects.effect_started, false); assert.equal(calls, 0); });
