import { type NativeAction, unavailable, observed } from './execution-v2';
import { array, declaredReadFields } from './v2-native-actions';
import { covered } from './v2-batch-actions';
export const noConnect: NativeAction = { mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: p => { declaredReadFields('schematic.pin.set_no_connect')(p); if (!Array.isArray(p.pins) || !p.pins.length || !p.pins.every(n => typeof n === 'string' || typeof n === 'number' && Number.isFinite(n)))
        throw Error('V2_INVALID_PINS'); }, run: async (c) => {
        const designator = c.request.input.designator as string, wanted = [...new Set((c.request.input.pins as unknown[]).map(String))], value = c.request.input.noConnected !== false;
        const all = await eda.sch_PrimitiveComponent.getAll(undefined, true);
        if (!Array.isArray(all))
            throw Error('V2_NATIVE_SHAPE');
        const candidates = all.filter(p => p.getState_Designator() === designator);
        if (candidates.length !== 1)
            throw Error('V2_AMBIGUOUS_DESIGNATOR');
        const id = candidates[0].getState_PrimitiveId();
        const pull = async () => {
            const active = array<Awaited<ReturnType<typeof eda.sch_PrimitiveComponent.getAll>>[number]>(await eda.sch_PrimitiveComponent.getAll());
            if (!active.some(p => p.getState_PrimitiveId() === id))
                throw Error('V2_OBJECT_OUTSIDE_BOUND_PAGE');
            const fresh = await eda.sch_PrimitiveComponent.get(id);
            if (!fresh || fresh.getState_PrimitiveId() !== id || fresh.getState_Designator() !== designator)
                throw Error('V2_OBJECT_IDENTITY');
            const pins = array(await fresh.getAllPins());
            const map = new Map(pins.map(p => [String(p.getState_PinNumber()), p]));
            if (map.size !== pins.length)
                throw Error('V2_DUPLICATE_PIN_NUMBER');
            return map;
        };
        const before = await pull();
        if (wanted.some(n => !before.has(n)))
            throw Error('V2_PIN_NOT_FOUND');
        const initial = new Map(wanted.map(n => [n, before.get(n)!.getState_NoConnected()]));
        c.prepare(async () => { const after = await pull(); if (wanted.some(n => !after.has(n)))
            return { changed: null, verification: unavailable() }; const confirmed = wanted.map(n => ({ pin: n, noConnected: after.get(n)!.getState_NoConnected() })), notApplied = confirmed.filter(p => p.noConnected !== value).map(p => p.pin); return covered({ designator, primitiveId: id, noConnected: value, pins: confirmed, notApplied }, wanted.length, wanted.length - notApplied.length, confirmed.some(p => p.noConnected !== initial.get(p.pin)), ['fresh_bound_component', 'fresh_pin_states', 'complete_pin_coverage']); });
        for (const n of wanted) {
            if (initial.get(n) === value)
                continue;
            await c.effect(async () => { const pins = await pull(); const pin = pins.get(n)!; pin.setState_NoConnected(value); await pin.done(); });
        }
        return c.verify();
    } };
export function schematicDrc(normalize: (raw: unknown) => Record<string, unknown>): NativeAction {
    return { mode: 'V2_NATIVE', scope: 'NATIVE_RECOMPUTE', validate: declaredReadFields('schematic.drc.check'), run: async (c) => {
            const verbose = c.request.input.includeVerboseError !== false, strict = c.request.input.strict === true;
            let raw: unknown;
            const validNode = (x: unknown): boolean => { if (!x || typeof x !== 'object' || Array.isArray(x))
                return false; const o = x as Record<string, unknown>; if (Array.isArray(o.list))
                return o.list.every(validNode); return typeof o.type === 'string' && typeof o.count === 'number' && Number.isInteger(o.count) && o.count >= 0 || typeof o.errorType === 'string'; };
            c.prepare(async () => {
                if (verbose ? !Array.isArray(raw) || !raw.every(validNode) : typeof raw !== 'boolean')
                    return { changed: null, verification: unavailable() };
                const data = verbose ? normalize(raw) : { passed: raw, fatal: 0, summary: { fatal: 0, error: 0, warn: 0, info: 0, unknown: 0, total: 0 }, violations: [], raw };
                return observed({ ...data, design_pass: data.passed }, ['native_drc_report_contract'], null);
            });
            await c.effect(async () => { raw = verbose ? await eda.sch_Drc.check(strict, false, true) : await eda.sch_Drc.check(strict, false, false); });
            return c.verify();
        } };
}
interface SchPatchPlan {
    primitiveId: string;
    normalizedPatch: Record<string, unknown>;
    propertiesBefore?: Record<string, unknown>;
    expectedProperties?: Record<string, unknown>;
    preservedPropertyKeys?: string[];
    before: Record<string, unknown>;
}
export function componentModify(plan: (p: Record<string, unknown>) => Promise<SchPatchPlan>, serialize: (c: unknown) => Record<string, unknown>): NativeAction {
    return { mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: declaredReadFields('schematic.component.modify'), run: async (c) => {
            const p = await plan(c.request.input), id = p.primitiveId;
            const pull = async () => { const fresh = await eda.sch_PrimitiveComponent.get(id); if (!fresh || fresh.getState_PrimitiveId() !== id)
                throw Error('V2_OBJECT_IDENTITY'); return serialize(fresh); };
            const keys = Object.keys(p.normalizedPatch);
            const check = (a: Record<string, unknown>) => {
                const required: string[] = [], matched: string[] = [];
                for (const key of keys) {
                    if (key === 'otherProperty') {
                        const actual = a[key];
                        if (!actual || typeof actual !== 'object')
                            throw Error('V2_PROPERTY_READBACK_UNAVAILABLE');
                        for (const [k, v] of Object.entries(p.normalizedPatch[key] as object)) {
                            const label = 'otherProperty.' + k;
                            required.push(label);
                            if (Object.hasOwn(actual, k) && String((actual as Record<string, unknown>)[k]) === String(v))
                                matched.push(label);
                        }
                    }
                    else {
                        required.push(key);
                        if (a[key] === p.normalizedPatch[key])
                            matched.push(key);
                    }
                }
                return { required, matched };
            };
            c.prepare(async () => {
                const after = await pull(), v = check(after);
                const notApplied = v.required.filter(k => !v.matched.includes(k));
                const changed = JSON.stringify(p.before) !== JSON.stringify(after);
                const props = after.otherProperty as Record<string, unknown> | undefined;
                const expected = Object.keys(p.expectedProperties ?? {});
                const missing = expected.filter(k => !props || !Object.hasOwn(props, k) || String(props[k]) !== String(p.expectedProperties![k]));
                const alreadySet = expected.filter(k => !missing.includes(k) && Object.hasOwn(p.propertiesBefore ?? {}, k) && String(p.propertiesBefore![k]) === String(p.expectedProperties![k]));
                const applied = expected.filter(k => !missing.includes(k) && !alreadySet.includes(k));
                const value = { component: after, ...(p.propertiesBefore ? { propertiesBefore: p.propertiesBefore } : {}), ...(p.preservedPropertyKeys ? { propertiesPreserved: p.preservedPropertyKeys } : {}), ...(notApplied.length ? { partial: true, notApplied, applied, alreadySet, addedKeys: applied.filter(k => !Object.hasOwn(p.propertiesBefore ?? {}, k)) } : {}) };
                return covered(value, v.required.length, v.matched.length, changed, ['fresh_component_identity', ...v.required]);
            });
            const pre = check(p.before);
            if (pre.required.length !== pre.matched.length)
                await c.effect(async () => { const fresh = await pull(); if (JSON.stringify(fresh) !== JSON.stringify(p.before))
                    throw Error('V2_COMPONENT_DRIFT'); await eda.sch_PrimitiveComponent.modify(id, p.normalizedPatch as Parameters<typeof eda.sch_PrimitiveComponent.modify>[1]); });
            return c.verify();
        } };
}
interface ConnectPlan {
    kind: string;
    net: string;
    pinGX: number;
    pinGY: number;
    endX: number;
    endY: number;
    direction: string;
    offset: number;
    rotation: number;
    flag?: 'Power' | 'Ground' | 'AnalogGround' | 'ProtectGround';
    port?: 'IN' | 'OUT' | 'BI';
}
export function connectPin(plan: (p: Record<string, unknown>) => ConnectPlan): NativeAction {
    return { mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: declaredReadFields('schematic.power.connect_pin'), run: async (c) => {
            const p = plan(c.request.input);
            const components = async () => array<Awaited<ReturnType<typeof eda.sch_PrimitiveComponent.getAll>>[number]>(await eda.sch_PrimitiveComponent.getAll());
            const beforeComponents = new Set((await components()).map(x => x.getState_PrimitiveId())), beforeWires = new Set(array(await eda.sch_PrimitiveWire.getAll()).map(x => x.getState_PrimitiveId()));
            let probeId: string | undefined, wireId: string | undefined, flagId: string | undefined, applied = p.rotation;
            let attemptedWire = false, attemptedFlag = false;
            c.prepare(async () => {
                const flags = await components(), wires = array(await eda.sch_PrimitiveWire.getAll());
                if (!probeId || (attemptedWire && !wireId) || (attemptedFlag && !flagId))
                    return { changed: null, verification: unavailable() };
                if (flags.some(x => !beforeComponents.has(x.getState_PrimitiveId()) && ![probeId, flagId].includes(x.getState_PrimitiveId())) || wires.some(x => !beforeWires.has(x.getState_PrimitiveId()) && x.getState_PrimitiveId() !== wireId))
                    return { changed: null, verification: unavailable() };
                if ([...beforeComponents].some(id => !flags.some(x => x.getState_PrimitiveId() === id)) || [...beforeWires].some(id => !wires.some(x => x.getState_PrimitiveId() === id)))
                    return { changed: null, verification: unavailable() };
                const wire = wires.find(x => x.getState_PrimitiveId() === wireId), flag = flags.find(x => x.getState_PrimitiveId() === flagId);
                const line = wire?.getState_Line();
                const flat = Array.isArray(line) ? line.flat() : [];
                const wireOK = !!wireId && !beforeWires.has(wireId) && JSON.stringify(flat) === JSON.stringify([p.pinGX, p.pinGY, p.endX, p.endY]);
                const norm = (v: number) => (v % 360 + 360) % 360;
                const flagOK = !!flagId && !beforeComponents.has(flagId) && !!flag && flag.getState_Net() === p.net && flag.getState_X() === p.endX && flag.getState_Y() === p.endY && norm(flag.getState_Rotation()) === norm(p.rotation);
                const probeGone = !!probeId && !flags.some(x => x.getState_PrimitiveId() === probeId);
                const changed = flags.some(x => !beforeComponents.has(x.getState_PrimitiveId())) || wires.some(x => !beforeWires.has(x.getState_PrimitiveId()));
                return covered({ wirePrimitiveId: wireId, flagPrimitiveId: flagId, endPoint: { x: p.endX, y: p.endY }, direction: p.direction, offset: p.offset, rotation: p.rotation, appliedRotation: applied, ...(!probeGone ? { probe_residual: probeId } : {}) }, 3, Number(wireOK) + Number(flagOK) + Number(probeGone), changed, ['fresh_wire_geometry_identity', 'fresh_flag_net_position_rotation', 'fresh_probe_absence', 'complete_new_identity_inventory']);
            });
            // The old calibration workaround is retained, but even its probe is owned.
            await c.effect(async () => { const x = await eda.sch_PrimitiveComponent.createNetFlag('Power', '__ROTPROBE__', 990000, 990000, 90); probeId = x?.getState_PrimitiveId(); });
            if (!probeId || beforeComponents.has(probeId))
                throw Error('V2_PROBE_IDENTITY');
            const probe = (await components()).find(x => x.getState_PrimitiveId() === probeId);
            if (!probe)
                throw Error('V2_PROBE_READBACK');
            const stored = probe.getState_Rotation();
            if (stored !== 90 && stored !== 270)
                throw Error('V2_ROTATION_CONTRACT');
            applied = stored === 270 ? ((360 - p.rotation) % 360 + 360) % 360 : p.rotation;
            await c.effect(() => eda.sch_PrimitiveComponent.delete([probeId!]));
            if ((await components()).some(x => x.getState_PrimitiveId() === probeId))
                return c.verify();
            await c.effect(async () => { attemptedWire = true; const x = await eda.sch_PrimitiveWire.create([p.pinGX, p.pinGY, p.endX, p.endY]); wireId = x?.getState_PrimitiveId(); });
            if (!wireId || beforeWires.has(wireId))
                throw Error('V2_WIRE_IDENTITY');
            await c.effect(async () => { attemptedFlag = true; const x = p.flag ? await eda.sch_PrimitiveComponent.createNetFlag(p.flag, p.net, p.endX, p.endY, applied) : await eda.sch_PrimitiveComponent.createNetPort(p.port!, p.net, p.endX, p.endY, applied); flagId = x?.getState_PrimitiveId(); });
            return c.verify();
        } };
}
interface DisconnectPlan {
    wireIds: string[];
    validFlags: string[];
    designator?: string;
    pinNumber?: string;
    pinX?: number;
    pinY?: number;
    alsoDisconnectedPins: string[];
}
export function disconnect(plan: (p: Record<string, unknown>) => Promise<DisconnectPlan>): NativeAction {
    return { mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: declaredReadFields('schematic.pin.disconnect'), run: async (c) => {
            const p = await plan(c.request.input), ids = [...p.wireIds, ...p.validFlags];
            const pull = async () => { const wires = array(await eda.sch_PrimitiveWire.getAll()), flags = array<Awaited<ReturnType<typeof eda.sch_PrimitiveComponent.getAll>>[number]>(await eda.sch_PrimitiveComponent.getAll()); return new Set([...wires, ...flags].map(x => x.getState_PrimitiveId())); };
            const before = await pull();
            c.prepare(async () => { const after = await pull(); if ([...after].some(id => !before.has(id)) || [...before].some(id => !ids.includes(id) && !after.has(id)))
                return { changed: null, verification: unavailable() }; const survivedIds = ids.filter(id => after.has(id)), deletedWires = p.wireIds.filter(id => !after.has(id)), deletedFlags = p.validFlags.filter(id => !after.has(id)); return covered({ disconnected: !survivedIds.length, ...(survivedIds.length ? { partial: true } : {}), pin: p.designator && p.pinNumber ? `${p.designator}:${p.pinNumber}` : undefined, at: p.pinX !== undefined && p.pinY !== undefined ? { x: p.pinX, y: p.pinY } : undefined, deletedWires, deletedFlags, notApplied: survivedIds.map(id => ({ kind: p.wireIds.includes(id) ? 'wire' : 'flag', id })), survivedIds, ...(p.alsoDisconnectedPins.length ? { alsoDisconnectedPins: p.alsoDisconnectedPins } : {}) }, ids.length, ids.length - survivedIds.length, deletedWires.length + deletedFlags.length > 0, ['fresh_stub_and_flag_absence', 'unrelated_inventory']); });
            for (let i = 0; i < p.wireIds.length; i += 50)
                await c.effect(async () => { const part = p.wireIds.slice(i, i + 50), generic = (eda as unknown as {
                    sch_PrimitiveObject?: {
                        delete?: (ids: string[]) => Promise<boolean>;
                    };
                }).sch_PrimitiveObject; if (generic?.delete)
                    await generic.delete(part);
                else
                    await eda.sch_PrimitiveWire.delete(part); });
            for (let i = 0; i < p.validFlags.length; i += 50)
                await c.effect(() => eda.sch_PrimitiveComponent.delete(p.validFlags.slice(i, i + 50)));
            return c.verify();
        } };
}
export function componentsList(query: (p: Record<string, unknown>, tagger: (complete?: boolean) => Promise<Map<string, {
    pageUuid: string;
    pageName: string;
}>>) => Promise<unknown>): NativeAction {
    return { mode: 'V2_NATIVE', scope: 'NAVIGATION_SELECTION', validate: declaredReadFields('schematic.components.list'), run: async (c) => {
            const original = await eda.dmt_SelectControl.getCurrentDocumentInfo();
            if (!original?.uuid || !original.tabId || original.parentProjectUuid !== c.request.target_ref.project_uuid)
                throw Error('V2_PAGE_IDENTITY');
            const mapping = new Map<string, {
                pageUuid: string;
                pageName: string;
            }>();
            let complete = c.request.input.tagPages !== true;
            c.prepare(async () => { const now = await eda.dmt_SelectControl.getCurrentDocumentInfo(); if (!complete || now?.uuid !== original.uuid || now.tabId !== original.tabId)
                return { changed: null, verification: unavailable() }; const value = await query(c.request.input, async () => mapping); return observed(value, ['fresh_component_inventory', 'original_page_restored', ...(c.request.input.tagPages === true ? ['complete_page_ownership_mapping'] : [])], false); });
            if (c.request.input.tagPages === true) {
                // Discovery resolves exact UUIDs once; no name-based retargeting during traversal.
                const pages = array(await eda.dmt_Schematic.getAllSchematicPagesInfo());
                if (!pages.length)
                    throw Error('V2_PAGE_INVENTORY_UNAVAILABLE');
                for (const page of pages) {
                    if (!page.uuid)
                        throw Error('V2_PAGE_IDENTITY');
                    await c.effect(async () => { const fresh = array(await eda.dmt_Schematic.getAllSchematicPagesInfo()); if (!fresh.some(x => x.uuid === page.uuid))
                        throw Error('V2_PAGE_RETIRED'); await eda.dmt_EditorControl.openDocument(page.uuid); });
                    const current = await eda.dmt_SelectControl.getCurrentDocumentInfo();
                    if (current?.uuid !== page.uuid || current.parentProjectUuid !== c.request.target_ref.project_uuid)
                        throw Error('V2_PAGE_IDENTITY');
                    for (const x of array<Awaited<ReturnType<typeof eda.sch_PrimitiveComponent.getAll>>[number]>(await eda.sch_PrimitiveComponent.getAll())) {
                        const id = x.getState_PrimitiveId();
                        if (mapping.has(id))
                            throw Error('V2_AMBIGUOUS_PAGE_OWNER');
                        mapping.set(id, { pageUuid: page.uuid, pageName: page.name });
                    }
                }
                await c.effect(() => eda.dmt_EditorControl.activateDocument(original.tabId!));
                complete = true;
            }
            return c.verify();
        } };
}
