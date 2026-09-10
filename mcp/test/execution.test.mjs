import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {interpret} from '../src/execution.generated.mjs';import {authoringResult} from '../src/authoring-result.mjs';import {toMcpResult} from '../src/core.mjs';
const cases=JSON.parse(readFileSync(new URL('../../internal/protocol/testdata/execution.json',import.meta.url)));
for(const c of cases)test('Go/TS/MCP contract fixture: '+c.name,()=>{const got=interpret(c.request,c.response,c.before);assert.equal(got.mutation_outcome||'',c.want_outcome);assert.equal(got.request_satisfied,c.want_satisfied);if(!c.before){const projected=authoringResult(c.request.action,{ok:true,result:c.response},c.request.payload);const mcp=toMcpResult(projected,{structuredErrors:true});assert.equal(mcp.isError,!c.want_satisfied);assert.deepEqual(mcp.structuredContent.result,c.response.result);}});

test('Fast schema enumerates the single catalog operation set',async()=>{
 const {contractFor}=await import('../src/execution.generated.mjs');const {fastTools}=await import('../src/fast-path.mjs');
 const branches=fastTools()[2].inputSchema.properties.operations.items.oneOf;
 const exposed=branches.flatMap(b=>b.properties.type.const?[b.properties.type.const]:b.properties.type.enum);
 assert.deepEqual(exposed.sort(),[...contractFor('route.apply_batch').operations].sort());
});
