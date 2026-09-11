import { before, after } from 'node:test';
const savedHostClone=globalThis.structuredClone;
before(()=>{Object.defineProperty(globalThis,'structuredClone',{value:undefined,configurable:true,writable:true});});
after(()=>{Object.defineProperty(globalThis,'structuredClone',{value:savedHostClone,configurable:true,writable:true});});
import test from 'node:test';
import assert from 'node:assert/strict';
import {sameWireGeometry} from './wire-geometry';
import {wireCreate} from './v2-native-actions';
import {ControlledExecutor,V2,type Request} from './execution-v2';

test('wire geometry observed Host reversal, polyline split and collinear normalization',()=>{
 assert.equal(sameWireGeometry([280,100,120,100],[120,100,280,100]),true);
 assert.equal(sameWireGeometry([[10,0,5,0],[5,0,0,0]],[0,0,10,0]),true);
 assert.equal(sameWireGeometry([[10,10,10,0],[0,0,10,0]],[0,0,10,0,10,10]),true);
 assert.equal(sameWireGeometry([[0,0,4,0],[6,0,10,0]],[0,0,10,0]),false);
 assert.equal(sameWireGeometry([0,0,10,10],[0,0,10,0,10,10]),false);
 assert.equal(sameWireGeometry([80,50,80,100,320,50,80,50,320,100,320,50],[80,100,80,50,320,50,320,100]),true);
 assert.equal(sameWireGeometry([80,50,80,100,320,50,90,50,320,100,320,50],[80,100,80,50,320,50,320,100]),false);
 assert.throws(()=>sameWireGeometry(undefined,[0,0,10,0]),/SHAPE/);
});
for(const mode of ['reversed','wrong-net','missing-piece'] as const)test('wire create Host regression '+mode,async()=>{
 let created=false,writes=0;
 const wire={getState_PrimitiveId:()=> 'native-wire',getState_Line:()=>mode==='missing-piece'?[280,100,130,100]:[280,100,120,100],getState_Net:()=>mode==='wrong-net'?'OTHER':'SMOKE_SIGNAL',getState_Color:()=>null,getState_LineWidth:()=>null,getState_LineType:()=>null};
 (globalThis as any).eda={sch_PrimitiveWire:{getAll:async()=>created?[wire]:[],create:async()=>{writes++;created=true;return wire;}}};
 const target={scope:'DOCUMENT' as const,session:'s',activation:'a',project_uuid:'p',document_uuid:'d',document_type:'schematic',tab_id:'t'};
 const r:Request={protocol:V2,action:'schematic.wire.create',action_revision:'1',schema:'test',request_id:'r',operation_id:'o',target_ref:target,input:{points:[120,100,280,100],net:'SMOKE_SIGNAL'},budget_ms:1000};
 const ex=new ControlledExecutor(()=>wireCreate,async()=>target);const h=await ex.execute(r,'d');
 assert.equal(h.verification.verdict==='satisfied',mode==='reversed');await ex.reconcile('o');await ex.execute(r,'d');assert.equal(writes,1);
});

import {nativeWireSegments,wireGeometry,WIRE_COORDINATE_RESOLUTION} from './wire-geometry';
test('wire geometry deterministic 2048-case reorder/reverse/split/filler property',()=>{
 let seed=583;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let i=0;i<2048;i++){
  const x=random()%10000-5000,y=random()%10000-5000,w=2+random()%100,h=2+random()%100;
  const expected=[x,y,x+w,y,x+w,y+h];
  const parts=[[x,y,x+w/2,y],[x+w/2,y,x+w,y],[x+w,y,x+w,y+h],[x,y,x,y]];
  for(const p of parts)if(random()%2){const a=p.splice(0,2);p.push(...a);}
  for(let n=parts.length-1;n;n--){const j=random()%(n+1);[parts[n],parts[j]]=[parts[j],parts[n]];}
  assert.equal(sameWireGeometry(parts.flat(),expected),true,`case ${i}`);
  const missing=parts.filter(p=>p[0]!==p[2]||p[1]!==p[3]).slice(1).flat();
  assert.equal(sameWireGeometry(missing,expected),false,`gap ${i}`);
  assert.equal(sameWireGeometry([...parts.flat(),x,y,x+w,y+h],expected),false,`diagonal ${i}`);
 }
});
test('wire geometry tolerance is bounded, malformed input is not empty geometry',()=>{
 const e=WIRE_COORDINATE_RESOLUTION;
 assert.equal(sameWireGeometry([0.1*e,0,10+0.1*e,0],[0,0,10,0]),true);
 assert.equal(sameWireGeometry([2*e,0,10+2*e,0],[0,0,10,0]),false);
 assert.deepEqual(nativeWireSegments([0,0,0,0,0,0,10,0]),[[0,0,10,0]]);
 assert.throws(()=>wireGeometry([0,0,0,0],true),/SHAPE/);
 for(const bad of [undefined,null,[],[0,0,NaN,1],[0,0,1],[[0,0],[1,1,2]],['0',0,1,1]])assert.throws(()=>wireGeometry(bad,true),/SHAPE/);
});
for(const mode of ['merge-old-id','merge-new-id','verified-no-op','unrelated-lost','extra-geometry','missing-piece','foreign-new-id'] as const)test('wire create scoped merge '+mode,async()=>{
 type State={id:string;line:number[];net:string};
 let rows:State[]=[{id:'old',line:[0,0,10,0],net:'N'},{id:'unrelated',line:[100,0,110,0],net:'X'}],writes=0;
 const wrap=(s:State)=>({getState_PrimitiveId:()=>s.id,getState_Line:()=>s.line,getState_Net:()=>s.net,getState_Color:()=>null,getState_LineWidth:()=>null,getState_LineType:()=>null});
 (globalThis as any).eda={sch_PrimitiveWire:{getAll:async()=>rows.map(wrap),create:async()=>{
  writes++;const id=mode==='merge-new-id'?'new':'old';
  rows=[{id,line:mode==='verified-no-op'?[10,0,0,0]:mode==='missing-piece'?[0,0,15,0]:mode==='extra-geometry'?[0,0,21,0]:[20,0,0,0],net:'N'},...rows.slice(1)];
  if(mode==='unrelated-lost')rows.pop();
  if(mode==='foreign-new-id')rows.push({id:'foreign',line:[500,0,510,0],net:'Z'});
  return wrap(rows[0]);
 }}};
 const target={scope:'DOCUMENT' as const,session:'s',activation:'a',project_uuid:'p',document_uuid:'d',document_type:'schematic',tab_id:'t'};
 const request:Request={protocol:V2,action:'schematic.wire.create',action_revision:'1',schema:'test',request_id:'r',operation_id:'o',target_ref:target,input:{points:mode==='verified-no-op'?[0,0,10,0]:[10,0,20,0],net:'N'},budget_ms:1000};
 const ex=new ControlledExecutor(()=>wireCreate,async()=>target);const result=await ex.execute(request,'digest');
 assert.equal(result.verification.verdict==='satisfied',['merge-old-id','merge-new-id','verified-no-op'].includes(mode));
 if(mode==='verified-no-op')assert.equal(result.effects.state_changed,false);
 await ex.reconcile('o');await ex.execute(request,'digest');assert.equal(writes,1);
});

// A floating slope/intercept key can differ after reversing/splitting a line.
// Grid-exact diagonal fixtures exercise every quadrant and negative origins.
test('wire geometry 1024 diagonal split/reverse cases use grid-exact line identity',()=>{
 for(let i=1;i<=1024;i++){
  const x=(i-600)/8,y=(i%79-40)/8,dx=(i%31+1)/8,dy=((i%2?-1:1)*(i%23+1))/8;
  const expected=[x,y,x+4*dx,y+4*dy];
  const actual=[[x+4*dx,y+4*dy,x+2*dx,y+2*dy],[x+2*dx,y+2*dy,x,y]];
  assert.equal(sameWireGeometry(actual,expected),true,'diagonal '+i);
  assert.equal(sameWireGeometry([[x,y,x+dx,y+dy],[x+2*dx,y+2*dy,x+4*dx,y+4*dy]],expected),false,'gap '+i);
 }
});

import fs from 'node:fs';
import path from 'node:path';
test('saved actual Host wire fixtures remain exact geometry evidence, not rewritten receipts',()=>{
 for(const prefix of ['round3-host-wire-signal','round3-rerun-wire-ground']){
  const read=(suffix:string)=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/round3-wire-host',prefix+'-'+suffix+'.json'),'utf8'));
  const req=read('request'),h=read('evidence'),receipt=read('final-status');
  assert.equal(h.operation_id,req.operation_id);assert.equal(h.effects.native_settled,true);
  assert.equal(receipt.outcome,'UNKNOWN'); // Retain the actual old outcome.
  assert.equal(sameWireGeometry(h.evidence.points,req.input.points),true);
 }
});
