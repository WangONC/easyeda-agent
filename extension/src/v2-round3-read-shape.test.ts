import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeAction} from './actions';
import {ControlledExecutor,V2,type Request} from './execution-v2';
const actions=['schematic.text.list','schematic.library.search','schematic.library.get_by_lcsc','pcb.documents.list','pcb.silk.list','pcb.line.list','pcb.via.list','pcb.pour.list','pcb.region.list','pcb.fill.list'];
for(const action of actions)for(const mode of ['empty','undefined','null','object','number','bad-item','drift'] as const)test(action+' read shape '+mode,async()=>{
 let calls=0;const proxy:any=new Proxy(function(){calls++;return Promise.resolve(mode==='empty'||mode==='drift'?[]:mode==='undefined'?undefined:mode==='null'?null:mode==='object'?{}:mode==='bad-item'?[{}]:1);},{get:(_t,k)=>k==='then'?undefined:proxy});(globalThis as any).eda=proxy;
 const target={scope:'DOCUMENT' as const,session:'s',activation:'a',project_uuid:'p',document_uuid:'d',document_type:action.startsWith('schematic')?'schematic':'pcb',tab_id:'t'};
 const input=action==='schematic.library.search'?{query:'resistor'}:action==='schematic.library.get_by_lcsc'?{lcscIds:'C1'}:{};
 const req:Request={protocol:V2,action,action_revision:'1',schema:'test',request_id:'r',operation_id:'o',target_ref:target,input,budget_ms:1000};
 const h=await new ControlledExecutor(nativeAction,async()=>mode==='drift'?{...target,document_uuid:'foreign'}:target).execute(req,'d');
 assert.equal(h.verification.verdict==='satisfied',mode==='empty');assert.equal(h.effects.effect_started,false);if(mode==='drift')assert.equal(calls,0);
});

for(const action of ['pcb.report','pcb.drc.rules'])for(const shape of ['valid','undefined','null','scalar'] as const)test(action+' missing observation '+shape,async()=>{
 const good=action==='pcb.report'?[]:{};const value=shape==='valid'?good:shape==='undefined'?undefined:shape==='null'?null:2;
 const proxy:any=new Proxy(function(){return Promise.resolve(value);},{get:(_t,k)=>k==='then'?undefined:proxy});(globalThis as any).eda=proxy;
 const target={scope:'DOCUMENT' as const,session:'s',activation:'a',project_uuid:'p',document_uuid:'d',document_type:'pcb',tab_id:'t'};
 const h=await new ControlledExecutor(nativeAction,async()=>target).execute({protocol:V2,action,action_revision:'1',schema:'test',request_id:'r',operation_id:'o',target_ref:target,input:{},budget_ms:1000},'d');
 assert.equal(h.verification.verdict==='satisfied',shape==='valid');
 if(action==='pcb.report'&&shape!=='valid'){assert.ok(h.value);assert.equal((h.value as any).nets,undefined);assert.equal((h.value as any).netCount,undefined);assert.equal(typeof (h.value as any).netsError,'string');}
});
