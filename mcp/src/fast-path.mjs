// Dedicated schemas for the three frozen Fast Path operations. Domain tools remain compatible.
export const FAST_ACTIONS = {
 easyeda_board_snapshot_compact: 'board.snapshot_compact',
 easyeda_route_preflight: 'route.preflight',
 easyeda_route_apply_batch: 'route.apply_batch',
};
const number = { type: 'number' };
const string = { type: 'string', minLength: 1 };
const strings = { type: 'array', items: string };
const point = { type: 'array', items: number, minItems: 2, maxItems: 2 };
const route = { type: 'object', properties: { net: string, layer: { type: 'integer' }, width: number, points: { type: 'array', items: point, minItems: 2 } }, required: ['net','layer','width','points'], additionalProperties: false };
const via = { type: 'object', properties: { net: string, x: number, y: number, diameter: number, hole: number, from_layer: { type: 'integer' }, to_layer: { type: 'integer' } }, required: ['net','x','y','diameter','hole','from_layer','to_layer'], additionalProperties: false };
const operation = { oneOf: [
 { ...route, properties: { ...route.properties, type: { const: 'add_trace' }, points: { type: 'array', items: point, minItems: 2, maxItems: 2 } }, required: ['type', ...route.required] },
 { ...via, properties: { ...via.properties, type: { const: 'add_via' } }, required: ['type', ...via.required] },
 { type: 'object', properties: { type: { enum: ['delete_trace','delete_via'] }, id: string }, required: ['type','id'], additionalProperties: false },
] };
const props = {
 'board.snapshot_compact': { nets: strings, bbox: { type:'array',items:number,minItems:4,maxItems:4 }, layers: {type:'array',items:{type:'integer'}}, include: {type:'object',properties:Object.fromEntries(['components','pads','traces','vias','fills'].map(k=>[k,{type:'boolean'}])),additionalProperties:false} },
 'route.preflight': { base_revision: string, profile_id: {...string,description:'Explicit reviewed stackup-bound routing profile; must be MANUFACTURER_VERIFIED (reviewed evidence bound to observable rules/layers) or separately accepted HOST_VERIFIED, and match route layer/width. Host physical getters unavailable on EDA 3.2 do not invalidate manufacturer evidence.'}, routes:{type:'array',items:route}, vias:{type:'array',items:via}, delete_ids:strings, protected_nets:strings, clearance_profile:{type:'object',properties:Object.fromEntries(['clearance','min_width','min_hole','min_diameter','min_annulus'].map(k=>[k,number])),required:['clearance','min_width','min_hole','min_diameter','min_annulus'],additionalProperties:false} },
 'route.apply_batch': { base_revision:string, plan_hash:string, client_transaction_id:{...string,maxLength:160}, operations:{type:'array',items:operation,minItems:1,maxItems:512} },
};
export function fastTools() {
 return Object.entries(FAST_ACTIONS).map(([name, action]) => ({ name,
  description: `${action}: strict manual geometry in mil. Requires an active PCB UUID, upgraded Connector, and routing gate for writes. Never chooses or repairs a route. Preflight operation order is delete_ids, route segments, then vias. Uncertain means stop and inspect; timeout is not cancellation.`,
  inputSchema:{type:'object',properties:{project:string,doc:{...string,description:'Active PCB document UUID (not name). No navigation occurs.'},window:string,...props[action]}, required:['project','doc',...(action==='route.preflight'?['base_revision']:action==='route.apply_batch'?['base_revision','plan_hash','client_transaction_id','operations']:[])],additionalProperties:false},
  annotations:{readOnlyHint:action!=='route.apply_batch',destructiveHint:action==='route.apply_batch',idempotentHint:false,openWorldHint:false},
 }));
}
export function fastInput(input) {
 const {project,doc,window,...payload}=input;
 if(!project || !doc) throw new Error('Fast Path requires both project and doc (active PCB UUID)');
 return {project,doc,window,payload};
}
export function compactFastResult(execution) {
 // Preserve the structured failure result even when CLI exits nonzero.
 let value = execution.ok ? execution.result : execution.error?.stdout;
 if (!value || typeof value !== 'object') return execution;
 if (value.result && typeof value.result === 'object') {
  value={...value.result,...(value.error?{error:value.error}:{}),...(value.staleRisk?{stale_risk:value.staleRisk}:{})};
 }
 const ok = execution.ok && value.ok !== false && (!value.status || value.status==='complete');
 return ok ? {ok:true,result:value} : {ok:false,error:value};
}
