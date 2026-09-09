import test from 'node:test';
import assert from 'node:assert/strict';
import {projectRegion} from './region-projection';
test('known pour-only region is distinct from routing keepout; unknown rules fail closed',()=>{
 const source=[0,0,'L',100,0,100,100,0,100,0,0];
 assert.equal(projectRegion('r',1,source,[7],0).routing_blocked,false);
 assert.equal(projectRegion('r',1,source,[5,7],0).routing_blocked,true);
 for(const rules of [[9],[123],[]])assert.equal(projectRegion('r',1,source,rules,0).unsupported,true);
});
