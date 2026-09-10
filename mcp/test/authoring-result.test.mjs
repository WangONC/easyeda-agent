import test from 'node:test';
import assert from 'node:assert/strict';
import { authoringResult } from '../src/authoring-result.mjs';
import { toMcpResult } from '../src/core.mjs';

for (const result of [{ partial:true,notApplied:['MPN'] }, { verified:false }, { notApplied:['Value'] }, { status:'uncertain' }]) {
  test(`authoring failure evidence survives MCP projection ${JSON.stringify(result)}`, () => {
    const input = { ok:true,result:{ok:true,result},stderr:'Host warning' };
    const projected = authoringResult('schematic.component.modify',input);
    const mcp = toMcpResult(projected,{compact:true,structuredErrors:true});
    assert.equal(mcp.isError,true);
    assert.deepEqual(mcp.structuredContent.evidence,input.result);
    assert.equal(mcp.structuredContent.warnings,'Host warning');
  });
}
test('bare verified is not complete; no action-specific success exceptions', () => {
 const write=authoringResult('schematic.component.modify',{ok:true,result:{ok:true,result:{verified:true}}});
 assert.equal(write.ok,false);assert.equal(write.error.execution.mutation_outcome,'UNCERTAIN');
 const native={ok:false,error:{code:'TIMEOUT'}};assert.equal(authoringResult('schematic.component.modify',native),native);
 assert.equal(authoringResult('pcb.report',{ok:true,result:{ok:true,result:{partial:true}}}).ok,false);
});
