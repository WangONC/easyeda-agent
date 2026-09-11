import { wireGeometry, nativeWireSegments, wireInventoryCoverage, wireTouches } from './wire-geometry';
import { type NativeAction, unavailable } from './execution-v2';
import { array, declaredReadFields } from './v2-native-actions';
import { canonical } from './fast-path';
import { covered } from './v2-batch-actions';
type Comp = Awaited<ReturnType<typeof eda.sch_PrimitiveComponent.getAll>>[number];
type Wire = Awaited<ReturnType<typeof eda.sch_PrimitiveWire.getAll>>[number];
interface Flag {
    id: string;
    kind: 'netflag' | 'netport';
    createArg: string;
    net: string;
    x: number;
    y: number;
    rotation: number;
    mirror: boolean;
}
interface Plan {
    elements: {
        id: string;
        comp: Comp;
    }[];
    flagPlans: Flag[];
    allComponents: Comp[];
    allWires: Wire[];
    wantIds: Set<string>;
    dx: number;
    dy: number;
}
export function groupMove(plan: (p: Record<string, unknown>) => Promise<Plan>, serialize: (c: Comp) => Record<string, unknown>, normalize: (x: unknown) => number[]): NativeAction {
    return { mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: declaredReadFields('schematic.group.move'), run: async (c) => {
            const p = await plan(c.request.input), components = async () => array<Comp>(await eda.sch_PrimitiveComponent.getAll()), wires = async () => array<Wire>(await eda.sch_PrimitiveWire.getAll());
            const unique = <T extends {
                getState_PrimitiveId(): string;
            }>(xs: T[]) => { const m = new Map(xs.map(x => [x.getState_PrimitiveId(), x])); if (m.size !== xs.length || m.has(''))
                throw Error('V2_AMBIGUOUS_IDENTITY'); return m; };
            const before = unique(array(p.allComponents)), beforeW = unique(array(p.allWires)), elementStates = new Map(p.elements.map(x => [x.id, serialize(x.comp)]));
            const wireState = (w: Wire) => ({ line: wireGeometry(w.getState_Line(),true), net: w.getState_Net(), color: w.getState_Color(), lineWidth: w.getState_LineWidth(), lineType: w.getState_LineType() });
            const componentBefore = new Map([...before].map(([id, x]) => [id, serialize(x)]));
            const wireBefore = new Map([...beforeW].map(([id, w]) => [id, canonical(wireState(w))]));
            const rawWireBefore=new Map([...beforeW].map(([id,w])=>[id,structuredClone(w.getState_Line())]));
            const wp = [...beforeW].filter(([id])=>p.wantIds.has(id)).map(([id,w])=>{
                const state=wireState(w),segments=nativeWireSegments(w.getState_Line());
                const lines=segments.map(s=>s.map((n,i)=>n+(i%2?p.dy:p.dx)));
                if(!lines.length)throw Error('V2_WIRE_SHAPE');
                return {id,state,lines,merged:lines.length>1,ids:[] as string[],attempts:0};
            });
            const mergeEligible=new Set([...beforeW].filter(([id,w])=>!p.wantIds.has(id)&&wp.some(planned=>{
                const state=wireState(w);return state.net===planned.state.net&&state.color===planned.state.color&&state.lineWidth===planned.state.lineWidth&&state.lineType===planned.state.lineType&&planned.lines.some(line=>wireTouches(w.getState_Line(),line));
            })).map(([id])=>id));
            const selected = new Set([...p.elements.map(x => x.id), ...p.flagPlans.map(x => x.id), ...wp.map(x => x.id)]), notFound = [...p.wantIds].filter(id => !selected.has(id));
            if (!selected.size)
                throw Error('V2_GROUP_EMPTY');
            const flagIds = new Map<string, string>(), flagAttempts = new Set<string>();
            let probeId: string | undefined, probeAttempt = false, negates = false;
            const norm = (n: number) => (n % 360 + 360) % 360;
            c.prepare(async () => {
                const cm = unique(await components()), wm = unique(await wires()), newFlags = new Set(flagIds.values()), newWires = new Set(wp.flatMap(x => x.ids));
                if (probeAttempt && !probeId || [...flagAttempts].some(id => !flagIds.has(id)) || wp.some(w => w.attempts > w.ids.length) || [...newFlags].some(id => before.has(id)) || [...newWires].some(id => beforeW.has(id) && !mergeEligible.has(id)) || [...cm.keys()].some(id => !before.has(id) && !newFlags.has(id) && id !== probeId) || [...wm.keys()].some(id => !beforeW.has(id) && !newWires.has(id)) || [...before].some(([id, x]) => !selected.has(id) && (!cm.has(id) || canonical(serialize(cm.get(id)!)) !== canonical(componentBefore.get(id)))) || [...wireBefore].some(([id, s]) => !selected.has(id) && (!wm.has(id) || canonical(wireState(wm.get(id)!)) !== s) && !(mergeEligible.has(id) && (!wm.has(id) || newWires.has(id)))))
                    return { changed: null, verification: unavailable() };
                const movedComponents = p.elements.filter(({ id }) => { const state = cm.get(id); return state && canonical(serialize(state)) === canonical({ ...elementStates.get(id), x: Number(elementStates.get(id)!.x) + p.dx, y: Number(elementStates.get(id)!.y) + p.dy }); }).map(({ id }) => ({ primitiveId: id, designator: cm.get(id)!.getState_Designator?.() ?? null, from: { x: elementStates.get(id)!.x, y: elementStates.get(id)!.y }, to: { x: Number(elementStates.get(id)!.x) + p.dx, y: Number(elementStates.get(id)!.y) + p.dy } }));
                const movedFlags = p.flagPlans.filter(f => { const x = cm.get(flagIds.get(f.id) ?? ''); return !cm.has(f.id) && x && x.getState_Net() === f.net && x.getState_X() === f.x + p.dx && x.getState_Y() === f.y + p.dy && norm(x.getState_Rotation()) === norm(f.rotation) && x.getState_Mirror() === f.mirror; }).map(f => ({ oldPrimitiveId: f.id, newPrimitiveId: flagIds.get(f.id), kind: f.kind, net: f.net }));
                // Native may merge returned wire IDs. Compare the complete owned segment coverage,
                // including style/net, without guessing ownership from geometric proximity.
                const expected=wireInventoryCoverage([...wp.map(w=>({id:w.id,...w.state,line:w.lines})),...[...beforeW].filter(([id])=>!selected.has(id)).map(([id])=>({id,...JSON.parse(wireBefore.get(id)!),line:rawWireBefore.get(id)}))]);
                const actual=wireInventoryCoverage([...wm].map(([id,w])=>({id,...wireState(w),line:w.getState_Line()})));
                const allWireOK=wp.every(w=>!wm.has(w.id)&&w.ids.length===w.lines.length)&&actual===expected;
                if(!allWireOK&&[...mergeEligible].some(id=>!wm.has(id)||canonical(wireState(wm.get(id)!))!==wireBefore.get(id)))return {changed:null,verification:unavailable()};
                const movedWires = allWireOK ? wp.map(w => ({ oldPrimitiveId: w.id, newPrimitiveId: w.ids[0], net: w.state.net, ...(w.merged ? { newPrimitiveIds: w.ids, segments: w.ids.length } : {}) })) : [];
                const changed = canonical([...cm].map(([id, x]) => [id, serialize(x)])) !== canonical([...componentBefore]) || canonical([...wm].map(([id, x]) => [id, wireState(x)])) !== canonical([...wireBefore].map(([id, x]) => [id, JSON.parse(x)]));
                const probeGone = !probeId || !cm.has(probeId);
                if (!probeGone)
                    return { changed: null, verification: unavailable() };
                return covered({ dx: p.dx, dy: p.dy, movedComponents, movedFlags, movedWires, count: movedComponents.length + movedFlags.length + movedWires.length, ...(notFound.length ? { notFound } : {}) }, selected.size, movedComponents.length + movedFlags.length + movedWires.length, changed, ['fresh_element_pose_and_fields', 'fresh_flag_identity_net_pose', 'complete_owned_wire_segment_coverage', 'probe_absence', 'unrelated_scope_unchanged']);
            });
            if (p.flagPlans.length) {
                await c.effect(async () => { probeAttempt = true; probeId = (await eda.sch_PrimitiveComponent.createNetFlag('Power', '__ROTPROBE__', 990000, 990000, 90))?.getState_PrimitiveId(); });
                if (!probeId || before.has(probeId))
                    throw Error('V2_PROBE_IDENTITY');
                const probe = (await components()).find(x => x.getState_PrimitiveId() === probeId);
                if (!probe || ![90, 270].includes(probe.getState_Rotation()))
                    throw Error('V2_ROTATION_CONTRACT');
                negates = probe.getState_Rotation() === 270;
                await c.effect(() => eda.sch_PrimitiveComponent.delete([probeId!]));
                if ((await components()).some(x => x.getState_PrimitiveId() === probeId))
                    return c.verify();
            }
            for (const { id } of p.elements)
                if (p.dx !== 0 || p.dy !== 0)
                    await c.effect(async () => { await eda.sch_PrimitiveComponent.modify(id, { x: Number(elementStates.get(id)!.x) + p.dx, y: Number(elementStates.get(id)!.y) + p.dy }); });
            for (const f of p.flagPlans) {
                await c.effect(() => eda.sch_PrimitiveComponent.delete([f.id]));
                if ((await components()).some(x => x.getState_PrimitiveId() === f.id))
                    return c.verify();
                await c.effect(async () => { flagAttempts.add(f.id); const args = [f.net, f.x + p.dx, f.y + p.dy, negates ? norm(360 - f.rotation) : f.rotation, f.mirror] as const; const x = f.kind === 'netflag' ? await eda.sch_PrimitiveComponent.createNetFlag(f.createArg as 'Power', ...args) : await eda.sch_PrimitiveComponent.createNetPort(f.createArg as 'IN', ...args); const id = x?.getState_PrimitiveId(); if (id)
                    flagIds.set(f.id, id); });
            }
            for (const w of wp) {
                await c.effect(() => eda.sch_PrimitiveWire.delete([w.id]));
                if ((await wires()).some(x => x.getState_PrimitiveId() === w.id))
                    return c.verify();
                for (const line of w.lines)
                    await c.effect(async () => { w.attempts++; const x = await eda.sch_PrimitiveWire.create(line, w.state.net, w.state.color, w.state.lineWidth, w.state.lineType); const id = x?.getState_PrimitiveId(); if (id)
                        w.ids.push(id); });
            }
            return c.verify();
        } };
}
