import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const enabled=process.env.EASYEDA_HOST_READBACK==='1';
// Explicit opt-in, stable target supplied by the operator/test driver. No Host effects.
// The former dedicated Fast tool/legacy payload test boundary was removed in V2.
test('real Host MCP to CLI to daemon to Connector read and direct receipt projection',{skip:!enabled},async()=>{
 assert.ok(process.env.EASYEDA_HOST_TARGET_FILE,'explicit stable target file required');
 const target=JSON.parse(fs.readFileSync(process.env.EASYEDA_HOST_TARGET_FILE,'utf8'));
 assert.ok(['DOCUMENT','HOME'].includes(target.scope));assert.ok(target.session&&target.activation);
 if(target.scope==='DOCUMENT')assert.ok(target.project_uuid&&target.document_uuid&&target.tab_id);
 const server=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src/server.mjs');
 const client=new Client({name:'v2-host-readback',version:'3.0.0'});
 const transport=new StdioClientTransport({command:process.execPath,args:[server],env:{...process.env}});
 try{
  await client.connect(transport);
  const tools=await client.listTools();assert.equal(tools.tools.length,11);
  const listed=await client.callTool({name:'easyeda_actions',arguments:{domain:'document'}});
  const spec=JSON.parse(listed.content[0].text).find(a=>a.name==='document.current');assert.equal(spec.mode,'V2_NATIVE');
  const op=randomUUID();
  const request={protocol:'execution.v2',action:spec.name,action_revision:spec.v2.revision,schema:spec.schema,request_id:randomUUID(),operation_id:op,target_ref:target,input:{},budget_ms:30000};
  if(process.env.EASYEDA_HOST_EVIDENCE_FILE)fs.writeFileSync(process.env.EASYEDA_HOST_EVIDENCE_FILE,JSON.stringify({target,request,stage:'dispatch'},null,2)+String.fromCharCode(10));
  const response=await client.callTool({name:'easyeda_document',arguments:request});
  assert.equal(response.isError,false,JSON.stringify(response));
  const result=response.structuredContent;
  assert.equal(result.operation_id,op);assert.equal(result.outcome,'SUCCEEDED');assert.equal(result.effects.effect_started,false);
  assert.deepEqual(JSON.parse(response.content[0].text),result);
  const stored=await client.callTool({name:'easyeda_operation',arguments:{operation_id:op,view:'status'}});
  assert.deepEqual(stored.structuredContent,result,'MCP exposes exactly the daemon stored result');
  if(process.env.EASYEDA_HOST_EVIDENCE_FILE)fs.writeFileSync(process.env.EASYEDA_HOST_EVIDENCE_FILE,JSON.stringify({target,result,stored:stored.structuredContent},null,2)+'\n');
 }finally{await client.close();}
});
