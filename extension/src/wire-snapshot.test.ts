import test from 'node:test';
import assert from 'node:assert/strict';
import {cloneWireData,wireGeometry} from './wire-geometry';
test('wire data copy isolates merged native arrays without erasing malformed observations',()=>{
 const original={id:'w',line:[[0,0,20,0],[20,0,40,0]],net:undefined};
 const snapshot=cloneWireData(original);
 original.line[0][2]=100;
 assert.equal(snapshot.line[0][2],20);
 assert.ok(Object.hasOwn(snapshot,'net'));
 assert.equal(snapshot.net,undefined);
 const invalid=cloneWireData({line:[0,0,NaN,Infinity]});
 assert.ok(Number.isNaN(invalid.line[2]));
 assert.throws(()=>wireGeometry(invalid.line,true),/WIRE_SHAPE/);
 const cycle:any={};cycle.self=cycle;
 assert.throws(()=>cloneWireData(cycle),/SNAPSHOT_DEPTH/);
});
