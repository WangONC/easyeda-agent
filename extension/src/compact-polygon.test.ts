import test from 'node:test';import assert from 'node:assert/strict';
import {polygonRings,arcPoints,projectionError} from './compact-polygon';
test('linear holes preserve opposite native winding',()=>{
 const rings=polygonRings([[0,0,'L',100,0,100,100,0,100],[20,20,'L',20,80,80,80,80,20]])!;
 const area=(r:number[][])=>r.reduce((v,p,i)=>v+p[0]*r[(i+1)%r.length][1]-p[1]*r[(i+1)%r.length][0],0);
 assert.ok(area(rings[0])*area(rings[1])<0);
});
test('arc endpoints and sagitta error are bounded',()=>{
 const points=arcPoints([10,0],[-10,0],180)!;assert.deepEqual(points[0],[10,0]);assert.deepEqual(points.at(-1),[-10,0]);assert.ok(points.some(p=>p[1]>9.9));
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];const midpoint=[(a[0]+b[0])/2,(a[1]+b[1])/2];assert.ok(10-Math.hypot(...midpoint)<=projectionError+1e-7)}
 assert.equal(arcPoints([0,0],[0,0],180),undefined);
});
test('finite native source subset only',()=>{
 assert.equal(polygonRings(['R',0,0,20,10,0,0])!.length,1);
 assert.ok(polygonRings(['CIRCLE',0,0,10])![0].length>=8);
 for(const unknown of [[0,0,'C',1,1,2,2,3,3],['R',0,0,20,10,0,2],['UNKNOWN',1,2],[],[0,0,'L',1]])assert.equal(polygonRings(unknown),undefined);
});
