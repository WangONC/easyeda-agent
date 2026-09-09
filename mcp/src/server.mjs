#!/usr/bin/env node
import { authoringResult } from './authoring-result.mjs';
import { runWorkflow } from './workflow.mjs';

import { FAST_ACTIONS, fastTools, fastInput, compactFastResult } from './fast-path.mjs';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  buildBlocksArgs,
  buildReloadArgs,
  buildCallArgs,
  DOMAIN_NAMES,
  filterActions,
  runEasyeda,
  toMcpResult,
} from './core.mjs';

const catalogExecution = await runEasyeda(['actions'], 30_000);
if (!catalogExecution.ok || !Array.isArray(catalogExecution.result)) {
  process.stderr.write(`easyeda-agent-mcp: cannot load action catalog: ${JSON.stringify(catalogExecution)}\n`);
  process.exit(1);
}
const actions = catalogExecution.result.filter((action) => DOMAIN_NAMES.includes(action.domain));
const byName = new Map(actions.map((action) => [action.name, action]));

const server = new Server(
  { name: 'easyeda-agent-mcp', version: '0.18.5' },
  {
    capabilities: { tools: {} },
    instructions: [
      'Control EasyEDA Pro through easyeda-agent.',
      'For mutations, always provide project and doc.',
      'Inspect before editing and run schematic/PCB checks plus native DRC after editing.',
      'Do not bypass workflow gates or use force-unsafe in real projects.',
    ].join(' '),
  },
);

const commonRouteProperties = {
  project: {
    type: 'string',
    description: 'EasyEDA project name or UUID. Required for normal project work.',
  },
  doc: {
    type: 'string',
    description: 'Target schematic page or PCB name/UUID. Required for mutations.',
  },
  window: {
    type: 'string',
    description: 'Explicit connector windowId; use only to resolve genuine multi-window ambiguity.',
  },
  payload: {
    type: 'object',
    description: 'Typed action payload. Use easyeda_actions to inspect the action inputs.',
    additionalProperties: true,
  },
};

function domainTool(domain) {
  const domainActions = actions.filter((action) => action.domain === domain);
  return {
    name: `easyeda_${domain}`,
    title: `EasyEDA ${domain}`,
    description: `Run one typed ${domain} action through easyeda-agent. Use easyeda_actions for input guidance.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: domainActions.map((action) => action.name),
          description: 'Exact typed action name.',
        },
        ...commonRouteProperties,
      },
      ...(domain === 'pcb' ? {allOf: [{
        if: {properties: {action: {const: 'route.tuning_plan'}}, required: ['action']},
        then: {properties: {payload: {
          type: 'object',
          properties: {
            base_revision: {type:'string'}, net:{type:'string'}, span_id:{type:'string'},
            corridor:{type:'array',items:{type:'number'},minItems:4,maxItems:4},
            target_mode:{enum:['follow_rule','specified_length']}, target_length:{type:'number',exclusiveMinimum:0},
            corner:{enum:['line_45','line_90','arc_90']}, side:{enum:['single','bilateral']},
            spacing_w:{type:'number',exclusiveMinimum:0,description:'Centerline spacing W, mil.'},
            min_amplitude_h:{type:'number',exclusiveMinimum:0,description:'Minimum excursion H, mil.'},
            profile_id:{type:'string'}, project_uuid:{type:'string'}, document_uuid:{type:'string'},
          },
          required:['base_revision','net','span_id','corridor','target_mode','corner','side','spacing_w','min_amplitude_h'],
          additionalProperties:false,
          allOf:[{if:{properties:{target_mode:{const:'specified_length'}}},then:{required:['target_length']}}],
        }}, required:['payload']},
      }]} : {}),
      required: ['action'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: domainActions.every((action) => !action.mutates),
      destructiveHint: domainActions.some((action) => action.mutates),
      idempotentHint: false,
      openWorldHint: false,
    },
  };
}

const tools = [
  {
    name:'easyeda_document_reload',
    description:'Save, close and reopen the named document using the existing Go CLI recovery command; refresh stale native state. Does not rebuild pours or route. Requires explicit project/doc. Existing CLI owns save/reopen and recovery audit.',
    inputSchema:{type:'object',properties:{project:{type:'string'},doc:{type:'string'}},required:['project','doc'],additionalProperties:false},
    annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false},
  },
  ...fastTools().filter(tool => byName.has(FAST_ACTIONS[tool.name])),
  {
    name: 'easyeda_health',
    title: 'EasyEDA connection health',
    description: 'Check the local daemon and connected EasyEDA Pro windows.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'easyeda_actions',
    title: 'Discover EasyEDA actions',
    description: `Search the ${actions.length} typed EasyEDA actions and inspect inputs, mutation flags, and confirmation requirements.`,
    inputSchema: {
      type: 'object',
      properties: {
        domain: { type: 'string', enum: DOMAIN_NAMES },
        search: { type: 'string' },
        mutates: { type: 'boolean' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  ...DOMAIN_NAMES.map(domainTool),
  {
    name: 'easyeda_blocks',
    title: 'EasyEDA circuit blocks',
    description: 'List, search, or show an embedded proven circuit block. Does not require a running daemon.',
    inputSchema: {
      type: 'object',
      properties: {
        operation: { type: 'string', enum: ['list', 'search', 'show'] },
        query: { type: 'string', description: 'Required for search.' },
        id: { type: 'string', description: 'Required for show.' },
      },
      required: ['operation'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'easyeda_workflow',
    title: 'EasyEDA guarded workflow',
    description: 'Go-authoritative PCB workflow. Set assembly first; review/confirm tiers 1..4; advance runs the existing layout-lint gate (default score >=60, crossings <=8); confirm layout, set real outline via easyeda_pcb, confirm outline, advance again. Read state.routeAllowed/status.routeAllowed before routing. Confirmations record an authorized review, never automatic approval. No force bypass. Assembly and outline changes invalidate downstream state.',
    inputSchema: {
      type: 'object',
      properties: {
        operation: { type: 'string', enum: ['init', 'status', 'advance', 'confirm', 'reset', 'set_assembly', 'confirm_tier'] },
        project: { type: 'string' },
        doc: { type: 'string' },
        profile: { type: 'string', enum: ['hand-solder','reflow'], description: 'Required for set_assembly; uses existing CLI defaults. Invalidates placement and later confirmations.' },
        tier: { type: 'integer', minimum: 1, maximum: 4, description: 'For confirm_tier, in order: 1 mechanical, 2 edge connectors, 3 main IC/RF, 4 remaining satellites.' },
        parts: { type: 'array', items: {type:'string'}, description: 'Reviewed designators for confirm_tier. Tier 4 may omit to claim remaining parts.' },
        empty: { type: 'boolean', description: 'For confirm_tier: explicitly reviewed empty category, mutually exclusive with parts.' },
        reconcile: { type: 'boolean', description: 'For status: reconcile persisted state with the live document.' },
        minScore: { type: 'integer', minimum: 0, maximum: 100, description: 'For advance: existing layout-lint threshold, default 60. Gate also rejects shorts, overlap, off-board, tight gaps and blocked solder access. Never lower thresholds just to unlock routing.' },
        maxCrossings: { type: 'integer', minimum: -1, description: 'For advance: maximum ratline crossings; -1 is unlimited.' },
        confirmation: { type: 'string', enum: ['layout', 'outline'], description: 'Required for confirm.' },
        note: { type: 'string', description: 'Human review note recorded by confirm.' },
        resetAll: { type: 'boolean', description: 'For reset: clear every confirmation.' },
        resetFrom: { type: 'string', description: 'For reset: first stage to clear, inclusive.' },
      },
      required: ['operation', 'project'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: input = {} } = request.params;
  try {
    if (name === 'easyeda_document_reload') return toMcpResult(await runEasyeda(buildReloadArgs(input)),{compact:true,structuredErrors:true});
    if (name === 'easyeda_health') {
      return toMcpResult(await runEasyeda(['daemon', 'health'], 30_000));
    }
    if (name === 'easyeda_actions') {
      const filtered = filterActions(actions, input);
      return toMcpResult({ ok: true, result: { count: filtered.length, actions: filtered } });
    }
    if (name === 'easyeda_blocks') {
      return toMcpResult(await runEasyeda(buildBlocksArgs(input), 30_000));
    }
    if (name === 'easyeda_workflow') {
      return toMcpResult(await runWorkflow(input), {compact:true, structuredErrors:true});
    }
    if (FAST_ACTIONS[name]) {
      if (!byName.has(FAST_ACTIONS[name])) throw new Error("CLI upgrade required for Fast Path V0.1");
      return toMcpResult(compactFastResult(await runEasyeda(buildCallArgs(FAST_ACTIONS[name], fastInput(input)))), { compact: true, structuredErrors: true });
    }
    if (name.startsWith('easyeda_')) {
      const domain = name.slice('easyeda_'.length);
      if (!DOMAIN_NAMES.includes(domain)) throw new Error(`unknown EasyEDA domain tool: ${name}`);
      const action = byName.get(input.action);
      if (!action || action.domain !== domain) {
        throw new Error(`action ${input.action || '(missing)'} does not belong to domain ${domain}`);
      }
      const bootstrap = ['project.create','project.open','schematic.create'].includes(action.name);
      if (bootstrap && action.name !== 'project.create' && !input.window) throw new Error('bootstrap requires an explicit window and payload identity guard');
      if (action.mutates && !bootstrap && (!input.project || !input.doc)) {
        throw new Error(`mutating action ${action.name} requires both project and doc`);
      }
      const execution = authoringResult(action.name, await runEasyeda(buildCallArgs(action.name, input)));
      const fast = Object.values(FAST_ACTIONS).includes(action.name);
      return toMcpResult(fast ? compactFastResult(execution) : execution, { compact: fast || bootstrap, structuredErrors: true });
    }
    throw new Error(`unknown tool: ${name}`);
  }
  catch (error) {
    return toMcpResult({ ok: false, error: { message: error.message } });
  }
});

await server.connect(new StdioServerTransport());
