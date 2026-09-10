#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { runEasyeda, DOMAIN_NAMES } from './core.mjs';
import { projectV2 } from './v2-projection.mjs';
const loaded=await runEasyeda(['v2','catalog']);
if(!loaded.ok || !Array.isArray(loaded.result)) throw Error('V2_CATALOG_UNAVAILABLE');
const catalog=loaded.result;
const server=new Server({name:'easyeda-agent-mcp',version:'2.0.0'},{capabilities:{tools:{}}});
const requestProperties={protocol:{const:'execution.v2'},action:{type:'string'},action_revision:{type:'string'},schema:{type:'string'},request_id:{type:'string'},operation_id:{type:'string'},target_ref:{type:'object'},input:{type:'object'},parent_operation_id:{type:'string'},expected_revision:{type:'integer',minimum:0},budget_ms:{type:'integer',minimum:1,maximum:600000}};
server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:[
 ...[...DOMAIN_NAMES,'library'].map(domain=>({name:'easyeda_'+domain,description:'Execution V2 '+domain+' actions. Inspect catalog before calling. Never replay an UNKNOWN operation.',inputSchema:{type:'object',properties:{...requestProperties,action:{enum:catalog.filter(a=>a.domain===domain).map(a=>a.name)}},required:['protocol','action','action_revision','schema','request_id','operation_id','target_ref','input','budget_ms'],additionalProperties:false}})),
 {name:'easyeda_health',description:'Read daemon/session identities for explicit V2 target binding; no Host effect',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'easyeda_actions',description:'Action modes, schema identity and supported typed inputs',inputSchema:{type:'object',properties:{domain:{type:'string'}},additionalProperties:false}},
 {name:'easyeda_operation',description:'Read stored status/evidence or request fresh reconciliation without replay',inputSchema:{type:'object',properties:{operation_id:{type:'string'},view:{enum:['status','evidence','reconcile']}},required:['operation_id','view'],additionalProperties:false}}
]}));
server.setRequestHandler(CallToolRequestSchema,async ({params})=>{
 const p=params.arguments??{};
 if(params.name==='easyeda_health'){const r=await runEasyeda(['daemon','health']);if(!r.ok)throw Error(JSON.stringify(r.error));return {content:[{type:'text',text:JSON.stringify(r.result)}]};}
 if(params.name==='easyeda_actions')return {content:[{type:'text',text:JSON.stringify(catalog.filter(a=>!p.domain||a.domain===p.domain))}]};
 if(params.name==='easyeda_operation'){
  if(!['status','evidence','reconcile'].includes(p.view)||typeof p.operation_id!=='string')throw Error('V2_INVALID_OPERATION_QUERY');
  const r=await runEasyeda(['v2',p.view,p.operation_id]);if(!r.ok)throw Error(JSON.stringify(r.error));
  return p.view==='evidence'?{content:[{type:'text',text:JSON.stringify(r.result)}]}:projectV2(r.result);
 }
 const domain=params.name.replace(/^easyeda_/,'');
 const action=catalog.find(a=>a.name===p.action&&a.domain===domain);
 if(!action || action.mode!=='V2_NATIVE')throw Error('V2_ACTION_NOT_MIGRATED');
 const r=await runEasyeda(['v2','call',JSON.stringify(p)],p.budget_ms+15000);
 const result=r.ok?r.result:r.error?.stdout;
 if(!result || result.operation_id!==p.operation_id)throw Error('V2_RECEIPT_UNAVAILABLE: query the same operation_id; do not replay');
 return projectV2(result);
});
await server.connect(new StdioServerTransport());
