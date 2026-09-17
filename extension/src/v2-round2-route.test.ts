import test from 'node:test';
import assert from 'node:assert/strict';
import { ControlledExecutor, V2, type Request } from './execution-v2';
import { canonicalCopperGeometry, copperGeometryEquivalent, routeBatch } from './v2-route-batch';
import { fastPath, type NativePort, type Primitive, type Operation } from './fast-path';
const target = { scope: 'DOCUMENT' as const, session: 's', activation: 'a', project_uuid: 'p', document_uuid: 'd', document_type: 'pcb', tab_id: 't' };
const ops: Operation[] = [0, 1, 2].map(i => ({ type: 'add_trace', net: 'N', layer: 1, width: 6, points: [[i * 10, 0], [i * 10 + 5, 0]] }));
async function setup(mode: 'normal' | 'wrong' | 'missing' | 'late' = 'normal') {
    let traces: Primitive[] = [], calls = 0, release!: () => void;
    const port: NativePort = { calls: 0, context: async () => ({ projectUuid: 'p', documentUuid: 'd', documentType: 'pcb', tabId: 't' }), read: async () => ({ components: [], pads: [], traces: [...traces].reverse(), vias: [], fills: [], copper_layers: [1, 2] }), create: async (op) => { calls++; if (mode === 'late')
            await new Promise<void>(r => release = r); const id = 'created' + calls; traces.push({ id, kind: 'trace', net: op.net, layer: op.layer, width: mode === 'wrong' ? 99 : op.width, points: op.points }); return mode === 'missing' ? undefined : id; }, remove: async (_, id) => { traces = traces.filter(p => p.id !== id); return true; } };
    const base = (await fastPath.snapshotData(port, { project_uuid: 'p', document_uuid: 'd' })).data.board_revision;
    const req: Request = { protocol: V2, action: 'route.apply_batch', action_revision: '1', schema: 'test', request_id: 'r', operation_id: 'op', target_ref: target, input: { client_transaction_id: 'op', base_revision: base, plan_hash: 'plan', operations: ops }, budget_ms: 1000 };
    const x = new ControlledExecutor(() => routeBatch(() => port), async () => target);
    return { x, req, count: () => calls, release: () => release() };
}
for (const mode of ['normal', 'wrong', 'missing'] as const)
    test('V2 Fast explicit geometry ' + mode, async () => {
        const h = await setup(mode), r = await h.x.execute(h.req, 'digest');
        assert.equal(r.verification.verdict, mode === 'normal' ? 'satisfied' : mode === 'wrong' ? 'partial' : 'unavailable');
        const count = h.count();
        await h.x.execute(h.req, 'digest');
        await h.x.reconcile('op');
        assert.equal(h.count(), count);
    });
test('V2 Fast deadline late settle does not start second item or replay', async () => {
    const h = await setup('late');
    h.req.budget_ms = 10;
    const pending = h.x.execute(h.req, 'd');
    await new Promise(r => setTimeout(r, 30));
    await assert.rejects(h.x.execute({ ...h.req, operation_id: 'second' }, 'other'), /BARRIER/);
    h.release();
    const r = await pending;
    assert.equal(h.count(), 1);
    assert.equal(r.effects.reconciled, true);
    assert.equal(r.verification.verdict, 'partial');
    await h.x.reconcile('op');
    assert.equal(h.count(), 1);
});
test('V2 Fast foreign transaction and target rejected without write', async () => {
    const h = await setup();
    h.req.input.client_transaction_id = 'foreign';
    const r = await h.x.execute(h.req, 'd');
    assert.equal(r.effects.effect_started, false);
    assert.equal(h.count(), 0);
});

const trace=(id:string,x1:number,y1:number,x2:number,y2:number,net='N',layer=1,width=6):Primitive=>({id,kind:'trace',net,layer,width,points:[[x1,y1],[x2,y2]]});
test('canonical copper accepts Host merge 41 planned segments into 38 traces and split equivalence',()=>{
 const planned=[0,1,2,3].map(i=>trace('join-'+i,i,0,i+1,0));
 for(let i=0;i<37;i++)planned.push(trace('separate-'+i,100+i*2,0,101+i*2,0));
 const observed=[trace('merged',0,0,4,0),...planned.slice(4)];
 assert.equal(planned.length,41);assert.equal(observed.length,38);assert.equal(copperGeometryEquivalent(planned,observed),true);
 assert.equal(copperGeometryEquivalent([trace('whole',0,0,10,0)],[trace('left',0,0,4,0),trace('right',4,0,10,0)]),true);
 assert.notEqual(canonicalCopperGeometry(planned),null);
});
test('canonical copper rejects missing, wrong net/layer/width and unrelated branch',()=>{
 const expected=[trace('a',0,0,10,0)];
 for(const actual of [[],[trace('a',0,0,9,0)],[trace('a',0,0,10,0,'OTHER')],[trace('a',0,0,10,0,'N',2)],[trace('a',0,0,10,0,'N',1,8)],[trace('a',0,0,10,0),trace('branch',5,0,5,5)]])assert.equal(copperGeometryEquivalent(expected,actual),false);
});
test('route batch terminalizes a 41-to-38 Host canonical merge without replay',async()=>{
 const planned:Operation[]=[0,1,2,3].map(i=>({type:'add_trace',net:'N',layer:1,width:6,points:[[i,0],[i+1,0]]}));
 for(let i=0;i<37;i++)planned.push({type:'add_trace',net:'N',layer:1,width:6,points:[[100+i*2,0],[101+i*2,0]]});
 let traces:Primitive[]=[],writes=0;
 const port:NativePort={calls:0,context:async()=>({projectUuid:'p',documentUuid:'d',documentType:'pcb',tabId:'t'}),read:async()=>({components:[],pads:[],traces:structuredClone(traces),vias:[],fills:[],copper_layers:[1,2]}),create:async op=>{writes++;const id='created-'+writes;traces.push({id,kind:'trace',net:op.net,layer:op.layer,width:op.width,points:op.points});if(writes===planned.length)traces=[trace('host-merged',0,0,4,0),...traces.slice(4)];return id},remove:async()=>true};
 const base=(await fastPath.snapshotData(port,{project_uuid:'p',document_uuid:'d'})).data.board_revision;
 const req:Request={protocol:V2,action:'route.apply_batch',action_revision:'1',schema:'test',request_id:'r',operation_id:'canonical-merge',target_ref:target,input:{client_transaction_id:'canonical-merge',base_revision:base,plan_hash:'plan',operations:planned},budget_ms:3000};
 const executor=new ControlledExecutor(()=>routeBatch(()=>port),async()=>target),result=await executor.execute(req,'digest');
 assert.equal(result.verification.verdict,'satisfied');assert.equal((result.value as any).canonical_trace_geometry_equivalent,true);assert.equal((result.value as any).observed_trace_primitives,38);assert.equal(writes,41);
 await executor.reconcile('canonical-merge');assert.equal(writes,41);
});
test('pre-existing same-net copper cannot mask a missing add mutation',async()=>{
 let writes=0;const traces:Primitive[]=[trace('existing',0,0,10,0)];
 const port:NativePort={calls:0,context:async()=>({projectUuid:'p',documentUuid:'d',documentType:'pcb',tabId:'t'}),read:async()=>({components:[],pads:[],traces:structuredClone(traces),vias:[],fills:[],copper_layers:[1,2]}),create:async()=>{writes++;return 'claimed-created'},remove:async()=>true};
 const base=(await fastPath.snapshotData(port,{project_uuid:'p',document_uuid:'d'})).data.board_revision;
 const operation:Operation={type:'add_trace',net:'N',layer:1,width:6,points:[[0,0],[10,0]]};
 const req:Request={protocol:V2,action:'route.apply_batch',action_revision:'1',schema:'test',request_id:'r',operation_id:'preexisting-mask',target_ref:target,input:{client_transaction_id:'preexisting-mask',base_revision:base,plan_hash:'plan',operations:[operation]},budget_ms:3000};
 const executor=new ControlledExecutor(()=>routeBatch(()=>port),async()=>target),result=await executor.execute(req,'digest');
 assert.notEqual(result.verification.verdict,'satisfied');assert.equal((result.value as any).canonical_trace_geometry_equivalent,true);assert.deepEqual((result.value as any).unproven_trace_delta_indices,[0]);assert.equal((result.value as any).item_results[0].postcondition_satisfied,false);assert.equal(writes,1);
 await executor.reconcile('preexisting-mask');assert.equal(writes,1);
});
