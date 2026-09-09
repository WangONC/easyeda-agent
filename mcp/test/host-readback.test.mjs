import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const enabled=process.env.EASYEDA_HOST_READBACK==='1';
// Explicit opt-in, read-only and identity guarded. Default test runs do not
// contact or mutate the user's current Host. No temporary routing/checker script.
test('real Host MCP compact snapshot and scoped report',{skip:!enabled},async()=>{
 const project=process.env.EASYEDA_HOST_PROJECT,doc=process.env.EASYEDA_HOST_DOCUMENT;
 assert.ok(project&&doc&&process.env.EASYEDA_BIN,'explicit fixture identity and CLI required');
 const server=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src/server.mjs');
 const client=new Client({name:'closure-host-readback',version:'1.0.0'});
 const transport=new StdioClientTransport({command:process.execPath,args:[server],env:{...process.env}});
 const value=r=>{assert.notEqual(r.isError,true,JSON.stringify(r));let v=r.structuredContent;while(v?.result&&typeof v.result==='object')v=v.result;return v};
 try{
  await client.connect(transport);
  const s=value(await client.callTool({name:'easyeda_board_snapshot_compact',arguments:{project,doc,include:{traces:true,vias:true}}}));
  assert.ok(s.board_revision);assert.ok(Array.isArray(s.traces));assert.ok(s.observation_hash);
  const r=value(await client.callTool({name:'easyeda_pcb',arguments:{project,doc,action:'pcb.report',payload:{project_uuid:project,document_uuid:doc,geometry:true,nets:['GND']}}}));
  assert.ok(Array.isArray(r.geometry_measurements));assert.ok(r.board_revision);
 }finally{await client.close()}
});
