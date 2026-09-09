/// <reference types="@jlceda/pro-api-types" />
import { ActionError, type ActionResult } from './protocol';
import { canonical } from './fast-path';

// Activation-scoped receipts prevent blind replay after queue timeout. Old
// session tokens are rejected after reload; there is no cross-session exactly-once.
const session = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const receipts = new Map<string, { signature: string; result?: ActionResult }>();
function text(p: Record<string, unknown>, k: string): string {
 if (typeof p[k] !== 'string' || !(p[k] as string).trim()) throw new ActionError('INVALID_PAYLOAD', `${k} required`);
 return p[k] as string;
}
async function guard(p: Record<string, unknown>) {
 if (typeof p.expected_project_uuid !== 'string') throw new ActionError('DOCUMENT_GUARD', 'expected_project_uuid required (empty only for no current project)');
 const current = await eda.dmt_Project.getCurrentProjectInfo();
 if ((current?.uuid ?? '') !== p.expected_project_uuid) throw new ActionError('DOCUMENT_GUARD', 'Current project differs from expected identity');
}
async function once(p: Record<string, unknown>, kind: string, operation: () => Promise<ActionResult>): Promise<ActionResult> {
 if (p.session_token !== session) throw new ActionError('STALE_SESSION', 'Read project.list and reconcile previous creates before using a new session');
 const key = text(p,'client_transaction_id'); if (key.length > 160) throw new ActionError('INVALID_PAYLOAD','transaction ID too long');
 const signature = canonical({kind,p}); const old = receipts.get(key);
 if (old) {
  if (old.signature !== signature) throw new ActionError('TRANSACTION_ID_REUSED','Transaction arguments differ');
  return old.result ? {...old.result,result:{...old.result.result,duplicate:true}} : {result:{status:'uncertain',duplicate:true,session_token:session,warnings:['Original create is still running; no replay.']}};
 }
 if (receipts.size >= 256) throw new ActionError('TRANSACTION_LEDGER_FULL','Reconcile receipts before restarting Connector');
 // Reserve before native mutation. Rejections are retained; never retry a create.
 const entry: {signature:string;result?:ActionResult} = {signature}; receipts.set(key,entry);
 try { await guard(p); entry.result = await operation(); }
 catch (e) { entry.result = {result:{status:'uncertain',session_token:session,reason:String(e),warnings:['Native create may have executed. Inspect project/schematic inventory; no automatic replay.']}}; }
 return entry.result;
}

export async function projectList(p: Record<string, unknown>): Promise<ActionResult> {
 const optional = (k:string) => typeof p[k] === 'string' ? p[k] as string : undefined;
 const ids = await eda.dmt_Project.getAllProjectsUuid(optional('team_uuid'),optional('folder_uuid'),optional('workspace_uuid'));
 return {result:{project_uuids:ids,scope:{team_uuid:p.team_uuid,folder_uuid:p.folder_uuid,workspace_uuid:p.workspace_uuid},scope_complete:'native_scope_only',session_token:session}};
}
export async function projectCreate(p: Record<string, unknown>): Promise<ActionResult> {
 const name = text(p,'name');
 return once(p,'project.create',async()=>{
  const uuid = await eda.dmt_Project.createProject(name,undefined,typeof p.team_uuid==='string'?p.team_uuid:undefined,typeof p.folder_uuid==='string'?p.folder_uuid:undefined);
  if (!uuid) return {result:{status:'uncertain',reason:'Native create returned no UUID',session_token:session}};
  let info: IDMT_BriefProjectItem | undefined;
  try { info=await eda.dmt_Project.getProjectInfo(uuid); } catch (e) { return {result:{status:"uncertain",project_uuid:uuid,reason:String(e),session_token:session}}; }
  return {result:{status:info?.uuid===uuid?'complete':'uncertain',project_uuid:uuid,project:info,session_token:session,opened:false}};
 });
}
export async function projectOpen(p: Record<string, unknown>): Promise<ActionResult> {
 const uuid=text(p,'project_uuid');await guard(p);
 // Caller must save all edited pages first. This is an explicit navigation
 // precondition, not an instruction to discard or overwrite unsaved work.
 if(p.saved_current_project!==true)throw new ActionError('UNSAVED_PROJECT_RISK','Save edited pages and pass saved_current_project=true before switching projects');
 if(!(await eda.dmt_Project.getProjectInfo(uuid)))throw new ActionError('PROJECT_NOT_FOUND','Target UUID is not readable');
 const accepted=await eda.dmt_Project.openProject(uuid);
 const current=await eda.dmt_Project.getCurrentProjectInfo();
 return {result:{status:accepted&&current?.uuid===uuid?'complete':'uncertain',opened:accepted,project_uuid:current?.uuid,expected_project_uuid:uuid}};
}
export async function schematicCreate(p: Record<string, unknown>): Promise<ActionResult> {
 text(p,'expected_project_uuid');
 return once(p,'schematic.create',async()=>{
  if(p.board_name!==undefined){
   if(typeof p.board_name!=='string'||!p.board_name.trim())throw new ActionError('INVALID_PAYLOAD','board_name must identify an existing board');
   const board=await eda.dmt_Board.getBoardInfo(p.board_name);
   if(!board)return {result:{status:'failed',mutation_started:false,reason:'Requested board does not exist; no schematic created'}};
  }
  const uuid=await eda.dmt_Schematic.createSchematic(typeof p.board_name==='string'?p.board_name:undefined);
  if(!uuid)return {result:{status:'uncertain',reason:'Native create returned no schematic UUID'}};
  let info: IDMT_SchematicItem | undefined;
  try { info=await eda.dmt_Schematic.getSchematicInfo(uuid); } catch(e) { return {result:{status:"uncertain",schematic_uuid:uuid,reason:String(e)}}; }
  const current=await eda.dmt_Project.getCurrentProjectInfo();
  return {result:{status:info?.uuid===uuid&&info.parentProjectUuid===p.expected_project_uuid&&current?.uuid===p.expected_project_uuid?'complete':'uncertain',schematic_uuid:uuid,project_uuid:current?.uuid,pages:info?.page??[],opened:false}};
 });
}
