import test from 'node:test';
import assert from 'node:assert/strict';
import { ControlledExecutor, V2, type Request } from './execution-v2';
import { pcbDelete } from './v2-batch-actions';
const target={scope:'DOCUMENT' as const,session:'s',activation:'a',project_uuid:'p',document_uuid:'d',document_type:'pcb',tab_id:'t'};
for(const kind of ['component','fill','region','pour'] as const) test(kind+' deletion 256 deterministic residual permutations',async()=>{
 for(let seed=0;seed<256;seed++){
  const n=1+seed%17,k=seed%(n+1),mode=seed%4;
  const ids=Array.from({length:n},(_,i)=>'i'+i);let current=[...ids,'unrelated'],calls=0;
  const read=async()=>{
   let rows=current.map(id=>({getState_PrimitiveId:()=>id})).reverse();
   if(calls&&mode===1)rows.push({getState_PrimitiveId:()=> 'foreign'});
   if(calls&&mode===2)rows.push(rows[0]);
   if(calls&&mode===3)rows=rows.filter(x=>x.getState_PrimitiveId()!=='unrelated');
   return rows;
  };
  (globalThis as any).eda={['pcb_Primitive'+kind[0].toUpperCase()+kind.slice(1)]:{getAll:read,delete:async()=>{calls++;current=current.filter(id=>!ids.slice(0,k).includes(id));return true;}}};
  const req:Request={protocol:V2,action:'pcb.'+kind+'.delete',action_revision:'1',schema:'test',request_id:'r',operation_id:'o',target_ref:target,input:{primitiveIds:[...ids,ids[0]]},budget_ms:1000};
  const ex=new ControlledExecutor(()=>pcbDelete(kind),async()=>target),r=await ex.execute(req,'d');
  if(mode===0){assert.equal(r.verification.satisfied,k);assert.equal(r.verification.residual,n-k);}
  else assert.equal(r.verification.verdict,'unavailable',JSON.stringify({kind,seed,r}));
  await ex.execute(req,'d');try{await ex.reconcile('o');}catch{assert.equal(mode,2);}
  assert.equal(calls,1);
 }
});
