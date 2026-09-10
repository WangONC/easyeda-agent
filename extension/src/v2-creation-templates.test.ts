import test from 'node:test';
import assert from 'node:assert/strict';
import { ControlledExecutor,V2,type Request,type NativeAction } from './execution-v2';
import { polygonCreate,silkAdd,wireCreate,netflagCreate } from './v2-native-actions';
const target={scope:'DOCUMENT' as const,session:'s',activation:'a',project_uuid:'p',document_uuid:'d',document_type:'pcb',tab_id:'t'};
for(const kind of ['fill','region','silk','wire','netflag'] as const)for(const mode of ['success','readback-failure','wrong-target','late-settle'] as const)test(`creation ${kind}: ${mode}`,async()=>{
 let exists=false,writes=0,settle!:()=>void;
 const wait=new Promise<void>(resolve=>{settle=resolve;});
 const source=[0,0,'L',10,0,0,10,0,0];
 const states:Record<string,unknown>={PrimitiveId:'new',Layer:kind==='silk'?3:1,PrimitiveLock:false,ComplexPolygon:{getSource:()=>source},Net:kind==='netflag'?'GND':'',FillMode:0,RuleType:[2,5,7],Text:'label',X:0,Y:0,FontSize:40,LineWidth:kind==='silk'?6:null,Rotation:0,Line:[0,0,10,0],Color:null,LineType:null,ComponentType:'netflag',Component:{name:'Power'},Name:'Power'};
 const primitive=new Proxy({}, {get:(_t,key)=>typeof key==='string'&&key.startsWith('getState_')?()=>states[key.slice(9)]:undefined});
 const api={getAll:async()=>exists?[primitive]:[],get:async()=>exists?primitive:undefined,create:async()=>{writes++;if(mode==='late-settle')await wait;if(mode!=='readback-failure')exists=true;return primitive;}};
 const host:Record<string,unknown>={pcb_MathPolygon:{createPolygon:()=>({getSource:()=>source})}};
 let action:NativeAction,input:Record<string,unknown>;
 if(kind==='fill'||kind==='region'){action=polygonCreate(kind);input={points:[[0,0,99],[10,0,99],[0,10,99]]};host[kind==='fill'?'pcb_PrimitiveFill':'pcb_PrimitiveRegion']=api;}
 else if(kind==='silk'){action=silkAdd;input={text:'label',x:0,y:0};host.pcb_PrimitiveString=api;}
 else if(kind==='wire'){action=wireCreate;input={points:[[0,0],[10,0]]};host.sch_PrimitiveWire=api;}
 else {action=netflagCreate(()=>({}));input={kind:'power',net:'GND',x:0,y:0};host.sch_PrimitiveComponent={...api,createNetFlag:api.create};}
 (globalThis as unknown as {eda:unknown}).eda=host;
 const executor=new ControlledExecutor(()=>action,async()=>mode==='wrong-target'?{...target,document_uuid:'foreign'}:target);
 const request:Request={protocol:V2,action:'test',action_revision:'1',schema:'test',request_id:'r',operation_id:'o',target_ref:target,input,budget_ms:mode==='late-settle'?10:1000};
 const pending=executor.execute(request,'digest');
 if(mode==='late-settle'){await new Promise(resolve=>setTimeout(resolve,25));await assert.rejects(executor.execute({...request,operation_id:'second'},'second'),/BARRIER/);settle();}
 const result=await pending;
 assert.equal(result.verification.verdict==='satisfied',mode==='success'||mode==='late-settle');
 assert.equal(writes,mode==='wrong-target'?0:1);
 if(mode==='late-settle')assert.equal(result.effects.reconciled,true);
});
