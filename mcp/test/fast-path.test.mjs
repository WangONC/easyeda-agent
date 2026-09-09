import test from 'node:test';
import assert from 'node:assert/strict';
import { fastTools, fastInput, compactFastResult } from '../src/fast-path.mjs';
import { buildCallArgs, toMcpResult } from '../src/core.mjs';
test('Fast Path exposes three typed explicit-geometry schemas',()=>{
 const tools=fastTools();assert.equal(tools.length,3);assert.equal(tools[2].inputSchema.properties.operations.maxItems,512);assert.equal(tools[1].annotations.readOnlyHint,true);
 assert.throws(()=>fastInput({project:'x'}),/project and doc/);
 const args=buildCallArgs('route.apply_batch',fastInput({project:'p',doc:'uuid',base_revision:'r',plan_hash:'h',client_transaction_id:'t',operations:[]}));
 assert.deepEqual(args.slice(0,6),['--project','p','--doc','uuid','pcb','route-apply-batch']);assert.equal(JSON.parse(args[7]).base_revision,'r');
});
test('compact MCP retains structured partial/uncertain and omits envelopes',()=>{
 const raw={ok:true,result:{id:'request',ok:true,result:{board_revision:'r',traces:[],telemetry:{duration_ms:1}}}};
 const r=toMcpResult(compactFastResult(raw));assert.equal(r.isError,false);assert.equal(r.structuredContent.board_revision,'r');assert.equal(r.structuredContent.id,undefined);
 for(const status of ['partial','stale','uncertain']){const r=toMcpResult(compactFastResult({ok:false,error:{stdout:{ok:false,result:{status,created_ids:['a']},error:{code:'BATCH_UNCERTAIN'}}}}));assert.equal(r.isError,true);assert.match(r.content[0].text,new RegExp(status));assert.match(r.content[0].text,/created_ids/)}
 assert.equal(toMcpResult(compactFastResult({ok:true,result:{ok:true,result:{ok:false,conflicts:[{type:'trace_trace'}]}}})).isError,true);
});
test('Fast errors retain machine-readable structuredContent and compact JSON text',()=>{
 const r=toMcpResult({ok:false,error:{status:'uncertain',created_ids:['a'],readback_verified:false}},{compact:true,structuredErrors:true});
 assert.equal(r.isError,true);assert.equal(r.structuredContent.status,'uncertain');assert.equal(r.content[0].text.includes('\n'),false);
});

test('quarter arc plans and explicit arc writes are in existing Fast Path schemas',()=>{
 const schemas=fastTools();const pre=schemas.find(t=>t.name==='easyeda_route_preflight').inputSchema;
 assert.deepEqual(pre.properties.routes.items.properties.arc_angle.enum,[-90,90]);
 const apply=schemas.find(t=>t.name==='easyeda_route_apply_batch').inputSchema;
 const arc=apply.properties.operations.items.oneOf.find(o=>o.properties.type.const==='add_arc');
 assert.ok(arc.required.includes('arc_angle'));assert.equal(arc.properties.points.maxItems,2);
});
