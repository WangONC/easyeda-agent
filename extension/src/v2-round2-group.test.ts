import test from 'node:test';
import assert from 'node:assert/strict';
import { groupMove } from './v2-group-move';
import { ControlledExecutor, V2, type Request } from './execution-v2';
const target = { scope: 'DOCUMENT' as const, session: 's', activation: 'a', project_uuid: 'p', document_uuid: 'd', document_type: 'schematic', tab_id: 't' };
for (const mode of ['normal', 'no-op', 'wrong', 'late', 'drift'] as const)
    test('group element scoped verification ' + mode, async () => {
        const state = { x: 1, y: 2 }, item = { getState_PrimitiveId: () => 'c', getState_Designator: () => 'R1' };
        let calls = 0, release!: () => void;
        (globalThis as any).eda = { sch_PrimitiveComponent: { getAll: async () => [item], modify: async (_id: string, patch: object) => { calls++; if (mode === 'late')
                    await new Promise<void>(r => release = r); if (mode !== 'wrong')
                    Object.assign(state, patch); return item; } }, sch_PrimitiveWire: { getAll: async () => [] } };
        const action = groupMove(async () => ({ elements: [{ id: 'c', comp: item as never }], flagPlans: [], allComponents: [item as never], allWires: [], wantIds: new Set(['c']), dx: mode === 'no-op' ? 0 : 3, dy: 0 }), () => ({ ...state }), x => x as number[]);
        const req: Request = { protocol: V2, action: 'schematic.group.move', action_revision: '1', schema: 'test', request_id: 'r', operation_id: 'o', target_ref: target, input: { primitiveIds: ['c'], dx: 3, dy: 0 }, budget_ms: mode === 'late' ? 5 : 1000 };
        const ex = new ControlledExecutor(() => action, async () => mode === 'drift' ? { ...target, document_uuid: 'other' } : target), pending = ex.execute(req, 'digest');
        if (mode === 'late') {
            await new Promise(r => setTimeout(r, 20));
            await assert.rejects(ex.execute({ ...req, operation_id: 'second' }, 'other'), /BARRIER/);
            release();
        }
        const result = await pending;
        assert.equal(calls, mode === 'no-op' || mode === 'drift' ? 0 : 1);
        assert.equal(result.verification.verdict, mode === 'drift' || mode === 'wrong' ? 'unchanged' : 'satisfied');
        if (mode !== 'drift') {
            await ex.reconcile('o');
            assert.equal(calls, mode === 'no-op' ? 0 : 1);
        }
    });
for (const partial of [false, true])
    test('group merged wire retains segment geometry ' + partial, async () => {
        const state = new Map<string, number[]>([['old', [0, 0, 10, 0, 10, 0, 10, 10]]]);
        let creates = 0, deletes = 0;
        const wire = (id: string) => ({ getState_PrimitiveId: () => id, getState_Line: () => state.get(id)!, getState_Net: () => 'N', getState_Color: () => 'green', getState_LineWidth: () => 1, getState_LineType: () => 0 });
        (globalThis as any).eda = { sch_PrimitiveComponent: { getAll: async () => [] }, sch_PrimitiveWire: { getAll: async () => [...state.keys()].map(wire), delete: async (ids: string[]) => { deletes++; ids.forEach(id => state.delete(id)); return true; }, create: async (line: number[]) => { creates++; if (partial && creates === 2)
                    throw Error('settled rejection'); state.set('merged', [...(state.get('merged') ?? []), ...line]); return wire('merged'); } } };
        const action = groupMove(async () => ({ elements: [], flagPlans: [], allComponents: [], allWires: [wire('old') as never], wantIds: new Set(['old']), dx: 5, dy: 7 }), () => ({}), x => x as number[]);
        const req: Request = { protocol: V2, action: 'schematic.group.move', action_revision: '1', schema: 's', request_id: 'r', operation_id: 'o', target_ref: target, input: { primitiveIds: ['old'], dx: 5, dy: 7 }, budget_ms: 1000 };
        const ex = new ControlledExecutor(() => action, async () => target), result = await ex.execute(req, 'd');
        assert.equal(result.verification.verdict, partial ? 'unavailable' : 'satisfied');
        if (!partial)
            assert.deepEqual(state.get('merged'), [5, 7, 15, 7, 15, 7, 15, 17]);
        await ex.reconcile('o');
        assert.equal(creates, 2);
        assert.equal(deletes, 1);
    });

test('group move accepts collinear native collapse, reordered endpoints and zero filler',async()=>{
 let rows=new Map([['old',[0,0,10,0,10,0,20,0,20,0,20,0]]]);let creates=0,deletes=0;
 const wire=(id:string)=>({getState_PrimitiveId:()=>id,getState_Line:()=>rows.get(id)!,getState_Net:()=> 'N',getState_Color:()=>null,getState_LineWidth:()=>null,getState_LineType:()=>null});
 (globalThis as any).eda={sch_PrimitiveComponent:{getAll:async()=>[]},sch_PrimitiveWire:{getAll:async()=>[...rows.keys()].map(wire),delete:async(ids:string[])=>{deletes++;ids.forEach(id=>rows.delete(id));return true;},create:async()=>{creates++;rows.set('merged',creates===1?[15,7,5,7]:[25,7,5,7,5,7,5,7]);return wire('merged');}}};
 const action=groupMove(async()=>({elements:[],flagPlans:[],allComponents:[],allWires:[wire('old') as never],wantIds:new Set(['old']),dx:5,dy:7}),()=>({}),x=>x as number[]);
 const req:Request={protocol:V2,action:'schematic.group.move',action_revision:'1',schema:'s',request_id:'r',operation_id:'o',target_ref:target,input:{primitiveIds:['old'],dx:5,dy:7},budget_ms:1000};
 const ex=new ControlledExecutor(()=>action,async()=>target),result=await ex.execute(req,'d');assert.equal(result.verification.verdict,'satisfied');
 await ex.reconcile('o');assert.equal(creates,2);assert.equal(deletes,1);
});

for(const bad of [false,true])test('group move merge into touching stationary wire keeps exact residual scope '+bad,async()=>{
 const rows=new Map([['old',[0,0,10,0]],['stationary',[30,0,40,0]]]);let creates=0,deletes=0;
 const wire=(id:string)=>({getState_PrimitiveId:()=>id,getState_Line:()=>rows.get(id)!,getState_Net:()=> 'N',getState_Color:()=>null,getState_LineWidth:()=>null,getState_LineType:()=>null});
 (globalThis as any).eda={sch_PrimitiveComponent:{getAll:async()=>[]},sch_PrimitiveWire:{getAll:async()=>[...rows.keys()].map(wire),delete:async(ids:string[])=>{deletes++;ids.forEach(id=>rows.delete(id));return true;},create:async()=>{creates++;rows.set('stationary',[20,0,bad?50:40,0]);return wire('stationary');}}};
 const action=groupMove(async()=>({elements:[],flagPlans:[],allComponents:[],allWires:[wire('old') as never,wire('stationary') as never],wantIds:new Set(['old']),dx:20,dy:0}),()=>({}),x=>x as number[]);
 const req:Request={protocol:V2,action:'schematic.group.move',action_revision:'1',schema:'s',request_id:'r',operation_id:'o',target_ref:target,input:{primitiveIds:['old'],dx:20,dy:0},budget_ms:1000};
 const ex=new ControlledExecutor(()=>action,async()=>target),result=await ex.execute(req,'d');
 assert.equal(result.verification.verdict,bad?'unavailable':'satisfied');await ex.reconcile('o');assert.equal(creates,1);assert.equal(deletes,1);
});
for(const converges of [true,false])test('group scoped readback refresh records delayed Host label '+converges,async()=>{
 let rows=new Map([['old',[500,100,650,100]]]),creates=0,deletes=0,reads=0;
 const w=(id:string)=>({getState_PrimitiveId:()=>id,getState_Line:()=>rows.get(id)!,getState_Net:()=>id==='old'||converges&&reads>1?'QUAL_WIRE':'',getState_Color:()=>null,getState_LineWidth:()=>null,getState_LineType:()=>null});
 (globalThis as any).eda={sch_PrimitiveComponent:{getAll:async()=>[]},sch_PrimitiveWire:{getAll:async()=>{if(creates)reads++;return [...rows.keys()].map(w)},delete:async()=>{deletes++;rows.clear();},create:async()=>{creates++;rows.set('new',[650,150,500,150]);return w('new')}}};
 const action=groupMove(async()=>({elements:[],flagPlans:[],allComponents:[],allWires:[w('old') as never],wantIds:new Set(['old']),dx:0,dy:50}),()=>({}),x=>x as number[]);
 const r:Request={protocol:V2,action:'schematic.group.move',action_revision:'1',schema:'s',request_id:'r',operation_id:'o',target_ref:target,input:{primitiveIds:['old'],dx:0,dy:50},budget_ms:5000};
 const ex=new ControlledExecutor(()=>action,async()=>target),result=await ex.execute(r,'d');
 assert.equal(result.verification.verdict,converges?'satisfied':'partial');assert.ok((result.evidence as any).first_readback.wire_coverage_mismatch);await ex.reconcile('o');assert.equal(creates,1);assert.equal(deletes,1);
});

for(const appears of [true,false])test('group returned identity delayed visibility '+appears,async()=>{
 let created=false,reads=0,creates=0,deletes=0;
 const wire=(id:string)=>({getState_PrimitiveId:()=>id,getState_Line:()=>id==='old'?[500,150,650,150]:[650,200,500,200],getState_Net:()=> 'QUAL_WIRE',getState_Color:()=>null,getState_LineWidth:()=>null,getState_LineType:()=>null});
 (globalThis as any).eda={sch_PrimitiveComponent:{getAll:async()=>[]},sch_PrimitiveWire:{getAll:async()=>created&&appears&&++reads>1?[wire('new')]:[],delete:async()=>{deletes++},create:async()=>{created=true;creates++;return wire('new')}}};
 const action=groupMove(async()=>({elements:[],flagPlans:[],allComponents:[],allWires:[wire('old') as never],wantIds:new Set(['old']),dx:0,dy:50}),()=>({}),x=>x as number[]);
 const req:Request={protocol:V2,action:'schematic.group.move',action_revision:'1',schema:'s',request_id:'r',operation_id:'o',target_ref:target,input:{primitiveIds:['old'],dx:0,dy:50},budget_ms:5000};
 const ex=new ControlledExecutor(()=>action,async()=>target),result=await ex.execute(req,'d');assert.equal(result.verification.verdict,appears?'satisfied':'unavailable');
 await ex.reconcile('o');assert.equal(creates,1);assert.equal(deletes,1);
});
