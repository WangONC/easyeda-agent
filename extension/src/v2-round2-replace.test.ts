import test from 'node:test';
import assert from 'node:assert/strict';
import { replaceComponent } from './v2-replace-component';
import { ControlledExecutor, V2, type Request } from './execution-v2';
const target = { scope: 'DOCUMENT' as const, session: 's', activation: 'a', project_uuid: 'p', document_uuid: 'd', document_type: 'schematic', tab_id: 't' };
const device = (id: string) => ({ uuid: id.repeat(32), libraryUuid: 'lib', association: { symbol: { uuid: 'c'.repeat(32), libraryUuid: 'lib' } }, property: { otherProperty: {} } });
for (const mode of ['normal', 'late-create', 'late-delete', 'wrong-patch', 'drift'] as const)
    test('replacement staged/final identity ' + mode, async () => {
        const old = device('a'), next = device('b'), initial = { primitiveId: 'old', x: 1, y: 2, designator: 'R1', uniqueId: 'unique', otherProperty: {}, component: { uuid: old.uuid, libraryUuid: 'lib' } };
        const states = new Map<string, Record<string, unknown>>([['old', { ...initial }]]), store = new Map<string, string>();
        let calls = 0, creates = 0, release!: () => void;
        const get = (id: string) => states.has(id) ? { getState_PrimitiveId: () => id } : undefined;
        (globalThis as any).eda = { lib_Device: { get: async (id: string) => id === old.uuid ? old : next }, sys_Storage: { setExtensionUserConfig: async (k: string, v: string) => store.set(k, v), getExtensionUserConfig: (k: string) => store.get(k) }, sch_PrimitiveWire: { getAll: async () => [] }, sch_PrimitiveComponent: { getAll: async () => [...states.keys()].map(get), create: async (d: any, x: number, y: number) => { calls++; creates++; if (mode === 'late-create')
                    await new Promise<void>(r => release = r); const id = 'new' + creates; states.set(id, { primitiveId: id, x, y, designator: 'TEMP', otherProperty: {}, component: { uuid: d.uuid, libraryUuid: d.libraryUuid } }); return get(id); }, modify: async (id: string, patch: object) => { calls++; if (mode !== 'wrong-patch')
                    Object.assign(states.get(id)!, patch); return get(id); }, delete: async (id: string) => { calls++; if (mode === 'late-delete' && id === 'old')
                    await new Promise<void>(r => release = r); states.delete(id); return true; } } };
        const action = replaceComponent(async () => ({ primitiveId: 'old', snapshot: initial, oldDevice: { uuid: old.uuid, libraryUuid: 'lib', via: 'source' }, oldSource: old, target: { uuid: next.uuid, libraryUuid: 'lib' }, targetSource: next, x: 1, y: 2, carryProps: { designator: 'R1', uniqueId: 'unique' }, rollbackProps: { designator: 'R1', uniqueId: 'unique', otherProperty: {} }, keepProperties: false, oldPins: [] }), x => ({ ...states.get(x.getState_PrimitiveId())! }), a => ({ merged: a, filled: [] }), async () => [], () => ({ removed: [], added: [], moved: [] }));
        const req: Request = { protocol: V2, action: 'schematic.component.replace', action_revision: '1', schema: 'test', request_id: 'r', operation_id: 'o', target_ref: target, input: { primitiveId: 'old' }, budget_ms: mode.startsWith('late') ? 5 : 1000 };
        const ex = new ControlledExecutor(() => action, async () => mode === 'drift' ? { ...target, document_uuid: 'other' } : target), pending = ex.execute(req, 'd');
        if (mode.startsWith('late')) {
            await new Promise(r => setTimeout(r, 25));
            assert.ok(release);
            await assert.rejects(ex.execute({ ...req, operation_id: 'second' }, 'other'), /BARRIER/);
            release();
        }
        const result = await pending;
        if (mode === 'normal')
            assert.equal(result.verification.verdict, 'satisfied');
        else
            assert.notEqual(result.verification.verdict, 'satisfied');
        if (mode === 'late-delete') {
            assert.equal(states.has('old'), false);
            assert.equal(states.get('new1')?.designator, 'TEMP');
            assert.equal(creates, 1);
        }
        const count = calls;
        if (mode !== 'drift')
            await ex.reconcile('o');
        assert.equal(calls, count);
        assert.equal(creates, mode === 'drift' ? 0 : mode === 'wrong-patch' ? 2 : 1);
    });
