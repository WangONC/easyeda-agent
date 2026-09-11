import test from 'node:test';
import assert from 'node:assert/strict';
import {createPourPolygon,readPourSource,exactSourceDiff} from './pour-source';
function setup(actual:unknown) {
 let constructions=0;
 (globalThis as any).eda={pcb_MathPolygon:{createPolygon:(source:unknown)=>{constructions++;return {getSource:()=>[source]};}}};
 const pour={getState_PrimitiveId:()=> 'p',getState_Net:()=> 'GND',getState_Layer:()=>1,getState_PourName:()=> 'test',getState_ComplexPolygon:()=>({getSource:()=>actual})} as IPCB_PrimitivePour;
 return {pours:[pour],constructions:()=>constructions};
}
const points=[[0,0],[10,0],[10,10]];
const source=[0,0,'L',10,0,10,10,0,0];
test('read-only probe shares production constructor and preserves native source representation',()=>{
 const f=setup([source]);const r=readPourSource(f.pours,{primitiveId:'p',points});
 assert.deepEqual(r.expected_source,createPourPolygon(points).getSource());assert.deepEqual(r.actual_source,[source]);assert.deepEqual(r.diff,[]);assert.equal(r.primitiveId,'p');assert.equal(f.constructions(),2);
 // The fake exposes no primitive create/delete/rebuild methods: any mutation fails.
});
test('exact diff preserves representation and real coordinate differences without interpreting equivalence',()=>{
 const f=setup(source);const r=readPourSource(f.pours,{primitiveId:'p',points});assert.equal(r.diff.length,1);
 assert.deepEqual(exactSourceDiff([1,2],[1,3]),[{path:'/1',expected:2,actual:3}]);
});
test('foreign, duplicate, missing identity and malformed request fail closed',()=>{
 const f=setup([source]);
 for(const raw of [{primitiveId:'foreign',points},{primitiveId:'p',points:[]},{primitiveId:'p',points,extra:true}])assert.throws(()=>readPourSource(f.pours,raw));
 assert.throws(()=>readPourSource([...f.pours,...f.pours],{primitiveId:'p',points}));assert.equal(f.constructions(),0);
});
test('undefined actual source fails instead of becoming empty success',()=>{
 const f=setup(undefined);assert.throws(()=>readPourSource(f.pours,{primitiveId:'p',points}),/UNAVAILABLE/);
});
