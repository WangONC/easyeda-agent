import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {interpret} from '../src/execution.generated.mjs';import {authoringResult} from '../src/authoring-result.mjs';import {toMcpResult} from '../src/core.mjs';
const cases=JSON.parse(readFileSync(new URL('../../internal/protocol/testdata/execution.json',import.meta.url)));
for(const c of cases)test('Go/TS/MCP contract fixture: '+c.name,()=>{const got=interpret(c.request,c.response,c.before);assert.equal(got.mutation_outcome||'',c.want_outcome);assert.equal(got.request_satisfied,c.want_satisfied);if(!c.before){const projected=authoringResult(c.request.action,{ok:true,result:{...c.response,execution:got}},c.request.payload);const mcp=toMcpResult(projected,{structuredErrors:true});assert.equal(mcp.isError,!c.want_satisfied);assert.deepEqual(mcp.structuredContent.result,c.response.result);}});

test('Fast schema enumerates the single catalog operation set',async()=>{
 const {contractFor}=await import('../src/execution.generated.mjs');const {fastTools}=await import('../src/fast-path.mjs');
 const branches=fastTools()[2].inputSchema.properties.operations.items.oneOf;
 const exposed=branches.flatMap(b=>b.properties.type.const?[b.properties.type.const]:b.properties.type.enum);
 assert.deepEqual(exposed.sort(),[...contractFor('route.apply_batch').operations].sort());
});

test('metadata and pending artifact evidence survive repeated action projection', () => {
 const request={action:'schematic.export.bom',payload:{}};
 const inline={ok:true,result:{},artifacts:[{id:'bom',inlineBase64:'YQ=='}]};
 const pending=interpret(request,inline);
 const delivered={...inline,execution:{...pending,operation_id:'op',verification:{...pending.verification,evidence_refs:['connector:receipt']}},artifacts:[{id:'bom',path:'bom.csv',sha256:'hash'}]};
 const first=authoringResult(request.action,{ok:true,result:delivered});
 assert.equal(first.ok,true);
 assert.equal(first.result.execution.operation_id,'op');
 assert.deepEqual(first.result.execution.verification.evidence_refs,['connector:receipt']);
 const again=authoringResult(request.action,first);
 assert.deepEqual(again.result.execution,first.result.execution);
});

test('R2 malformed nested evidence stays failed across repeated MCP projections',()=>{
 for (const c of cases.filter(c=>c.name.startsWith('r2_'))) {
  const first=authoringResult(c.request.action,{ok:true,result:c.response},c.request.payload);
  assert.equal(first.ok,false,c.name);
  assert.equal(toMcpResult(first,{structuredErrors:true}).isError,true,c.name);
  const second=authoringResult(c.request.action,{ok:true,result:first.error},c.request.payload);
  assert.equal(second.ok,false,c.name);
  assert.deepEqual(second.error.execution,first.error.execution,c.name);
  const processFailure=authoringResult(c.request.action,{ok:false,error:{code:1,stdout:c.response}},c.request.payload);
  assert.equal(processFailure.ok,false,c.name);
 }
});
