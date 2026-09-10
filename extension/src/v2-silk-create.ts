import { type NativeAction, unavailable } from './execution-v2';
import { array, declaredReadFields } from './v2-native-actions';
import { canonical } from './fast-path';
import { covered } from './v2-batch-actions';
type Text = Awaited<ReturnType<typeof eda.pcb_PrimitiveString.getAll>>[number];
type Args = Parameters<typeof eda.pcb_PrimitiveString.create>;
export interface SilkAuthor {
    create: (...args: Args) => Promise<Text | undefined>;
    failure: (row: Record<string, unknown>) => void;
}
const textState = (x: Text) => ({ x: x.getState_X(), y: x.getState_Y(), text: x.getState_Text(), layer: x.getState_Layer(), fontSize: x.getState_FontSize(), lineWidth: x.getState_LineWidth(), rotation: x.getState_Rotation(), mirror: x.getState_Mirror() });
export function silkCreate(name: string, business: (p: Record<string, unknown>, author: SilkAuthor) => Promise<Record<string, unknown>>): NativeAction {
    return { mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: declaredReadFields(name), run: async (c) => {
            const pull = async () => { const xs = array<Text>(await eda.pcb_PrimitiveString.getAll()), m = new Map(xs.map(x => [x.getState_PrimitiveId(), textState(x)])); if (m.size !== xs.length || m.has(''))
                throw Error('V2_TEXT_IDENTITY'); return m; };
            const before = await pull();
            const attempts: {
                id?: string;
                expected: ReturnType<typeof textState>;
                settled: boolean;
                rejected: boolean;
            }[] = [];
            let complete = false, value: Record<string, unknown> = {}, failures = 0;
            c.prepare(async () => {
                const fresh = await pull(), ids = attempts.flatMap(a => a.id ? [a.id] : []);
                if (!complete || attempts.some(a => !a.settled || !a.id && !a.rejected) || new Set(ids).size !== ids.length || ids.some(id => before.has(id)) || [...before].some(([id, s]) => canonical(fresh.get(id)) !== canonical(s)) || [...fresh.keys()].some(id => !before.has(id) && !ids.includes(id)))
                    return { changed: null, verification: unavailable() };
                const applied = attempts.filter(a => a.id && canonical(fresh.get(a.id)) === canonical(a.expected));
                // Explicit business failure callbacks describe unplaced labels; arbitrary raw
                // result fields never authorize completion. Fresh text fields prove each create.
                const rejected = attempts.filter(a => a.rejected).length;
                const required = attempts.length + Math.max(0, failures - rejected);
                return covered({ ...value, verification: { created: applied.map(a => a.id), unresolved: attempts.filter(a => !applied.includes(a)).map(a => a.id ?? null) } }, required, applied.length, fresh.size !== before.size, ['fresh_created_text_identity_and_fields', 'complete_text_inventory', 'unplaced_business_items']);
            });
            value = await business(c.request.input, { failure: () => { failures++; }, create: async (...args) => {
                    const expected = { layer: Number(args[0]), x: args[1], y: args[2], text: args[3], fontSize: args[5] ?? 40, lineWidth: args[6] ?? 6, rotation: args[8] ?? 0, mirror: args[11] ?? false };
                    let item: Text | undefined;
                    await c.effect(async () => { const a = { expected, settled: false, rejected: false, id: undefined as string | undefined }; attempts.push(a); try {
                        item = await eda.pcb_PrimitiveString.create(...args);
                        a.id = item?.getState_PrimitiveId();
                    }
                    catch (e) {
                        a.rejected = true;
                        throw e;
                    }
                    finally {
                        a.settled = true;
                    } });
                    return item;
                } });
            complete = true;
            return c.verify();
        } };
}
