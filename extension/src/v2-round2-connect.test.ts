import test from 'node:test';
import assert from 'node:assert/strict';
import { ControlledExecutor, V2, type Request } from './execution-v2';
import { nativeAction } from './actions';
const target = { scope: 'DOCUMENT' as const, session: 's', activation: 'a', project_uuid: 'p', document_uuid: 'd', document_type: 'schematic', tab_id: 't' };
const request = (): Request => ({ protocol: V2, action: 'schematic.power.connect_pin', action_revision: '1', schema: 'test', request_id: 'r', operation_id: 'o', target_ref: target, input: { pinX: 0, pinY: 0, kind: 'power', net: 'VCC' }, budget_ms: 1000 });
function host(wait?: Promise<void>) { let flags: any[] = [], wires: any[] = []; let wireCalls = 0, flagCalls = 0; const create = async (_kind: string, net: string, x: number, y: number, rotation: number) => { flagCalls++; const id = net === '__ROTPROBE__' ? 'probe' : 'flag'; const f = { getState_PrimitiveId: () => id, getState_Net: () => net, getState_X: () => x, getState_Y: () => y, getState_Rotation: () => rotation }; flags.push(f); return f; }; (globalThis as any).eda = { sch_PrimitiveComponent: { getAll: async () => flags, createNetFlag: create, createNetPort: create, delete: async (ids: string[]) => { flags = flags.filter(x => !ids.includes(x.getState_PrimitiveId())); return true; } }, sch_PrimitiveWire: { getAll: async () => wires, create: async (points: number[]) => { wireCalls++; if (wait)
            await wait; const w = { getState_PrimitiveId: () => 'wire', getState_Line: () => points, getState_Net:()=>flags.some(f=>f.getState_Net()==='VCC')?'VCC':'',getState_Color:()=>null,getState_LineWidth:()=>null,getState_LineType:()=>null }; wires.push(w); return w; } } }; return { wireCalls: () => wireCalls, flagCalls: () => flagCalls }; }
test('connect_pin completes geometry and removes controlled calibration probe', async () => { const h = host(); const r = await new ControlledExecutor(nativeAction, async () => target).execute(request(), 'd'); assert.equal(r.verification.verdict, 'satisfied'); assert.equal(r.verification.residual, 0); assert.equal(h.wireCalls(), 1); assert.equal(h.flagCalls(), 2); });
test('connect_pin late wire settle never retries wire or starts flag after deadline', async () => { let settle!: () => void; const h = host(new Promise<void>(r => settle = r)), x = new ControlledExecutor(nativeAction, async () => target); const q = request(); q.budget_ms = 10; const pending = x.execute(q, 'd'); await new Promise(r => setTimeout(r, 30)); await assert.rejects(x.execute({ ...q, operation_id: 'second' }, 'e'), /BARRIER/); settle(); const result = await pending; assert.equal(result.effects.reconciled, true); assert.equal(result.verification.verdict, 'partial'); await x.reconcile('o'); await x.execute(q, 'd'); assert.equal(h.wireCalls(), 1); assert.equal(h.flagCalls(), 1); });
test('connect_pin target mismatch admits no calibration probe', async () => { const h = host(); const r = await new ControlledExecutor(nativeAction, async () => ({ ...target, document_uuid: 'foreign' })).execute(request(), 'd'); assert.equal(r.effects.effect_started, false); assert.equal(h.flagCalls(), 0); });

test('connect_pin rejects merged residual change on existing wire without replay', async()=>{
 const h=host(); const eda=(globalThis as any).eda;let line=[100,100,120,100];
 const existing={getState_PrimitiveId:()=> 'existing',getState_Line:()=>line,getState_Net:()=>'',getState_Color:()=>null,getState_LineWidth:()=>null,getState_LineType:()=>null};
 const originalRead=eda.sch_PrimitiveWire.getAll,originalCreate=eda.sch_PrimitiveWire.create;
 eda.sch_PrimitiveWire.getAll=async()=>[existing,...await originalRead()];
 eda.sch_PrimitiveWire.create=async(points:number[])=>{line=[100,100,200,100];return originalCreate(points);};
 const ex=new ControlledExecutor(nativeAction,async()=>target);const result=await ex.execute(request(),'d');
 assert.equal(result.verification.verdict,'unavailable');assert.equal(result.effects.state_changed,null);
 await ex.reconcile('o');assert.equal(h.wireCalls(),1);
});

test('connect_pin verifies a returned existing merged wire identity without a second create',async()=>{
 const h=host(),eda=(globalThis as any).eda;let line=[-10,0,0,0];
 const existing={getState_PrimitiveId:()=> 'merged',getState_Line:()=>line,getState_Net:()=>named?'VCC':'',getState_Color:()=>null,getState_LineWidth:()=>null,getState_LineType:()=>null};
 let named=false;const createFlag=eda.sch_PrimitiveComponent.createNetFlag;
 eda.sch_PrimitiveComponent.createNetFlag=async(...args:any[])=>{const f=await createFlag(...args);if(args[1]==='VCC')named=true;return f;};
 const originalCreate=eda.sch_PrimitiveWire.create;
 eda.sch_PrimitiveWire.getAll=async()=>[existing];
 eda.sch_PrimitiveWire.create=async(points:number[])=>{await originalCreate(points);line=[...points.slice(2),...points.slice(0,2),0,0,-10,0,0,0,0,0];return existing;};
 const ex=new ControlledExecutor(nativeAction,async()=>target),result=await ex.execute(request(),'d');
 assert.equal(result.verification.verdict,'satisfied');assert.equal((result.value as any).wirePrimitiveId,'merged');
 await ex.reconcile('o');await ex.execute(request(),'d');assert.equal(h.wireCalls(),1);assert.equal(h.flagCalls(),2);
});

for (const label of ['', 'FOREIGN', undefined]) test('connect_pin raw wire label is separate from flag net '+String(label), async()=>{
 const h=host(),eda=(globalThis as any).eda,create=eda.sch_PrimitiveWire.create;
 eda.sch_PrimitiveWire.create=async(points:number[])=>{const w=await create(points);w.getState_Net=()=>label;return w;};
 const ex=new ControlledExecutor(nativeAction,async()=>target),result=await ex.execute(request(),'d');
 assert.equal(result.verification.verdict,label===''?'satisfied':'unavailable');
 await ex.reconcile('o');await ex.execute(request(),'d');assert.equal(h.wireCalls(),1);assert.equal(h.flagCalls(),2);
});
