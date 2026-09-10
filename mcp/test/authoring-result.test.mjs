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
 const native={ok:false,error:{code:'TIMEOUT'}};const failed=authoringResult('schematic.component.modify',native);assert.equal(failed.ok,false);assert.equal(failed.error.code,'TIMEOUT');assert.equal(failed.error.execution.mutation_outcome,'UNCERTAIN');assert.deepEqual(failed.error.invocation_error,native.error);
 assert.equal(authoringResult('pcb.report',{ok:true,result:{ok:true,result:{partial:true}}}).ok,false);
});

for (const result of [null, undefined, '', 'not JSON', '{"ok":', 0, true, []]) {
 test('exit zero cannot establish action success: '+JSON.stringify(result), () => {
  const projected=authoringResult('board.snapshot_compact',{ok:true,result,stderr:'diagnostic'});
  assert.equal(projected.ok,false);
  assert.equal(projected.error.code,'INVALID_ACTION_RESPONSE');
  assert.equal(projected.error.evidence,result);
  assert.equal(toMcpResult(projected,{structuredErrors:true}).isError,true);
 });
}

for (const raw of [null,'','not JSON','{"ok":']) test('invalid mutation response stays uncertain '+JSON.stringify(raw),()=>{
 const input={ok:true,result:raw,stderr:'raw diagnostic'};
 const projected=authoringResult('pcb.component.modify',input);
 assert.equal(projected.error.execution.mutation_outcome,'UNCERTAIN');
 assert.equal(projected.error.execution.request_satisfied,false);
 assert.equal(projected.error.stdout,raw);
 assert.equal(projected.error.stderr,input.stderr);
 assert.equal(toMcpResult(projected,{structuredErrors:true}).isError,true);
});
