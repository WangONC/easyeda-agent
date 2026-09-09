import test from 'node:test';import assert from 'node:assert/strict';
import capture from './testdata/host-poured-3.2.186.json';
import {projectPoured} from './poured-projection';
test('real Host poured polygon and thermal strokes convert internal units to mil',()=>{
 const result=projectPoured('p','GND',1,capture.fills.map(f=>({id:f.fill_id,source:f.source,filled:f.filled,line_width:f.line_width})),capture.host_version);
 assert.equal(result.length,7);assert.ok(result.every(p=>!p.unsupported));assert.equal(result[0].rings!.length,3);
 assert.ok(Math.abs(result[1].points![0][0]-87.191)<1e-7);assert.equal(result[1].width,10);
 assert.equal(result[0].rings![0][0][0],976);assert.equal(result[0].projection_error,0.5);
});
test('unknown Host unit contract is never treated as supported geometry',()=>{
 assert.equal(projectPoured('p','GND',1,[],'future')[0].unsupported,true);
});
