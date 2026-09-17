import test from 'node:test';
import assert from 'node:assert/strict';
import {ControlledExecutor,V2,type Request} from './execution-v2';
import {documentOpen} from './v2-native-actions';
const target={scope:'DOCUMENT' as const,session:'s',activation:'a',project_uuid:'p',document_uuid:'d',document_type:'pcb',tab_id:'d@p'};
for(const mode of ['normal','save-reject','close-retained','open-wrong','late-close','target-mismatch','last-tab-tree-null'] as const)test('checkpoint controlled reload '+mode,async()=>{
 let current:any={uuid:'d',tabId:'d@p',documentType:3},tabs=['d@p'],saved=0,closed=0,opened=0,settle!:()=>void;
 (globalThis as any).eda={dmt_Schematic:{getAllSchematicPagesInfo:async()=>[]},dmt_Pcb:{getAllPcbsInfo:async()=>[]},dmt_SelectControl:{getCurrentDocumentInfo:async()=>current},dmt_EditorControl:{getSplitScreenIdByTabId:async()=> 'split',getTabsBySplitScreenId:async()=>tabs.map(tabId=>({tabId})),getSplitScreenTree:async()=>{if(mode==='last-tab-tree-null'&&!tabs.length)throw TypeError('Cannot read properties of null (reading data)');return {tabs:tabs.map(tabId=>({tabId}))}},closeDocument:async()=>{closed++;if(mode==='late-close')await new Promise<void>(r=>settle=r);if(mode!=='close-retained'){tabs=[];current=undefined;}return true;},openDocument:async()=>{opened++;current={uuid:mode==='open-wrong'?'foreign':'d',tabId:'d@p',documentType:3};tabs=['d@p'];return 'd@p';}},pcb_Document:{save:async()=>{saved++;return mode!=='save-reject';}}};
 const ex=new ControlledExecutor(()=>documentOpen,async wanted=>mode==='target-mismatch'?{...wanted,project_uuid:'foreign'}:wanted);
 const r:Request={protocol:V2,action:'document.open',action_revision:'1',schema:'x',request_id:'r',operation_id:'o',target_ref:target,input:{uuid:'d',reload:true},budget_ms:mode==='late-close'?10:10000};
 const pending=ex.execute(r,'digest');if(mode==='late-close'){await new Promise(r=>setTimeout(r,25));await assert.rejects(ex.execute({...r,operation_id:'second'},'other'),/BARRIER/);settle();}
 const h=await pending;
 if(mode==='normal'||mode==='close-retained'){
  const evidence=h.evidence as any;assert.equal(evidence.close_argument,'d@p');assert.equal(evidence.closeAck,true);assert.ok(evidence.nativeDurationMs>=0);
  assert.deepEqual(evidence.closeObservations.map((x:any)=>x.requested_offset_ms),[200,1000,2000,5000]);
  assert.ok(evidence.closeObservations.every((x:any)=>x.elapsed_since_settlement_ms>=x.requested_offset_ms));
  assert.ok(evidence.closeObservations.every((x:any)=>x.original_tab_present===(mode==='close-retained')));
 }
 assert.equal(h.verification.verdict==='satisfied',['normal','last-tab-tree-null'].includes(mode));assert.equal(saved,mode==='target-mismatch'?0:1);assert.equal(opened,['normal','open-wrong','last-tab-tree-null'].includes(mode)?1:0);assert.ok(closed<=1);
 if(mode!=='target-mismatch'){await ex.reconcile('o');await ex.execute(r,'digest');assert.equal(saved,1);assert.ok(closed<=1);assert.ok(opened<=1);}
});

for(const wrong of [false,true])test('checkpoint companion editor preserves close inventory '+wrong,async()=>{
 let current:any={uuid:'d',tabId:'d@p',documentType:3};const tabs=new Set(['d@p']);const calls:string[]=[];
 (globalThis as any).eda={dmt_Schematic:{getAllSchematicPagesInfo:async()=>[{uuid:'companion'}]},dmt_SelectControl:{getCurrentDocumentInfo:async()=>current},pcb_Document:{save:async()=>{calls.push('save');return true}},dmt_EditorControl:{getSplitScreenIdByTabId:async()=> 'split',getSplitScreenTree:async()=>({tabs:[...tabs].map(tabId=>({tabId}))}),openDocument:async(id:string)=>{calls.push('open:'+id);tabs.add(id+'@p');current={uuid:wrong?'foreign':id,tabId:id+'@p',documentType:id==='d'?3:1};return id+'@p'},activateDocument:async(id:string)=>{calls.push('activate:'+id);current={uuid:'d',tabId:id,documentType:3};return true},closeDocument:async(id:string)=>{calls.push('close:'+id);assert.ok(tabs.has('companion@p'));assert.equal(id,'d@p');tabs.delete(id);return true}}};
 const ex=new ControlledExecutor(()=>documentOpen,async wanted=>wanted);
 const req:Request={protocol:V2,action:'document.open',action_revision:'1',schema:'x',request_id:'r',operation_id:'o',target_ref:target,input:{uuid:'d',reload:true},budget_ms:10000};
 const result=await ex.execute(req,'digest');assert.equal(result.verification.verdict==='satisfied',!wrong);
 assert.deepEqual(calls,wrong?['save','open:companion']:['save','open:companion','activate:d@p','close:d@p','open:d']);
 await ex.reconcile('o');assert.equal(calls.length,wrong?2:5);
});

test('checkpoint controlled reload preserves exact schematic identity and type',async()=>{
 let current:any={uuid:'sch-page',tabId:'sch-page@p',documentType:1};
 let saved=0,closed=0,opened=0;const tabs=new Set(['sch-page@p']);
 (globalThis as any).eda={
  dmt_Project:{getCurrentProjectInfo:async()=>({uuid:'p'})},
  dmt_Schematic:{getAllSchematicPagesInfo:async()=>[{uuid:'sch-page'}]},
  dmt_Pcb:{getAllPcbsInfo:async()=>[]},
  dmt_SelectControl:{getCurrentDocumentInfo:async()=>current},
  sch_Document:{save:async()=>{saved++;return true}},
  dmt_EditorControl:{
   getSplitScreenIdByTabId:async()=> 'split',
   getSplitScreenTree:async()=>({tabs:[...tabs].map(tabId=>({tabId}))}),
   getTabsBySplitScreenId:async()=>[...tabs].map(tabId=>({tabId})),
   closeDocument:async(id:string)=>{closed++;assert.equal(id,'sch-page@p');tabs.delete(id);current=undefined;return true},
   openDocument:async(id:string)=>{opened++;assert.equal(id,'sch-page');const tabId='sch-page@p#reloaded';tabs.add(tabId);current={uuid:id,tabId,documentType:1};return tabId},
  },
 };
 const schematicTarget={...target,document_uuid:'sch-page',document_type:'schematic',tab_id:'sch-page@p'};
 const ex=new ControlledExecutor(()=>documentOpen,async wanted=>wanted);
 const req:Request={protocol:V2,action:'document.open',action_revision:'1',schema:'x',request_id:'r-sch',operation_id:'o-sch',target_ref:schematicTarget,input:{uuid:'sch-page',reload:true},budget_ms:10000};
 const result=await ex.execute(req,'digest-sch');
 assert.equal(result.verification.verdict,'satisfied');assert.equal(saved,1);assert.equal(closed,1);assert.equal(opened,1);
 assert.equal((result.value as any).tabId,'sch-page@p#reloaded');
});
