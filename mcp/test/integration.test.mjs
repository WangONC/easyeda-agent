import test from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {DOMAIN_NAMES,easyedaBinary} from '../src/core.mjs';
import {fileURLToPath} from 'node:url';
const server=fileURLToPath(new URL('../src/server.mjs',import.meta.url));
// The old integration asserted the removed legacy payload/workflow API.
// This crosses real stdio MCP -> V2 CLI catalog, without contacting a daemon/Host.
test('V2 stdio discovery covers 151 action dispositions and rejects terminal actions',async()=>{
 const client=new Client({name:'round2-offline',version:'1'}),transport=new StdioClientTransport({command:process.execPath,args:[server],env:{...process.env,EASYEDA_BIN:easyedaBinary(),EASYEDA_HOST_READBACK:'0'}});
 try{
  await client.connect(transport);const {tools}=await client.listTools();assert.equal(tools.length,DOMAIN_NAMES.length+4);
  const discovered=await client.callTool({name:'easyeda_actions',arguments:{}});const actions=JSON.parse(discovered.content[0].text);assert.equal(actions.length,151);assert.equal(actions.filter(a=>a.mode==='V2_NATIVE').length,144);assert.equal(actions.filter(a=>a.mode==='UNSUPPORTED').length,7);
  for(const a of actions){assert.ok(a.description);if(a.mode==='V2_NATIVE'){assert.ok(a.schema);assert.ok(a.v2);const tool=tools.find(t=>t.name==='easyeda_'+a.domain);assert.ok(tool,a.name);assert.ok(tool.inputSchema.properties.action.enum.includes(a.name));}}
  const unsupported=await client.callTool({name:'easyeda_pcb',arguments:{action:'pcb.import_changes'}});assert.equal(unsupported.isError,true);assert.match(unsupported.content[0].text,/V2_ACTION_UNSUPPORTED/);
  const wrong=await client.callTool({name:'easyeda_pcb',arguments:{action:'schematic.component.replace'}});assert.equal(wrong.isError,true);assert.match(wrong.content[0].text,/V2_UNKNOWN_ACTION/);
 }finally{await client.close();}
});
