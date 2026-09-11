import test from 'node:test';import assert from 'node:assert/strict';import {observeDrills} from './drill-inventory';
for(const value of [undefined,null,['ROUND',10],['SLOT',10,20],['ROUND',0],['ROUND',NaN]])test('drill native shape '+String(value),()=>{
 const result=observeDrills([{getState_PrimitiveId:()=> 'p',getState_Hole:()=>value,getState_Metallization:()=>false}],[],true);
 assert.equal(result.complete,value===null||(Array.isArray(value)&&Number.isFinite(value[1])&&Number(value[1])>0));
 assert.equal(result.pads_without_holes,value===null?1:0);
});
test('drill inventory refuses partial coverage, duplicate identities and absent getter',()=>{
 const p={getState_PrimitiveId:()=> 'p',getState_Hole:()=>null,getState_Metallization:()=>false};
 assert.equal(observeDrills([p],[],false).complete,false);
 assert.equal(observeDrills([p,p],[],true).complete,false);
 assert.equal(observeDrills([{...p,getState_Hole:()=>{throw Error('missing')}}],[],true).complete,false);
 const observed=observeDrills([p],[{getState_PrimitiveId:()=> 'v',getState_HoleDiameter:()=>12}],true);
 assert.equal(observed.complete,true);assert.equal(observed.pth_count,1);assert.equal(observed.via_count,1);
});
