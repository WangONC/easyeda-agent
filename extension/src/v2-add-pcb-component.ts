import { type NativeAction, unavailable } from './execution-v2';
import { array, declaredReadFields } from './v2-native-actions';
import { canonical } from './fast-path';
import { object } from './component-source';
import { covered } from './v2-batch-actions';
export function addPcbComponent(extent: (pad: unknown) => {
    width: number;
    height: number;
} | null | undefined): NativeAction {
    return { mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: declaredReadFields('pcb.add_component'), run: async (c) => {
            const p = c.request.input, device = object(p.device), lib = (p.libraryUuid ?? device.libraryUuid) as string, uuid = (p.uuid ?? device.uuid) as string;
            if (!lib || !uuid)
                throw Error('MISSING_DEVICE_IDENTITY');
            const source = await eda.lib_Device.get(uuid, lib);
            if (!source || source.uuid !== uuid || source.libraryUuid !== lib)
                throw Error('V2_SOURCE_IDENTITY');
            const layer = (p.layer as number | undefined) ?? 1, nets = object(p.nets);
            if (Object.values(nets).some(v => typeof v !== 'string'))
                throw Error('V2_INVALID_PAD_NET');
            const components = () => eda.pcb_PrimitiveComponent.getAll(), viaList = () => eda.pcb_PrimitiveVia.getAll();
            const project = (x: Awaited<ReturnType<typeof components>>[number]) => canonical([x.getState_PrimitiveId(), x.getState_X(), x.getState_Y(), x.getState_Rotation(), x.getState_Layer(), x.getState_Designator(), x.getState_UniqueId()]);
            const old = new Map(array(await components()).map(x => [x.getState_PrimitiveId(), project(x)])), oldVias = new Map(array(await viaList()).map(x => [x.getState_PrimitiveId(), canonical([x.getState_Net(), x.getState_X(), x.getState_Y(), x.getState_Diameter(), x.getState_HoleDiameter()])]));
            let id: string | undefined;
            const wantedVias = new Map<string, string>();
            const pull = async () => { const parts = array(await components()); if (!id || old.has(id))
                throw Error('V2_CREATED_COMPONENT_IDENTITY'); const x = parts.find(x => x.getState_PrimitiveId() === id); if (!x)
                throw Error('V2_CREATED_COMPONENT_ABSENT'); return x; };
            const owner = (v: unknown) => { const x = v as {
                getState_ParentComponentPrimitiveId?: () => string;
                getState_ParentPrimitiveId?: () => string;
            }; return x.getState_ParentComponentPrimitiveId?.() ?? x.getState_ParentPrimitiveId?.(); };
            c.prepare(async () => {
                const parts = array(await components()), vias = array(await viaList());
                if (!id || old.has(id) || parts.some(x => !old.has(x.getState_PrimitiveId()) && x.getState_PrimitiveId() !== id) || [...old].some(([key, s]) => !parts.some(x => x.getState_PrimitiveId() === key && project(x) === s)))
                    return { changed: null, verification: unavailable() };
                const comp = await pull(), pads = array(await eda.pcb_PrimitiveComponent.getAllPinsByPrimitiveId(id));
                if (new Set(pads.map(x => x.getState_PrimitiveId())).size !== pads.length || [...oldVias.keys()].some(key => !vias.some(v => v.getState_PrimitiveId() === key)) || vias.some(v => oldVias.has(v.getState_PrimitiveId()) && oldVias.get(v.getState_PrimitiveId()) !== canonical([v.getState_Net(), v.getState_X(), v.getState_Y(), v.getState_Diameter(), v.getState_HoleDiameter()])))
                    return { changed: null, verification: unavailable() };
                const foreignNew = vias.filter(v => !oldVias.has(v.getState_PrimitiveId()) && owner(v) !== id);
                if (foreignNew.length)
                    return { value: { primitiveId: id, unresolvedViaOwnership: foreignNew.map(v => v.getState_PrimitiveId()) }, changed: null, verification: unavailable() };
                const checks = [comp.getState_X() === p.x, comp.getState_Y() === p.y, Number(comp.getState_Layer()) === layer];
                if (p.rotation !== undefined)
                    checks.push(comp.getState_Rotation() === p.rotation);
                if (p.designator)
                    checks.push(comp.getState_Designator() === p.designator);
                if (p.uniqueId)
                    checks.push(comp.getState_UniqueId() === p.uniqueId);
                if (p.channelId !== undefined) checks.push(comp.getState_OtherProperty()?.['Channel ID'] === p.channelId);
                const unmatched: string[] = [];
                for (const [number, net] of Object.entries(nets).filter(([, v]) => v)) {
                    const found = pads.filter(x => String(x.getState_PadNumber()) === number);
                    const ok = found.length > 0 && found.every(x => x.getState_Net() === net);
                    checks.push(ok);
                    if (!ok)
                        unmatched.push(number);
                }
                // Derive required embedded-via nets from fresh owned pads even when the
                // deadline stopped the authoring loop immediately after component creation.
                for (const v of vias)
                    if (!oldVias.has(v.getState_PrimitiveId()) && owner(v) === id) {
                        const hits = pads.filter(pad => { const size = extent(pad); return size && nets[String(pad.getState_PadNumber())] && Math.abs(v.getState_X() - pad.getState_X()) <= size.width / 2 && Math.abs(v.getState_Y() - pad.getState_Y()) <= size.height / 2; });
                        const values = new Set(hits.map(pad => nets[String(pad.getState_PadNumber())] as string));
                        if (values.size > 1)
                            return { changed: null, verification: unavailable() };
                        if (values.size === 1)
                            wantedVias.set(v.getState_PrimitiveId(), [...values][0]);
                    }
                let verifiedVias = 0;
                const failed: string[] = [];
                for (const [key, net] of wantedVias) {
                    const ok = vias.some(v => v.getState_PrimitiveId() === key && owner(v) === id && v.getState_Net() === net);
                    checks.push(ok);
                    if (ok)
                        verifiedVias++;
                    else
                        failed.push(key);
                }
                return covered({ primitiveId: id, designator: comp.getState_Designator() ?? null, uniqueId: comp.getState_UniqueId() ?? null, ...(p.channelId !== undefined ? {channelId: comp.getState_OtherProperty()?.['Channel ID'] ?? null} : {}), padCount: pads.length, assignedNets: pads.filter(x => nets[String(x.getState_PadNumber())] && x.getState_Net() === nets[String(x.getState_PadNumber())]).length, unmatchedPads: unmatched, ...(wantedVias.size ? { embeddedVias: { assigned: wantedVias.size, verified: verifiedVias, failed } } : {}) }, checks.length + 1, 1 + checks.filter(Boolean).length, true, ['fresh_created_component_pose_and_link', 'exact_component_pad_lookup_and_nets', 'native_parent_identity_for_embedded_vias', 'unrelated_board_identity']);
            });
            await c.effect(async () => { id = (await eda.pcb_PrimitiveComponent.create({ libraryUuid: lib, uuid }, layer as TPCB_LayersOfComponent, p.x as number, p.y as number, p.rotation as number | undefined, false))?.getState_PrimitiveId(); });
            await pull();
            const patch: Record<string, unknown> = {};
            if (p.designator)
                patch.designator = p.designator;
            if (p.uniqueId)
                patch.uniqueId = p.uniqueId;
            if (p.channelId !== undefined) patch.otherProperty = { ...(await pull()).getState_OtherProperty(), 'Channel ID': p.channelId };
            if (Object.keys(patch).length)
                try {
                    await c.effect(() => eda.pcb_PrimitiveComponent.modify(id!, patch));
                }
                catch { /* readback retains partial link */ }
            const pads = array(await eda.pcb_PrimitiveComponent.getAllPinsByPrimitiveId(id!));
            for (const pad of pads) {
                const net = nets[String(pad.getState_PadNumber())];
                if (typeof net === 'string' && net)
                    try {
                        await c.effect(() => eda.pcb_PrimitivePad.modify(pad.getState_PrimitiveId(), { net }));
                    }
                    catch { /* per-pad readback */ }
            }
            // Containment never establishes ownership: the native parent must match first.
            for (const v of array(await viaList()))
                if (!oldVias.has(v.getState_PrimitiveId()) && owner(v) === id && !v.getState_Net()) {
                    const hits = pads.filter(pad => { const size = extent(pad), w = size?.width ?? NaN, h = size?.height ?? NaN; return nets[String(pad.getState_PadNumber())] && Number.isFinite(w + h) && v.getState_X() >= pad.getState_X() - w / 2 && v.getState_X() <= pad.getState_X() + w / 2 && v.getState_Y() >= pad.getState_Y() - h / 2 && v.getState_Y() <= pad.getState_Y() + h / 2; });
                    const netSet = new Set(hits.map(pad => nets[String(pad.getState_PadNumber())] as string));
                    if (netSet.size === 1) {
                        const net = [...netSet][0];
                        wantedVias.set(v.getState_PrimitiveId(), net);
                        try {
                            await c.effect(() => eda.pcb_PrimitiveVia.modify(v.getState_PrimitiveId(), { net }));
                        }
                        catch { /* explicit verification */ }
                    }
                }
            try {
                await c.effect(() => eda.pcb_Document.startCalculatingRatline());
            }
            catch { /* baseline optional visual recompute */ }
            return c.verify();
        } };
}
