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
test('verified, native errors and unrelated actions retain original contract', () => {
  for (const input of [{ok:true,result:{result:{verified:true}}},{ok:false,error:{code:'TIMEOUT'}}]) {
    assert.equal(authoringResult('schematic.component.modify',input),input);
  }
  const unrelated = {ok:true,result:{result:{partial:true}}};
  assert.equal(authoringResult('pcb.report',unrelated),unrelated);
});
