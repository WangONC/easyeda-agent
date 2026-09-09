import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,rm} from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverPath = process.env.EASYEDA_MCP_SERVER || path.join(packageDir, 'src', 'server.mjs');

test('stdio MCP initializes, lists tools, and invokes offline discovery', async () => {
  assert.ok(process.env.EASYEDA_BIN, 'EASYEDA_BIN must point to the local CLI for integration tests');
  const stateDir = await mkdtemp(path.join(os.tmpdir(),'easyeda-mcp-parity-'));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    cwd: packageDir,
    env: { ...process.env, EASYEDA_BIN: process.env.EASYEDA_BIN, EASYEDA_WORKFLOW_DIR:stateDir },
  });
  const client = new Client({ name: 'easyeda-agent-mcp-test', version: '1.0.0' });

  try {
    await client.connect(transport);
    const listed = await client.listTools();
    assert.equal(listed.tools.length, 15);
    assert.ok(listed.tools.some((tool) => tool.name === 'easyeda_pcb'));
    assert.ok(!listed.tools.some((tool) => tool.name === 'easyeda_debug'));

    const workflow = listed.tools.find(t=>t.name==='easyeda_workflow');
    assert.ok(workflow.inputSchema.properties.operation.enum.includes('set_assembly'));
    assert.ok(workflow.inputSchema.properties.operation.enum.includes('confirm_tier'));
    const invalid = await client.callTool({name:'easyeda_workflow',arguments:{operation:'set_assembly',project:'P',doc:'PCB',profile:'invalid'}});
    assert.equal(invalid.isError,true);
    const bypass = await client.callTool({name:'easyeda_workflow',arguments:{operation:'advance',project:'P',doc:'PCB',force:true}});
    assert.equal(bypass.isError,true);
    const allActions = await client.callTool({
      name: 'easyeda_actions',
      arguments: {},
    });
    assert.equal(allActions.isError, false);
    assert.ok(!allActions.structuredContent.actions.some((action) => action.domain === 'debug'));
    assert.ok(allActions.structuredContent.actions.find(a=>a.name === 'pcb.report').inputs.some(i=>i.startsWith('telemetry optional boolean')));

    for(const name of ['board.new_pcb','pcb.import_changes','document.open','schematic.page.create','route.tuning_plan','route.pair_plan','pcb.routing_profile','pcb.plane.refresh','pcb.drc.compare','pcb.manufacturing.export','project.create','project.open','project.list','schematic.create']) assert.ok(allActions.structuredContent.actions.some(a=>a.name===name));
    const discovered = await client.callTool({
      name: 'easyeda_actions',
      arguments: { domain: 'schematic', search: 'check', mutates: false },
    });
    assert.equal(discovered.isError, false);
    assert.ok(Array.isArray(discovered.structuredContent.actions));
    assert.ok(discovered.structuredContent.actions.some((action) => action.name === 'schematic.check'));

    const rejectedMutation = await client.callTool({
      name: 'easyeda_schematic',
      arguments: { action: 'schematic.page.create', payload: { name: 'Unsafe' } },
    });
    assert.equal(rejectedMutation.isError, true);
    assert.match(rejectedMutation.content[0].text, /requires both project and doc/);

    for(const profile of ['hand-solder','reflow']) {
      const input={project:'MCP_PARITY_OFFLINE_'+profile,doc:'fixture-only',operation:'set_assembly',profile};
      const changed=await client.callTool({name:'easyeda_workflow',arguments:input});
      assert.equal(changed.isError,false,JSON.stringify(changed));
      assert.equal(changed.structuredContent.state.assembly.profile,profile);
      assert.equal(changed.structuredContent.state.routeAllowed,false);
      const state=await client.callTool({name:'easyeda_workflow',arguments:{project:input.project,operation:'status'}});
      assert.equal(state.structuredContent.assembly.profile,profile);
    }
    const blocks = await client.callTool({
      name: 'easyeda_blocks',
      arguments: { operation: 'search', query: 'led' },
    });
    assert.equal(blocks.isError, false);
  }
  finally {
    await client.close();
    await rm(stateDir,{recursive:true,force:true});
  }
});

test('stdio catalog inherits exact action disabling from CLI environment', async () => {
  const transport = new StdioClientTransport({
    command: process.execPath, args: [serverPath], cwd: packageDir,
    env: { ...process.env, EASYEDA_DISABLED_ACTIONS: ' pcb.import_autoroute, pcb.report,pcb.import_autoroute, , ' },
  });
  const client = new Client({name:'disabled-actions-test',version:'1.0.0'});
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    const actions = listed.tools.find(t=>t.name==='easyeda_pcb').inputSchema.properties.action.enum;
    for (const disabled of ['pcb.import_autoroute','pcb.report']) assert.ok(!actions.includes(disabled));
    assert.ok(actions.includes('pcb.import_changes'));
    const discovered = await client.callTool({name:'easyeda_actions',arguments:{}});
    assert.equal(discovered.isError,false);
    for (const disabled of ['pcb.import_autoroute','pcb.report']) assert.ok(!discovered.structuredContent.actions.some(a=>a.name===disabled));
    const searched = await client.callTool({name:'easyeda_actions',arguments:{search:'pcb.import_autoroute'}});
    assert.deepEqual(searched.structuredContent.actions,[]);
  } finally { await client.close(); }
});
