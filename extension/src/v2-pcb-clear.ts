import { type NativeAction, observed, unavailable } from './execution-v2';
import { array, declaredReadFields } from './v2-native-actions';
import { covered } from './v2-batch-actions';
interface Prim {
    getState_PrimitiveId(): string;
    getState_PrimitiveLock?: () => boolean;
}
interface Kind {
    key: string;
    scope?: string;
    getAll(): Promise<Prim[]>;
    del(ids: string[]): Promise<boolean>;
    filter?: (p: Prim) => boolean;
}
export function pageClear(kinds: Kind[], outline: Kind[], scopesOf: (raw: unknown) => string[]): NativeAction {
    return { mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: declaredReadFields('pcb.page.clear'), run: async (c) => {
            const p = c.request.input, scopes = scopesOf(p.only), preserveOutline = p.preserveOutline !== false, includeLocked = p.includeLocked === true, dryRun = p.dryRun === true;
            const targets = [...kinds.filter(k => k.scope && scopes.includes(k.scope)).map(kind => ({ kind, ignoreLock: false })), ...(preserveOutline ? [] : outline.map(kind => ({ kind, ignoreLock: true })))];
            const before = new Map<string, Set<string>>(), requested: Record<string, string[]> = {}, skippedLocked: Record<string, number> = {};
            for (const { kind, ignoreLock } of targets) {
                const items = array(await kind.getAll());
                const all = items.map(x => x.getState_PrimitiveId());
                if (all.some(id => !id) || new Set(all).size !== all.length)
                    throw Error('V2_AMBIGUOUS_IDENTITY');
                before.set(kind.key, new Set(all));
                requested[kind.key] = [];
                for (const item of items) {
                    if (kind.filter && !kind.filter(item))
                        continue;
                    if (!ignoreLock && !includeLocked && item.getState_PrimitiveLock?.() === true) {
                        skippedLocked[kind.key] = (skippedLocked[kind.key] ?? 0) + 1;
                        continue;
                    }
                    requested[kind.key].push(item.getState_PrimitiveId());
                }
            }
            const skippedTotal = Object.values(skippedLocked).reduce((a, b) => a + b, 0), total = Object.values(requested).reduce((a, b) => a + b.length, 0), failed: string[] = [];
            const base = { scopes, preserveOutline, includeLocked, dryRun, ...(skippedTotal ? { skippedLocked, skippedLockedTotal: skippedTotal } : {}) };
            if (dryRun)
                return observed({ ...base, deleted: Object.fromEntries(Object.entries(requested).filter(([, ids]) => ids.length).map(([k, ids]) => [k, ids.length])), total, deletedIds: Object.fromEntries(Object.entries(requested).filter(([, ids]) => ids.length)), rounds: 1 }, ['fresh_scoped_clear_preview']);
            c.prepare(async () => {
                const deleted: Record<string, number> = {}, deletedIds: Record<string, string[]> = {}, survivors: Record<string, string[]> = {};
                let count = 0;
                const allRequested = new Set(Object.values(requested).flat());
                for (const { kind } of targets) {
                    const ids = array(await kind.getAll()).map(x => x.getState_PrimitiveId());
                    if (ids.some(id => !before.get(kind.key)!.has(id)) || [...before.get(kind.key)!].some(id => !allRequested.has(id) && !ids.includes(id)))
                        return { changed: null, verification: unavailable() };
                    const gone = requested[kind.key].filter(id => !ids.includes(id));
                    survivors[kind.key] = requested[kind.key].filter(id => ids.includes(id));
                    if (gone.length) {
                        deleted[kind.key] = gone.length;
                        deletedIds[kind.key] = gone;
                        count += gone.length;
                    }
                }
                return covered({ ...base, deleted, total: count, deletedIds, rounds: 1, survivors, ...(failed.length ? { failed } : {}) }, total, count, count > 0, ['fresh_scoped_absence_and_survivors', 'unrelated_ids_preserved']);
            });
            for (const { kind } of targets)
                if (requested[kind.key].length)
                    try {
                        await c.effect(async () => { if (await kind.del(requested[kind.key]) === false)
                            failed.push(kind.key); });
                    }
                    catch {
                        failed.push(kind.key);
                    }
            return c.verify();
        } };
}
