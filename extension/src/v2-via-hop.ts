import { type NativeAction, unavailable } from './execution-v2';
import { array, declaredReadFields } from './v2-native-actions';
import { canonical, fastPath, matchesOperation, type Operation } from './fast-path';
import { nativePort } from './fast-path-native';
import { covered } from './v2-batch-actions';
export function viaHop(polygon: (points: number[][]) => IPCB_Polygon, makePort: () => ReturnType<typeof nativePort> = nativePort): NativeAction {
    return { mode: 'V2_NATIVE', scope: 'DESIGN_CONTENT', validate: declaredReadFields('pcb.route.via_hop'), run: async (c) => {
            const p = c.request.input, net = p.net as string, layer = (p.layer as number | undefined) ?? 1, hopLayer = (p.hopLayer as number | undefined) ?? 2, width = (p.lineWidth as number | undefined) ?? 6, hole = (p.holeDiameter as number | undefined) ?? 12, diameter = (p.viaDiameter as number | undefined) ?? 24, stub = (p.stub as number | undefined) ?? 20, bondSize = (p.bondSize as number | undefined) ?? 20, bonded = p.bondFill === true;
            const start = [p.fromX as number, p.fromY as number], end = [p.toX as number, p.toY as number], distance = Math.hypot(end[0] - start[0], end[1] - start[1]);
            if (layer === hopLayer || distance <= 2 * stub + diameter)
                throw Error('INVALID_HOP_GEOMETRY');
            const dx = (end[0] - start[0]) * stub / distance, dy = (end[1] - start[1]) * stub / distance, v1 = { x: start[0] + dx, y: start[1] + dy }, v2 = { x: end[0] - dx, y: end[1] - dy };
            const trace = (a: number[], b: number[], layer: number): Operation => ({ type: 'add_trace', net, layer, width, points: [a as [
                        number,
                        number
                    ], b as [
                        number,
                        number
                    ]] }), via = (v: {
                x: number;
                y: number;
            }): Operation => ({ type: 'add_via', net, ...v, hole, diameter, from_layer: layer, to_layer: hopLayer });
            const operations = [trace(start, [v1.x, v1.y], layer), via(v1), trace([v1.x, v1.y], [v2.x, v2.y], hopLayer), via(v2), trace([v2.x, v2.y], end, layer)];
            const fills: Array<{
                layer: number;
                polygon: IPCB_Polygon;
            }> = [];
            if (bonded)
                for (const v of [v1, v2])
                    for (const ly of [layer, hopLayer]) {
                        const h = bondSize / 2;
                        fills.push({ layer: ly, polygon: polygon([[v.x - h, v.y - h], [v.x + h, v.y - h], [v.x + h, v.y + h], [v.x - h, v.y + h]]) });
                    }
            const port = makePort(), scope = { project_uuid: c.request.target_ref.project_uuid, document_uuid: c.request.target_ref.document_uuid }, before = (await fastPath.snapshotData(port, scope)).data;
            const old = new Map([...before.components, ...before.pads, ...before.traces, ...before.vias, ...before.fills].map(x => [x.id, canonical(x)]));
            const created = new Map<number, string>(), attempted = new Set<number>();
            let compensated = false;
            c.prepare(async () => {
                const after = (await fastPath.snapshotData(port, scope)).data, now = new Map([...after.components, ...after.pads, ...after.traces, ...after.vias, ...after.fills].map(x => [x.id, x])), ids = new Set(created.values());
                if (ids.size !== created.size || [...ids].some(id => old.has(id)) || [...attempted].some(i => !created.has(i)) || [...now.keys()].some(id => !old.has(id) && !ids.has(id)) || [...old].some(([id, v]) => canonical(now.get(id)) !== v))
                    return { changed: null, verification: unavailable() };
                const actualFills = new Map(array(await eda.pcb_PrimitiveFill.getAll()).map(x => [x.getState_PrimitiveId(), x]));
                let matched = 0;
                for (const [i, id] of created) {
                    if (i < operations.length) {
                        if (matchesOperation(now.get(id), operations[i]))
                            matched++;
                    }
                    else {
                        const x = actualFills.get(id), f = fills[i - operations.length];
                        if (x && x.getState_Layer() === f.layer && x.getState_Net() === net && canonical(x.getState_ComplexPolygon().getSource()) === canonical(f.polygon.getSource()))
                            matched++;
                    }
                }
                const present = [...created].filter(([, id]) => now.has(id));
                return covered({ net, layer, hopLayer, vias: [v1, v2], trackIds: present.filter(([i]) => i < operations.length && operations[i].type === 'add_trace').map(([, id]) => id), viaIds: present.filter(([i]) => i < operations.length && operations[i].type === 'add_via').map(([, id]) => id), fillIds: present.filter(([i]) => i >= operations.length).map(([, id]) => id), bonded, note: bonded ? 'optional bond fills placed on both layers of both vias (extra copper; NOT required for connectivity)' : 'no bond fills; verify connectivity with pcb.drc.check after a pour-rebuild', rollback: { attempted: compensated, complete: compensated && present.length === 0 } }, operations.length + fills.length, matched, present.length > 0, ['fresh_each_route_geometry', 'fresh_bond_polygon_and_net', 'complete_created_identity_scope', 'unrelated_board_unchanged']);
            });
            try {
                for (let i = 0; i < operations.length + fills.length; i++)
                    await c.effect(async () => { attempted.add(i); let id: string | undefined; if (i < operations.length)
                        id = await port.create(operations[i]);
                    else {
                        const f = fills[i - operations.length];
                        id = (await eda.pcb_PrimitiveFill.create(f.layer as TPCB_LayersOfFill, f.polygon, net, 0 as EPCB_PrimitiveFillMode, undefined, false))?.getState_PrimitiveId();
                    } if (!id)
                        throw Error('V2_CREATED_ID_UNAVAILABLE'); created.set(i, id); if (old.has(id))
                        throw Error('V2_FOREIGN_CREATED_ID'); });
            }
            catch {
                if ([...attempted].every(i => created.has(i)) && [...created.values()].every(id => !old.has(id)))
                    for (const [i, id] of [...created].reverse())
                        try {
                            await c.effect(async () => { const fresh = (await fastPath.snapshotData(port, scope)).data; if (i < operations.length) {
                                const item = [...fresh.traces, ...fresh.vias].find(x => x.id === id);
                                if (!matchesOperation(item, operations[i]))
                                    throw Error('V2_COMPENSATION_DRIFT');
                            }
                            else {
                                const x = array(await eda.pcb_PrimitiveFill.getAll()).find(x => x.getState_PrimitiveId() === id), f = fills[i - operations.length];
                                if (!x || x.getState_Net() !== net || x.getState_Layer() !== f.layer || canonical(x.getState_ComplexPolygon().getSource()) !== canonical(f.polygon.getSource()))
                                    throw Error('V2_COMPENSATION_DRIFT');
                            } compensated = true; if (i < operations.length)
                                await port.remove(operations[i].type.slice(4), id);
                            else
                                await eda.pcb_PrimitiveFill.delete([id]); });
                        }
                        catch {
                            break;
                        }
            }
            return c.verify();
        } };
}
