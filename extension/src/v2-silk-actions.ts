import { type NativeAction, unavailable } from './execution-v2';
import { array, declaredReadFields } from './v2-native-actions';
import { canonical } from './fast-path';
import { covered } from './v2-batch-actions';
interface Step {
    id: string;
    attribute: boolean;
    patch: Record<string, unknown>;
}
interface Plan {
    steps: Step[];
    value: Record<string, unknown>;
    unresolved?: number;
}
async function inventory() { const map = new Map<string, Record<string, unknown>>(); for (const x of array(await eda.pcb_PrimitiveAttribute.getAll())) {
    const id = x.getState_PrimitiveId();
    if (map.has(id))
        throw Error('V2_AMBIGUOUS_TEXT');
    map.set(id, { attribute: true, x: x.getState_X(), y: x.getState_Y(), rotation: x.getState_Rotation(), fontSize: x.getState_FontSize(), lineWidth: x.getState_LineWidth(), value: x.getState_Value(), layer: x.getState_Layer(), mirror: x.getState_Mirror(), parent: x.getState_ParentPrimitiveId() });
} for (const x of array(await eda.pcb_PrimitiveString.getAll())) {
    const id = x.getState_PrimitiveId();
    if (map.has(id))
        throw Error('V2_AMBIGUOUS_TEXT');
    map.set(id, { attribute: false, x: x.getState_X(), y: x.getState_Y(), rotation: x.getState_Rotation(), fontSize: x.getState_FontSize(), lineWidth: x.getState_LineWidth(), text: x.getState_Text(), layer: x.getState_Layer(), mirror: x.getState_Mirror() });
} return map; }
const matches = (value: Record<string, unknown> | undefined, patch: Record<string, unknown>) => !!value && Object.entries(patch).every(([k, v]) => value[k] === v);
export function silkPatch(name: string, plan: (input: Record<string, unknown>) => Promise<Plan>): NativeAction {
    return { mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: declaredReadFields(name), run: async (c) => {
            const before = await inventory(), planned = await plan(c.request.input), steps = planned.steps, ids = new Set(steps.map(s => s.id));
            const missing = new Set<string>();
            const expected = new Map<string, Record<string, unknown>>();
            for (const step of steps) {
                if (!before.has(step.id)) {
                    missing.add(step.id);
                    continue;
                }
                if (before.get(step.id)!.attribute !== step.attribute)
                    throw Error('V2_TEXT_IDENTITY');
                expected.set(step.id, { ...(expected.get(step.id) ?? {}), ...step.patch });
            }
            const omitted: Record<string, string[]> = {};
            c.prepare(async () => {
                const fresh = await inventory();
                if (fresh.size !== before.size || [...before].some(([id, v]) => !fresh.has(id) || canonical({ ...fresh.get(id), ...Object.fromEntries(Object.keys(expected.get(id) ?? {}).map(k => [k, v[k]])) }) !== canonical(v)))
                    return { changed: null, verification: unavailable() };
                const applied = [...expected].filter(([id, patch]) => matches(fresh.get(id), patch));
                const changed = [...ids].some(id => canonical(before.get(id)) !== canonical(fresh.get(id)));
                const value: Record<string, unknown> = { ...planned.value, verification: { applied: applied.map(([id]) => id), notApplied: [...ids].filter(id => !applied.some(([key]) => key === id)), optionalFieldsUnsupported: omitted } };
                const appliedIDs = new Set(applied.map(([id]) => id));
                if (Array.isArray(value.results))
                    value.results = value.results.map(row => ({ ...row, ok: appliedIDs.has(row.primitiveId), ...(!appliedIDs.has(row.primitiveId) ? { error: row.error ?? 'fresh readback mismatch' } : {}) }));
                if (Array.isArray(value.details)) {
                    value.details = value.details.map((row, i) => ({ ...row, ok: appliedIDs.has(steps[i]?.id) }));
                    value.aligned = (value.details as Array<{
                        ok: boolean;
                    }>).filter(row => row.ok).length;
                }
                return covered(value, expected.size + missing.size + (planned.unresolved ?? 0), applied.length, changed, ['fresh_requested_text_fields', 'unrelated_text_fields_and_identity']);
            });
            for (const [id, patch] of expected) {
                let current = (await inventory()).get(id);
                if (!current || canonical(current) !== canonical(before.get(id)))
                    throw Error('V2_TEXT_DRIFT');
                if (matches(current, patch))
                    continue;
                const write = async (q: Record<string, unknown>) => { if (before.get(id)!.attribute)
                    await eda.pcb_PrimitiveAttribute.modify(id, q as never);
                else
                    await eda.pcb_PrimitiveString.modify(id, q as never); };
                let nativeRejectedAndSettled = false;
                try {
                    await c.effect(async () => {
                        // No timer/race/cancellation can reach this catch: the original native
                        // promise itself is awaited. Gate refusal never invokes this closure.
                        try {
                            await write(patch);
                        }
                        catch (error) {
                            nativeRejectedAndSettled = true;
                            throw error;
                        }
                    });
                }
                catch { /* verifier still owns the first operation; no automatic retry here */ }
                if (nativeRejectedAndSettled && name === 'pcb.silk.align' && ('layer' in patch || 'mirror' in patch)) {
                    current = (await inventory()).get(id);
                    // Both native settlement AND complete unchanged text state are required.
                    // c.effect independently rejects the second invocation after the deadline.
                    if (canonical(current) === canonical(before.get(id))) {
                        const reduced = { ...patch };
                        const optional = ['layer', 'mirror'].filter(k => k in reduced);
                        delete reduced.layer;
                        delete reduced.mirror;
                        try {
                            await c.effect(async () => { omitted[id] = optional; expected.set(id, reduced); await write(reduced); });
                        }
                        catch { /* deadline/target refusal or settled rejection: only readback follows */ }
                    }
                }
            }
            return c.verify();
        } };
}
