import test from 'node:test';
import assert from 'node:assert/strict';
import { viaHop } from './v2-via-hop';
import { rebuildPlanes } from './v2-plane-actions';
import { manufacture } from './v2-manufacturing';
import { ControlledExecutor, V2, type Request } from './execution-v2';
import { type NativePort, type Primitive } from './fast-path';
const target = { scope: 'DOCUMENT' as const, session: 's', activation: 'a', project_uuid: 'p', document_uuid: 'd', document_type: 'pcb', tab_id: 't' };
for (const kind of ['via', 'plane', 'manufacturing'] as const)
    for (const mode of ['normal', 'wrong', 'missing', 'late', 'drift'] as const)
        test(kind + ' composite ' + mode, async () => {
            let writes = 0, release!: () => void;
            const primitives: Primitive[] = [];
            const gate = async () => { writes++; if (mode === 'late' && writes === 1)
                await new Promise<void>(r => release = r); };
            const port: NativePort = { calls: 0, context: async () => ({ projectUuid: 'p', documentUuid: 'd', documentType: 'pcb', tabId: 't' }), read: async () => ({ components: [], pads: [], traces: primitives.filter(p => p.kind === 'trace'), vias: primitives.filter(p => p.kind === 'via'), fills: [], copper_layers: [1, 2] }), create: async (op) => { await gate(); const id = 'id' + writes; primitives.push({ id, kind: op.type === 'add_via' ? 'via' : 'trace', net: op.net, layer: op.layer, points: op.points, width: mode === 'wrong' ? 999 : op.width, x: op.x, y: op.y, diameter: op.diameter, hole: op.hole }); return mode === 'missing' ? undefined : id; }, remove: async (_k, id) => { writes++; const i = primitives.findIndex(p => p.id === id); if (i >= 0)
                    primitives.splice(i, 1); return true; } };
            const regions: any[] = [];
            const region = { getState_PrimitiveId: () => 'region', getState_PourPrimitiveId: () => mode === 'wrong' ? 'foreign' : 'pour', getState_PourFills: () => [{ id: 'fill', path: { getSource: () => [0, 0, 'L', 1, 1, 0, 0] }, fill: true, lineWidth: 0 }] };
            const pour = { getState_PrimitiveId: () => 'pour', getState_PourName: () => 'N', getState_Net: () => 'N', getState_Layer: () => 1, getState_ComplexPolygon: () => ({ getSource: () => [0, 0, 'L', 1, 1, 0, 0] }), rebuildCopperRegion: async () => { await gate(); regions.push(region); return mode === 'missing' ? undefined : region; } };
            const file = async () => { await gate(); return mode === 'missing' ? undefined : new File([mode === 'wrong' ? '' : 'file'], 'data.csv'); };
            (globalThis as any).eda = { pcb_PrimitiveFill: { getAll: async () => [] }, pcb_PrimitivePour: { getAll: async () => [pour] }, pcb_PrimitivePoured: { getAll: async () => regions }, pcb_Layer: { getAllLayers: async () => [{ id: 1 }] }, pcb_ManufactureData: { getGerberFile: file, getBomFile: file, getPickAndPlaceFile: file } };
            const action = kind === 'via' ? viaHop(() => { throw Error('no optional fills'); }, () => port) : kind === 'plane' ? rebuildPlanes('pcb.pour.rebuild', () => port) : manufacture(async (b, k, n, m) => ({ id: k, kind: k, fileName: n, mimeType: m, inlineBase64: Buffer.from(await b.arrayBuffer()).toString('base64') }), () => port);
            const input = kind === 'via' ? { net: 'N', fromX: 0, fromY: 0, toX: 100, toY: 0 } : kind === 'plane' ? {} : { profile: { id: 'reviewed', reviewed: true, units: 'mm', layers: [1] } };
            const req: Request = { protocol: V2, action: kind === 'via' ? 'pcb.route.via_hop' : kind === 'plane' ? 'pcb.pour.rebuild' : 'pcb.manufacturing.export', action_revision: '1', schema: 'test', request_id: 'r', operation_id: 'o', target_ref: target, input, budget_ms: mode === 'late' ? 5 : 1000 };
            const ex = new ControlledExecutor(() => action, async () => mode === 'drift' ? { ...target, document_uuid: 'foreign' } : target), pending = ex.execute(req, 'd');
            if (mode === 'late') {
                await new Promise(r => setTimeout(r, 20));
                assert.ok(release);
                await assert.rejects(ex.execute({ ...req, operation_id: 'second' }, 'other'), /BARRIER/);
                release();
            }
            const result = await pending;
            if (mode === 'normal' || kind === 'plane' && (mode === 'late' || mode === 'missing'))
                assert.equal(result.verification.verdict, 'satisfied');
            else
                assert.notEqual(result.verification.verdict, 'satisfied');
            const count = writes;
            if (mode !== 'drift')
                await ex.reconcile('o');
            assert.equal(writes, count);
            if (mode === 'late')
                assert.equal(writes, 1);
            if (mode === 'drift')
                assert.equal(writes, 0);
        });

test('pour rebuild proves logical effect while connectivity inventory is unavailable',async()=>{
 let rebuilds=0;
 const pour={getState_PrimitiveId:()=> 'pour',getState_PourName:()=> 'GND@Top',getState_Net:()=> 'GND',getState_Layer:()=>1,getState_ComplexPolygon:()=>({getSource:()=>[0,0,'L',10,0,0,10,0,0]}),rebuildCopperRegion:async()=>{rebuilds++;return undefined}};
 (globalThis as any).eda={pcb_PrimitivePour:{getAll:async()=>[pour]},pcb_PrimitivePoured:{getAll:async()=>{throw Error('API unavailable')}}};
 const port:NativePort={calls:0,context:async()=>({projectUuid:'p',documentUuid:'d',documentType:'pcb',tabId:'t'}),read:async()=>({components:[],pads:[],traces:[],vias:[],fills:[],copper_layers:[1,2]}),create:async()=>undefined,remove:async()=>false};
 const action=rebuildPlanes('pcb.pour.rebuild',()=>port),executor=new ControlledExecutor(()=>action,async()=>target);
 const req:Request={protocol:V2,action:'pcb.pour.rebuild',action_revision:'1',schema:'test',request_id:'r',operation_id:'rebuild-no-connectivity',target_ref:target,input:{logical_ids:['GND@Top']},budget_ms:1000};
 const result=await executor.execute(req,'digest');
 assert.equal(result.verification.verdict,'satisfied');assert.equal(rebuilds,1);assert.equal((result.value as any).connectivity,'unknown');assert.equal((result.value as any).connectivity_requires,'pcb.drc');
 const missing=await new ControlledExecutor(()=>action,async()=>target).execute({...req,operation_id:'missing-pour',input:{logical_ids:['missing']}},'missing-digest');
 assert.equal(missing.effects.effect_started,false);assert.equal(rebuilds,1);
});

test('pour rebuild native rejection does not become mutation success',async()=>{
 const pour={getState_PrimitiveId:()=> 'pour',getState_PourName:()=> 'GND@Top',getState_Net:()=> 'GND',getState_Layer:()=>1,getState_ComplexPolygon:()=>({getSource:()=>[0,0,'L',10,0,0,10,0,0]}),rebuildCopperRegion:async()=>{throw Error('native rejection')}};
 (globalThis as any).eda={pcb_PrimitivePour:{getAll:async()=>[pour]},pcb_PrimitivePoured:{getAll:async()=>[]}};
 const port:NativePort={calls:0,context:async()=>({projectUuid:'p',documentUuid:'d',documentType:'pcb',tabId:'t'}),read:async()=>({components:[],pads:[],traces:[],vias:[],fills:[],copper_layers:[1,2]}),create:async()=>undefined,remove:async()=>false};
 const req:Request={protocol:V2,action:'pcb.pour.rebuild',action_revision:'1',schema:'test',request_id:'r',operation_id:'rebuild-rejected',target_ref:target,input:{logical_ids:['GND@Top']},budget_ms:1000};
 const result=await new ControlledExecutor(()=>rebuildPlanes('pcb.pour.rebuild',()=>port),async()=>target).execute(req,'digest');
 assert.notEqual(result.verification.verdict,'satisfied');assert.equal((result.value as any).item_results[0].native_settled,false);
});
