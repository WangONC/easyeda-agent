#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const packageVersion = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { runEasyeda, DOMAIN_NAMES } from './core.mjs';
import { projectV2 } from './v2-projection.mjs';
import { domainCallSchema,validateActionInput } from './action-schema.mjs';
const loaded=await runEasyeda(['actions']);
if(!loaded.ok || !Array.isArray(loaded.result)) throw Error('V2_CATALOG_UNAVAILABLE');
const catalog=loaded.result;
const server=new Server({name:'easyeda-agent-mcp',version:packageVersion},{capabilities:{tools:{}}});
const requestProperties={action:{type:'string'},input:{type:'object'},window:{type:'string'},project:{type:'string'},document:{type:'string'}};
server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:[
 ...[...DOMAIN_NAMES,'library'].map(domain=>{const actions=catalog.filter(a=>a.domain===domain);return {name:'easyeda_'+domain,description:'Execution V2 '+domain+' actions. Inputs are action-specific business schemas from the catalog. Submit Host mutations serially unless an action explicitly declares otherwise. Never replay an UNKNOWN operation.',inputSchema:domainCallSchema(actions)};}),
 {name:'easyeda_health',description:'Read connection status and logical windows; CLI binds targets internally; no Host effect',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'easyeda_actions',description:'Supported actions and business inputs; no manual request envelope',inputSchema:{type:'object',properties:{domain:{type:'string'}},additionalProperties:false}},
 {name:'easyeda_operation',description:'Read stored status/evidence or request fresh reconciliation without replay',inputSchema:{type:'object',properties:{operation_id:{type:'string'},view:{enum:['status','evidence','reconcile']}},required:['operation_id','view'],additionalProperties:false}}
]}));
server.setRequestHandler(CallToolRequestSchema,async ({params})=>{
 const p=params.arguments??{};
 if(params.name==='easyeda_health'){const r=await runEasyeda(['daemon','health']);if(!r.ok)throw Error(JSON.stringify(r.error));return {content:[{type:'text',text:JSON.stringify(r.result)}]};}
 if(params.name==='easyeda_actions')return {content:[{type:'text',text:JSON.stringify(catalog.filter(a=>!p.domain||a.domain===p.domain).map(({name,domain,mode,description,inputs,outputs,reason})=>({name,domain,mode,description,inputs,outputs,reason})))}]};
 if(params.name==='easyeda_operation'){
  if(!['status','evidence','reconcile'].includes(p.view)||typeof p.operation_id!=='string')throw Error('V2_INVALID_OPERATION_QUERY');
  const r=await runEasyeda(['operation',p.view,p.operation_id]);if(!r.ok)throw Error(JSON.stringify(r.error));
  return p.view==='evidence'?{content:[{type:'text',text:JSON.stringify(r.result)}]}:projectV2(r.result);
 }
 const domain=params.name.replace(/^easyeda_/,'');
 const action=catalog.find(a=>a.name===p.action&&a.domain===domain);
 if(!action)return {isError:true,content:[{type:'text',text:'V2_UNKNOWN_ACTION'}]};
 if(action.mode!=='V2_NATIVE')return {isError:true,content:[{type:'text',text:'V2_ACTION_'+action.mode+': '+(action.reason??'')}]};
 const inputError=validateActionInput(action,p.input);
 if(Object.keys(p).some(k=>!Object.hasOwn(requestProperties,k)) || inputError || ['window','project','document'].some(k=>p[k]!==undefined && typeof p[k]!=='string')) return {isError:true,content:[{type:'text',text:'INVALID_PUBLIC_INPUT'+(inputError?': '+inputError:'')}]};
 const args=['action',p.action,'--input',JSON.stringify(p.input??{})];
 for(const [key,flag] of [['window','--window'],['project','--project'],['document','--doc']])if(p[key])args.push(flag,p[key]);
 const r=await runEasyeda(args);
 const result=r.ok?r.result:r.error?.stdout;
 if(!result || result.protocol!=='execution.v2')return {isError:true,content:[{type:'text',text:JSON.stringify(r.error??{message:'V2_INVALID_RESPONSE'})}]};
 return projectV2(result);
});
await server.connect(new StdioServerTransport());
