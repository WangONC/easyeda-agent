import { type NativeAction, unavailable } from './execution-v2';
import { array, declaredReadFields } from './v2-native-actions';
import { canonical } from './fast-path';
import { covered } from './v2-batch-actions';
interface Step {
    kind: string;
    expected: unknown[];
    create(): Promise<{
        getState_PrimitiveId(): string;
    } | undefined>;
    remove(id: string): Promise<unknown>;
}
interface RecordValue {
    kind: string;
    data: unknown[];
}
async function readGeometry(kind: 'footprint' | 'symbol') {
    const out = new Map<string, RecordValue>();
    const add = (id: string, kind: string, data: unknown[]) => { if (!id || out.has(id))
        throw Error('V2_AMBIGUOUS_PRIMITIVE'); out.set(id, { kind, data }); };
    if (kind === 'footprint') {
        for (const x of array(await eda.pcb_PrimitivePad.getAll()))
            add(x.getState_PrimitiveId(), 'pads', [x.getState_Layer(), x.getState_PadNumber(), x.getState_X(), x.getState_Y(), x.getState_Rotation(), x.getState_Pad(), x.getState_Hole(), x.getState_Metallization(), x.getState_PadType()]);
        for (const x of array(await eda.pcb_PrimitivePolyline.getAll()))
            add(x.getState_PrimitiveId(), 'lines', [x.getState_Layer(), x.getState_Polygon().getSource(), x.getState_LineWidth(), x.getState_PrimitiveLock()]);
    }
    else {
        for (const x of array(await eda.sch_PrimitivePin.getAll()))
            add(x.getState_PrimitiveId(), 'pins', [x.getState_X(), x.getState_Y(), x.getState_PinNumber(), x.getState_PinName(), x.getState_Rotation(), x.getState_PinLength(), x.getState_PinShape(), x.getState_pinType()]);
        for (const x of array(await eda.sch_PrimitivePolygon.getAll()))
            add(x.getState_PrimitiveId(), 'outline', [x.getState_Line(), x.getState_FillColor(), x.getState_LineWidth()]);
        for (const x of array(await eda.sch_PrimitiveCircle.getAll()))
            add(x.getState_PrimitiveId(), 'circles', [x.getState_CenterX(), x.getState_CenterY(), x.getState_Radius(), x.getState_FillColor(), x.getState_LineWidth()]);
    }
    return out;
}
function build(kind: 'footprint' | 'symbol', plan: (p: Record<string, unknown>) => Step[]): NativeAction {
    return { mode: 'V2_NATIVE', scope: 'LIBRARY_ASSET', validate: declaredReadFields(`library.${kind}.build`), run: async (c) => {
            const p = c.request.input, id = p.uuid as string, lib = p.libraryUuid as string;
            if (lib !== c.request.target_ref.library_uuid)
                throw Error('V2_LIBRARY_SCOPE_MISMATCH');
            const asset = kind === 'footprint' ? await eda.lib_Footprint.get(id, lib) : await eda.lib_Symbol.get(id, lib);
            if (!asset || asset.uuid !== id)
                throw Error('V2_ASSET_IDENTITY');
            const steps = plan(p), created = new Map<number, string>(), attempted = new Set<number>();
            let before: Map<string, RecordValue> | undefined, tab: string | undefined, saved = false, compensating = false;
            const guard = async () => { const doc = await eda.dmt_SelectControl.getCurrentDocumentInfo(); if (!tab || doc?.tabId !== tab || doc.uuid !== id || Number(doc.documentType) !== (kind === 'footprint' ? 4 : 2))
                throw Error('V2_ASSET_EDITOR_IDENTITY'); };
            c.prepare(async () => {
                await guard();
                if (!before)
                    return { changed: null, verification: unavailable() };
                const now = await readGeometry(kind), ids = new Set(created.values());
                if (ids.size !== created.size || [...attempted].some(i => !created.has(i)) || [...ids].some(id => before!.has(id)) || [...now.keys()].some(id => !before!.has(id) && !ids.has(id)) || [...before].some(([id, x]) => canonical(now.get(id)) !== canonical(x)))
                    return { changed: null, verification: unavailable() };
                const matches = [...created].filter(([i, id]) => canonical(now.get(id)) === canonical({ kind: steps[i].kind, data: steps[i].expected })).length;
                const groups: Record<string, unknown> = kind === 'footprint' ? { pads: [], lines: [] } : { pins: [], outline: '', circles: [] };
                for (const [i, id] of created) {
                    if (steps[i].kind === 'outline')
                        groups.outline = id;
                    else
                        (groups[steps[i].kind] as string[]).push(id);
                }
                return covered({ uuid: id, libraryUuid: lib, tabId: tab, created: groups, verified: matches === steps.length && saved, rollback: { attempted: compensating, complete: compensating && [...ids].every(id => !now.has(id)) } }, steps.length + 2, 1 + matches + Number(saved), true, ['fresh_asset_editor_uuid_and_tab', 'complete_created_geometry_and_ids', 'unrelated_geometry_unchanged', 'native_save_ack']);
            });
            await c.effect(async () => { tab = kind === 'footprint' ? await eda.lib_Footprint.openInEditor(id, lib) : await eda.lib_Symbol.openInEditor(id, lib); await guard(); before = await readGeometry(kind); });
            try {
                for (let i = 0; i < steps.length; i++)
                    await c.effect(async () => { await guard(); attempted.add(i); const x = await steps[i].create(); if (!x?.getState_PrimitiveId())
                        throw Error('V2_CREATED_ID_UNAVAILABLE'); created.set(i, x.getState_PrimitiveId()); });
                await c.effect(async () => { await guard(); const ack = kind === 'footprint' ? await eda.pcb_Document.save() : await eda.sch_Document.save(); saved = ack === true; });
            }
            catch (e) {
                // Known creations may be compensated once. Missing identity/unknown scope
                // prevents cleanup; a deadline refuses these calls at controlled admission.
                await guard();
                const now = await readGeometry(kind), ids = new Set(created.values());
                if ([...attempted].every(i => created.has(i)) && [...now.keys()].every(id => before!.has(id) || ids.has(id)))
                    for (const [i, id] of [...created].reverse()) {
                        if (before!.has(id) || canonical(now.get(id)) !== canonical({ kind: steps[i].kind, data: steps[i].expected }))
                            break;
                        try {
                            await c.effect(async () => { await guard(); compensating = true; await steps[i].remove(id); });
                        }
                        catch {
                            break;
                        }
                    }
            }
            return c.verify();
        } };
}
interface Pad {
    number: string;
    layer: number;
    x: number;
    y: number;
    rotation: number;
    shape: TPCB_PrimitivePadShape;
    hole: TPCB_PrimitivePadHole | null;
    metallization: boolean;
    padType: EPCB_PrimitivePadType;
}
interface Line {
    layer: number;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    width: number;
}
export function footprintBuild(parse: (p: Record<string, unknown>) => {
    pads: Pad[];
    lines: Line[];
}): NativeAction {
    return build('footprint', p => {
        const { pads, lines } = parse(p);
        const steps: Step[] = pads.map(x => ({ kind: 'pads', expected: [x.layer, x.number, x.x, x.y, x.rotation, x.shape, x.hole, x.metallization, x.padType], create: () => eda.pcb_PrimitivePad.create(x.layer as TPCB_LayersOfPad, x.number, x.x, x.y, x.rotation, x.shape, '', x.hole, 0, 0, 0, x.metallization, x.padType), remove: id => eda.pcb_PrimitivePad.delete([id]) }));
        for (const l of lines) {
            const poly = eda.pcb_MathPolygon.createPolygon([l.startX, l.startY, 'L', l.endX, l.endY] as TPCB_PolygonSourceArray);
            if (!poly)
                throw Error('INVALID_POLYGON');
            steps.push({ kind: 'lines', expected: [l.layer, poly.getSource(), l.width, false], create: () => eda.pcb_PrimitivePolyline.create('', l.layer as TPCB_LayersOfLine, poly, l.width, false), remove: id => eda.pcb_PrimitivePolyline.delete([id]) });
        }
        return steps;
    });
}
interface Pin {
    x: number;
    y: number;
    number: string;
    name: string;
    rotation: number;
    length: number;
    shape: ESCH_PrimitivePinShape;
    pinType: ESCH_PrimitivePinType;
}
interface Circle {
    centerX: number;
    centerY: number;
    radius: number;
    lineWidth: number;
}
export function symbolBuild(parse: (p: Record<string, unknown>) => {
    pins: Pin[];
    circles: Circle[];
    outline: number[];
}): NativeAction {
    return build('symbol', p => {
        const { pins, circles, outline } = parse(p);
        const steps: Step[] = [{ kind: 'outline', expected: [outline, 'none', 1], create: () => eda.sch_PrimitivePolygon.create(outline, null, 'none', 1, null), remove: id => eda.sch_PrimitivePolygon.delete([id]) }];
        for (const x of pins)
            steps.push({ kind: 'pins', expected: [x.x, x.y, x.number, x.name, x.rotation, x.length, x.shape, x.pinType], create: () => eda.sch_PrimitivePin.create(x.x, x.y, x.number, x.name, x.rotation, x.length, null, x.shape, x.pinType), remove: id => eda.sch_PrimitivePin.delete([id]) });
        for (const x of circles)
            steps.push({ kind: 'circles', expected: [x.centerX, x.centerY, x.radius, 'none', x.lineWidth], create: () => eda.sch_PrimitiveCircle.create(x.centerX, x.centerY, x.radius, null, 'none', x.lineWidth, null, null), remove: id => eda.sch_PrimitiveCircle.delete([id]) });
        return steps;
    });
}
