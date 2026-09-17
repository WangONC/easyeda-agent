import { nativeAction } from './actions';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ControlledExecutor, V2, type Request, type NativeAction } from './execution-v2';
import { componentModify, pcbDrc, symbolCreate, symbolDelete, read } from './v2-native-actions';
const target={scope:'DOCUMENT' as const,session:'s',activation:'a',project_uuid:'p',document_uuid:'d',document_type:'pcb',tab_id:'t'};
const request=(input:Record<string,unknown>,id='op'):Request=>({protocol:V2,action:'test',action_revision:'1',schema:'schema',request_id:'request',operation_id:id,target_ref:target,input,budget_ms:1000});
const host=(value:unknown)=>{(globalThis as unknown as {eda:unknown}).eda=value;};
const run=(action:NativeAction,input:Record<string,unknown>)=>new ControlledExecutor(()=>action,async()=>target).execute(request(input),'digest');
const getters:Record<string,string>={PrimitiveId:'primitiveId',UniqueId:'uniqueId',Designator:'designator',Name:'name',Layer:'layer',X:'x',Y:'y',Rotation:'rotation',PrimitiveLock:'locked',AddIntoBom:'addIntoBom',ManufacturerId:'manufacturerId',SupplierId:'supplierId'};
function component(state:Record<string,unknown>):unknown {return new Proxy({}, {get:(_,key)=>typeof key==='string'&&key.startsWith('getState_')?()=>state[getters[key.slice(9)]]:undefined});}
test('document.current checks native identity, not legacy ok',async()=>{
 const documentCurrent=nativeAction('document.current')!;
 (globalThis as any).EDMT_EditorDocumentType={HOME:0,BLANK:5,SCHEMATIC_PAGE:1,PCB:3,SYMBOL_COMPONENT:2,FOOTPRINT:4,PANEL:6};
 host({dmt_SelectControl:{getCurrentDocumentInfo:async()=>({uuid:'d',tabId:'t',documentType:3})}});
 assert.equal((await run(documentCurrent,{})).verification.verdict,'satisfied');
 host({dmt_SelectControl:{getCurrentDocumentInfo:async()=>({ok:true})}});
 assert.notEqual((await run(documentCurrent,{})).verification.verdict,'satisfied');
});
for(const mode of ['applied','echo-only','no-op'] as const)test('component fresh patch '+mode,async()=>{
 let writes=0;const state:Record<string,unknown>={primitiveId:'c1',x:mode==='no-op'?12:0,y:0,rotation:0,layer:1,locked:false};
 host({pcb_PrimitiveComponent:{get:async()=>component({...state}),modify:async(_id:string,patch:Record<string,unknown>)=>{writes++;if(mode==='applied')Object.assign(state,patch);return component({...state,...patch});}}});
 const result=await run(componentModify,{primitiveId:'c1',patch:{x:12}});
 assert.equal(result.verification.verdict,mode==='echo-only'?'unchanged':'satisfied');
 assert.equal(result.effects.state_changed,mode==='applied');assert.equal(writes,mode==='no-op'?0:1);
});
for(const raw of [[],[{name:'clearance',list:[{name:'GND',list:[{errorType:1}]}]}],true,{},[{unexpected:true}]])test('DRC shape '+JSON.stringify(raw),async()=>{
 host({pcb_Drc:{check:async()=>raw}});const result=await run(pcbDrc,{});
 const known=Array.isArray(raw)&&(raw.length===0||'name' in raw[0]);
 assert.equal(result.verification.verdict,known?'satisfied':'unavailable');
 if(known)assert.equal((result.value as {design_pass:boolean}).design_pass,raw.length===0);
});
test('create/delete identity and absence are read fresh; native error is not absence',async()=>{
 const library={...target,scope:'LIBRARY' as const,library_uuid:'lib',document_uuid:undefined,document_type:undefined,tab_id:undefined};
 let asset:{uuid:string;name:string}|undefined;let writes=0;
 host({lib_Symbol:{create:async(_lib:string,name:string)=>{writes++;asset={uuid:'new-id',name};return 'new-id';},get:async()=>asset,delete:async()=>{writes++;asset=undefined;return true;}}});
 const runtime=new ControlledExecutor(name=>name==='create'?symbolCreate:symbolDelete,async()=>library);
 const create={...request({name:'EA_AGENT__TEST'},'create'),action:'create',target_ref:library};
 const created=await runtime.execute(create,'a');assert.equal(created.verification.verdict,'satisfied');runtime.release('create','a');
 const remove={...request({uuid:'new-id',expectedName:'EA_AGENT__TEST'},'delete'),action:'delete',target_ref:library};
 const deleted=await runtime.execute(remove,'b');assert.equal(deleted.verification.verdict,'satisfied');assert.equal(writes,2);
 host({lib_Symbol:{get:async()=>{throw Error('network read failure');}}});
 const uncertain=await new ControlledExecutor(()=>symbolDelete,async()=>library).execute({...remove,operation_id:'missing'},'c');
 assert.notEqual(uncertain.verification.verdict,'satisfied');
});
test('read template rejects unavailable native value',async()=>{assert.notEqual((await run(read(async()=>undefined),{})).verification.verdict,'satisfied');});

for (const kind of ['via', 'line'] as const) {
 for (const scenario of ['success', 'echo-only', 'wrong-target', 'late-settle'] as const) {
  test(`${kind} create verifies fresh identity: ${scenario}`, async () => {
   const { viaCreate, lineCreate } = await import('./v2-native-actions');
   const input = kind === 'via'
    ? { x: 10, y: 20, net: 'GND', holeDiameter: 10, diameter: 20 }
    : { startX: 0, startY: 0, endX: 10, endY: 20, net: 'GND', layer: 1, lineWidth: 6 };
   const nativeFields = Object.fromEntries(Object.entries(input).map(([key, value]) => [key[0].toUpperCase() + key.slice(1), value]));
   const primitive = () => new Proxy({}, {
    get: (_object, key) => key === 'getState_PrimitiveId' ? () => 'created'
     : typeof key === 'string' && key.startsWith('getState_') ? () => nativeFields[key.slice(9)] : undefined,
   });
   let writes = 0, reads = 0, stored = false;
   let settle!: () => void;
   const pending = new Promise<void>(resolve => { settle = resolve; });
   host({
    pcb_Net: { getAllNetsName: async () => ['GND'] },
    [kind === 'via' ? 'pcb_PrimitiveVia' : 'pcb_PrimitiveLine']: {
     getAll: async () => [],
     create: async () => {
      writes++;
      if (scenario === 'late-settle') await pending;
      stored = scenario !== 'echo-only';
      return primitive();
     },
     get: async () => { reads++; return stored ? primitive() : undefined; },
    },
   });
   const runtime = new ControlledExecutor(() => kind === 'via' ? viaCreate : lineCreate,
    async () => scenario === 'wrong-target' ? { ...target, document_uuid: 'foreign' } : target);
   const operation = { ...request(input), budget_ms: scenario === 'late-settle' ? 10 : 1000 };
   const completion = runtime.execute(operation, 'digest');
   if (scenario === 'late-settle') {
    await new Promise(resolve => setTimeout(resolve, 20));
    await assert.rejects(runtime.execute({ ...operation, operation_id: 'blocked' }, 'other'), /BARRIER/);
    settle();
   }
   const result = await completion;
   assert.equal(writes, scenario === 'wrong-target' ? 0 : 1);
   assert.equal(result.verification.verdict === 'satisfied', scenario === 'success' || scenario === 'late-settle');
   if (scenario === 'late-settle') {
    assert.equal(result.effects.reconciled, true);
    assert.equal(result.effects.native_settled, true);
    assert.ok(reads >= 1);
   }
  });
 }
}

for (const mode of ['create', 'delete'] as const) for (const scenario of ['success', 'no-op', 'echo-only', 'wrong-target', 'late-settle'] as const) {
 test(`equal-length ${mode}: ${scenario}`, async () => {
  const { equalLengthGroup } = await import('./v2-native-actions');
  const group = { name: 'bus', nets: ['A', 'B'], color: '#ffffff' };
  let groups = mode === 'delete' ? [group] : [];
  if (scenario === 'no-op') groups = mode === 'create' ? [group] : [];
  let writes = 0, settle!: () => void;
  const wait = new Promise<void>(resolve => { settle = resolve; });
  const write = async () => { writes++; if (scenario === 'late-settle') await wait; if (scenario !== 'echo-only') groups = mode === 'create' ? [group] : []; return true; };
  host({ pcb_Net: { getAllNetsName: async () => ['A', 'B'] }, pcb_Drc: { getAllEqualLengthNetGroups: async () => groups.map(g => ({ ...g, nets: [...g.nets] })), createEqualLengthNetGroup: write, deleteEqualLengthNetGroup: write } });
  const executor = new ControlledExecutor(() => equalLengthGroup(mode), async () => scenario === 'wrong-target' ? { ...target, document_uuid: 'other' } : target);
  const r = { ...request({ name: 'bus', nets: ['A', 'B'] }), budget_ms: scenario === 'late-settle' ? 10 : 1000 };
  const pending = executor.execute(r, 'd');
  if (scenario === 'late-settle') { await new Promise(resolve => setTimeout(resolve, 20)); await assert.rejects(executor.execute({ ...r, operation_id: 'second' }, 'other'), /BARRIER/); settle(); }
  const result = await pending;
  assert.equal(result.verification.verdict === 'satisfied', ['success', 'no-op', 'late-settle'].includes(scenario));
  assert.equal(writes, ['no-op', 'wrong-target'].includes(scenario) ? 0 : 1);
  if (scenario === 'late-settle') assert.equal(result.effects.reconciled, true);
 });
}
for (const side of [false, true]) for (const scenario of ['success', 'echo-only', 'wrong-target', 'late-settle'] as const) {
 test(`layer focus side=${side}: ${scenario}`, async () => {
  const { layerVisibility } = await import('./v2-native-actions');
  let layers = [1, 2, 3, 4].map(id => ({ id, layerStatus: 1 }));
  let current = 1, writes = 0, settle!: () => void;
  const wait = new Promise<void>(resolve => { settle = resolve; });
  host({ pcb_Layer: { getAllLayers: async () => layers.map(l => ({ ...l })), getCurrentLayer: () => ({ id: current }),
   selectLayer: async (id: number) => { writes++; current = id; return true; },
   setLayerVisible: async (ids: number[], exclusive: boolean) => { writes++; if (scenario === 'late-settle') await wait; if (scenario !== 'echo-only') layers = layers.map(l => ({ ...l, layerStatus: ids.includes(l.id) ? 1 : exclusive ? 2 : l.layerStatus })); return true; },
  } });
  const executor = new ControlledExecutor(() => layerVisibility(side), async () => scenario === 'wrong-target' ? { ...target, document_uuid: 'other' } : target);
  const r = { ...request(side ? { side: ' ToP ' } : { preset: 'top-only' }), budget_ms: scenario === 'late-settle' ? 10 : 1000 };
  const pending = executor.execute(r, 'd');
  if (scenario === 'late-settle') { await new Promise(resolve => setTimeout(resolve, 20)); await assert.rejects(executor.execute({ ...r, operation_id: 'second' }, 'other'), /BARRIER/); settle(); }
  const result = await pending;
  assert.equal(result.verification.verdict === 'satisfied', scenario === 'success' || scenario === 'late-settle');
  assert.equal(writes, scenario === 'wrong-target' ? 0 : 1);
  if (scenario === 'late-settle') assert.equal(result.effects.reconciled, true);
 });
}

test('baseline name-only group delete and pair rename retain their input capabilities', async () => {
 const { equalLengthGroup, differential } = await import('./v2-native-actions');
 let groups = [{ name: 'bus', nets: ['A', 'B'] }];
 let pairs = [{ name: 'usb', positiveNet: 'DP', negativeNet: 'DN' }];
 host({ pcb_Drc: {
  getAllEqualLengthNetGroups: async () => groups.map(x => ({ ...x })),
  deleteEqualLengthNetGroup: async () => { groups = []; return true; },
  getAllDifferentialPairs: async () => pairs.map(x => ({ ...x })),
  modifyDifferentialPairName: async (_old: string, name: string) => { pairs = pairs.map(x => ({ ...x, name })); return true; },
 } });
 assert.equal((await run(equalLengthGroup('delete'), { name: 'bus' })).verification.verdict, 'satisfied');
 assert.equal((await run(differential('rename'), { name: 'usb', newName: 'usb_data' })).verification.verdict, 'satisfied');
 assert.deepEqual(pairs, [{ name: 'usb_data', positiveNet: 'DP', negativeNet: 'DN' }]);
});
test('layer names, numeric strings, aliases and inner-layer names remain supported', async () => {
 const { layerSelect, layerVisibility } = await import('./v2-native-actions');
 let layers = [{ id: 1, name: 'Top Layer', layerStatus: 1 }, { id: 2, name: 'Bottom Layer', layerStatus: 1 }, { id: 15, name: 'Inner 1', layerStatus: 1 }];
 let current = 1;
 host({ pcb_Layer: {
  getAllLayers: async () => layers.map(x => ({ ...x })), getCurrentLayer: () => ({ id: current }),
  selectLayer: async (id: number) => { current = id; return true; },
  setLayerVisible: async (ids: number[], exclusive: boolean) => { layers = layers.map(x => ({ ...x, layerStatus: ids.includes(x.id) ? 1 : exclusive ? 2 : x.layerStatus })); return true; },
  setLayerInvisible: async (ids: number[]) => { layers = layers.map(x => ({ ...x, layerStatus: ids.includes(x.id) ? 2 : x.layerStatus })); return true; },
 } });
 for (const layer of ['bottom', 'top copper', 'Inner1', '2', 1]) assert.equal((await run(layerSelect, { layer })).verification.verdict, 'satisfied');
 assert.equal((await run(layerVisibility(), { show: ['inner1'], hide: ['bottom'], exclusive: true })).verification.verdict, 'satisfied');
 assert.deepEqual(layers.map(x => x.layerStatus), [2, 2, 1]);
});

for (const kind of ['pcb','schematic'] as const) for (const scenario of ['ack','reject','late-ack','wrong-target'] as const) {
 test(`save command contract ${kind}: ${scenario}`, async () => {
  const { saveDocument } = await import('./v2-native-actions');
  let writes=0,settle!:()=>void;const wait=new Promise<void>(resolve=>{settle=resolve;});
  const save=async()=>{writes++;if(scenario==='late-ack')await wait;return scenario!=='reject';};
  host({pcb_Document:{save},sch_Document:{save}});
  const executor=new ControlledExecutor(()=>saveDocument(kind),async()=>scenario==='wrong-target'?{...target,document_uuid:'foreign'}:target);
  const r={...request({}),budget_ms:scenario==='late-ack'?10:1000};const pending=executor.execute(r,'d');
  if(scenario==='late-ack'){await new Promise(resolve=>setTimeout(resolve,20));await assert.rejects(executor.execute({...r,operation_id:'other'},'other'),/BARRIER/);settle();}
  const result=await pending;assert.equal(result.verification.verdict==='satisfied',scenario==='ack'||scenario==='late-ack');assert.equal(writes,scenario==='wrong-target'?0:1);
  if(scenario==='ack'||scenario==='late-ack')assert.equal((result.value as {checkpoint_proven:boolean}).checkpoint_proven,false);
  if(scenario==='late-ack')assert.equal(result.effects.reconciled,true);
 });
}
test('toast void-return is command acceptance, not visual observation',async()=>{
 const {notification}=await import('./v2-native-actions');let argumentsSeen:unknown[]=[];
 host({sys_Message:{showToastMessage:(...args:unknown[])=>{argumentsSeen=args;}}});
 const result=await run(notification,{message:'ready',type:'warning',duration:0});assert.equal(result.verification.verdict,'satisfied');assert.deepEqual(argumentsSeen,['ready','warn',0]);assert.deepEqual(result.verification.checked,['native_synchronous_notification_returned']);
});
test('viewport return contract preserves reversed-region normalization',async()=>{
 const {viewport}=await import('./v2-native-actions');let args:unknown[]=[];
 host({dmt_EditorControl:{zoomToRegion:async(...values:unknown[])=>{args=values;return true;},zoomTo:async()=>({left:0,right:10,top:0,bottom:20})}});
 assert.equal((await run(viewport('region'),{left:10,right:0,top:20,bottom:0})).verification.verdict,'satisfied');assert.deepEqual(args,[0,10,0,20,'t']);assert.equal((await run(viewport('zoom'),{})).verification.verdict,'satisfied');
 host({dmt_EditorControl:{zoomTo:async()=>({ok:true})}});assert.equal((await run(viewport('zoom'),{})).verification.verdict,'unavailable');
});
test('titleblock unknown fields are ignored and structural fields never forwarded',async()=>{
 const {titleBlockModify}=await import('./v2-native-actions');let data:Record<string,{value:string}>={Name:{value:'old'},Symbol:{value:'Drawing_A4'}},writes=0;let forwarded:unknown;
 host({dmt_Schematic:{getSchematicPageInfo:async()=>({uuid:'d',showTitleBlock:true,titleBlockData:structuredClone(data)}),modifySchematicPageTitleBlock:async(_visible:unknown,patch:typeof data)=>{writes++;forwarded=patch;data={...data,...patch};return true;}}});
 const result=await run(titleBlockModify,{titleBlockData:{Name:{value:'new'},NotAField:{value:'ignored'},Symbol:{value:'Drawing_A4'}}});assert.equal(result.verification.verdict,'satisfied');assert.deepEqual(forwarded,{Name:{value:'new'}});assert.equal(writes,1);assert.deepEqual((result.value as {ignoredKeys:string[]}).ignoredKeys,['NotAField','Symbol']);
 const noop=await run(titleBlockModify,{titleBlockData:{NotAField:{value:'ignored'}}});assert.equal(noop.verification.verdict,'satisfied');assert.equal(writes,1);assert.equal(noop.effects.effect_started,false);
 const refused=await run(titleBlockModify,{titleBlockData:{Symbol:{value:'broken'}}});assert.notEqual(refused.verification.verdict,'satisfied');assert.equal(writes,1);
});

for (const rebuild of ['filled', 'empty', 'reject'] as const) test(`pour baseline best-effort rebuild: ${rebuild}`, async () => {
 const { pourCreate } = await import('./v2-native-actions');
 const source = [0, 0, 'L', 10, 0, 0, 10, 0, 0];
 let created = false;
 const primitive = (id: string) => ({
  getState_PrimitiveId: () => id, getState_PourName: () => 'shared',
  getState_Net: () => 'GND', getState_Layer: () => 1,
  getState_PourFillMethod: () => 'solid', getState_ComplexPolygon: () => ({getSource: () => source}),
  getState_PourPriority: () => 0, getState_LineWidth: () => 0,
  rebuildCopperRegion: async () => { if (rebuild === 'reject') throw Error('native rebuild failed'); return rebuild === 'filled'; },
 });
 host({pcb_Net:{getAllNetsName:async()=>['GND']},pcb_MathPolygon:{createPolygon:()=>({getSource:()=>source})},pcb_PrimitivePour:{
  getAll:async()=>created?[primitive('old'),primitive('new')]:[primitive('old')],
  create:async()=>{created=true;return primitive('new');},
 }});
 const result=await run(pourCreate,{points:[[0,0],[10,0],[0,10]],net:'GND',name:'shared'});
 assert.equal(result.verification.verdict,'satisfied');
 assert.equal((result.value as {poured:boolean}).poured,rebuild==='filled');
 assert.equal((result.value as {connectivity:string}).connectivity,'unknown');
 assert.equal((result.value as {connectivity_requires:string}).connectivity_requires,'pcb.drc');
 assert.equal(result.effects.native_settled,true);
});

test('notification keeps baseline unknown-type fallback and records no persistence claim', async () => {
 const {notification}=await import('./v2-native-actions');
 let called:unknown[]=[];
 host({sys_Message:{showToastMessage:(...args:unknown[])=>{called=args;}}});
 const result=await run(notification,{message:'hello',type:'custom',duration:0});
 assert.deepEqual(called,['hello','info',0]);
 assert.equal(result.verification.verdict,'satisfied');
 assert.equal(result.effects.state_changed,null);
});

test('late DRC completion reconciles its own report without a second recompute',async()=>{
 let calls=0,settle!:(value:unknown)=>void;
 const pendingNative=new Promise(resolve=>{settle=resolve;});
 host({pcb_Drc:{check:async()=>{calls++;return pendingNative;}}});
 const executor=new ControlledExecutor(()=>pcbDrc,async()=>target);
 const req={...request({}),budget_ms:10};
 const pending=executor.execute(req,'digest');
 await new Promise(resolve=>setTimeout(resolve,25));
 await assert.rejects(executor.execute({...req,operation_id:'second'},'other'),/BARRIER/);
 settle([]);
 const result=await pending;
 assert.equal(result.verification.verdict,'satisfied');
 assert.equal(result.effects.reconciled,true);
 assert.equal((result.value as {design_pass:boolean}).design_pass,true);
 await executor.execute(req,'digest');
 assert.equal(calls,1);
 executor.release(req.operation_id,'digest');
});

for(const mode of ['normal','missing-return-id','wrong-return-id','foreign-new','unrelated-changed','duplicate','geometry-mismatch','late'] as const)test('pour create requires returned identity and complete residual '+mode,async()=>{
 const {pourCreate}=await import('./v2-native-actions');let created=false,writes=0,release!:()=>void;
 const source=[0,0,'L',10,0,0,10,0,0];
 const primitive=(id:string)=>({getState_PrimitiveId:()=>id,getState_PourName:()=> 'shared',getState_Net:()=>created&&mode==='unrelated-changed'&&id==='old'?'OTHER':'GND',getState_Layer:()=>1,getState_PourFillMethod:()=> 'solid',getState_ComplexPolygon:()=>({getSource:()=>mode==='geometry-mismatch'&&id==='new'?[99,...source.slice(1)]:source}),getState_PourPriority:()=>0,getState_LineWidth:()=>0,rebuildCopperRegion:async()=>false});
 host({pcb_MathPolygon:{createPolygon:()=>({getSource:()=>source})},pcb_PrimitivePour:{getAll:async()=>created?[primitive('old'),primitive('new'),...(mode==='foreign-new'?[primitive('foreign')]:mode==='duplicate'?[primitive('new')]:[])]:[primitive('old')],create:async()=>{writes++;if(mode==='late')await new Promise<void>(r=>release=r);created=true;return mode==='missing-return-id'?undefined:primitive(mode==='wrong-return-id'?'wrong':'new');}}});
 const ex=new ControlledExecutor(()=>pourCreate,async()=>target),req={...request({points:[[0,0],[10,0],[0,10]],net:'GND',name:'shared'}),budget_ms:mode==='late'?5:1000};
 const pending=ex.execute(req,'d');if(mode==='late'){await new Promise(r=>setTimeout(r,20));assert.ok(release);await assert.rejects(ex.execute({...req,operation_id:'second'},'different'),/BARRIER/);release();}
 const h=await pending;if(mode==='geometry-mismatch'){const e=h.evidence as any;assert.deepEqual(e.expected_source,source);assert.equal(e.actual_source[0],99);}assert.equal(h.verification.verdict==='satisfied',mode==='normal'||mode==='late');await ex.reconcile(req.operation_id);await ex.execute(req,'d');assert.equal(writes,1);
});
