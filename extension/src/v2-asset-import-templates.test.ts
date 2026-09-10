import test from 'node:test';
import assert from 'node:assert/strict';
import {ControlledExecutor,V2,type Request} from './execution-v2';
import {silkImport,modelCreate} from './v2-native-actions';
const target={scope:'LIBRARY' as const,session:'s',activation:'a',library_uuid:'lib'};
for(const mode of ['success','partial','wrong-target','late-settle','readback-failure'] as const)test(`model import completion: ${mode}`,async()=>{
 let models:Record<string,unknown>[]=[];let writes=0,settle!:()=>void;
 const wait=new Promise<void>(resolve=>{settle=resolve;});
 (globalThis as unknown as {eda:unknown}).eda={lib_3DModel:{
  create:async()=>{writes++;if(mode==='late-settle')await wait;models=[{uuid:'one',libraryUuid:'lib',name:'native-name'},{uuid:'two',libraryUuid:'lib',name:'secondary'}];return ['one','two'];},
  get:async(id:string)=>mode==='readback-failure'?undefined:models.find(m=>m.uuid===id),
  modify:async()=>{writes++;if(mode==='partial')throw Error('metadata rejected');models[0].name='EA_AGENT__MODEL';return true;},
 }};
 const request:Request={protocol:V2,action:'test',action_revision:'1',schema:'test',request_id:'r',operation_id:'o',target_ref:target,input:{name:'model',dataBase64:'YWJj'},budget_ms:mode==='late-settle'?10:1000};
 const executor=new ControlledExecutor(()=>modelCreate,async()=>mode==='wrong-target'?{...target,library_uuid:'foreign'}:target);
 const pending=executor.execute(request,'digest');
 if(mode==='late-settle'){await new Promise(resolve=>setTimeout(resolve,25));await assert.rejects(executor.execute({...request,operation_id:'second'},'second'),/BARRIER/);settle();}
 const result=await pending;
 assert.equal(result.verification.verdict,mode==='success'?'satisfied':mode==='partial'||mode==='late-settle'?'partial':mode==='wrong-target'?'unchanged':'unavailable');
 assert.equal(writes,mode==='wrong-target'?0:mode==='late-settle'?1:2);
 assert.equal(result.effects.native_settled,true);
});
for(const mode of ['success','readback-failure','wrong-target','late-settle'] as const)test(`image native polygon contract: ${mode}`,async()=>{
 let exists=false,writes=0,settle!:()=>void;
 const wait=new Promise<void>(resolve=>{settle=resolve;});
 const contour=['CIRCLE',0,0,5];
 const states:Record<string,unknown>={PrimitiveId:'id',ComplexPolygon:contour,X:0,Y:0,Layer:3,Width:10,Height:10,Rotation:0,HorizonMirror:false};
 const primitive=new Proxy({}, {get:(_t,key)=>typeof key==='string'&&key.startsWith('getState_')?()=>states[key.slice(9)]:undefined});
 (globalThis as unknown as {eda:unknown}).eda={pcb_PrimitiveImage:{getAll:async()=>exists?[primitive]:[],get:async()=>exists?primitive:undefined,create:async(_x:number,_y:number,source:unknown)=>{assert.deepEqual(source,contour);writes++;if(mode==='late-settle')await wait;exists=mode!=='readback-failure';return primitive;}}};
 const request:Request={protocol:V2,action:'test',action_revision:'1',schema:'test',request_id:'r',operation_id:'o',target_ref:target,input:{polygons:[contour],x:0,y:0},budget_ms:mode==='late-settle'?10:1000};
 const executor=new ControlledExecutor(()=>silkImport,async()=>mode==='wrong-target'?{...target,library_uuid:'foreign'}:target);
 const pending=executor.execute(request,'digest');
 if(mode==='late-settle'){await new Promise(resolve=>setTimeout(resolve,25));await assert.rejects(executor.execute({...request,operation_id:'second'},'second'),/BARRIER/);settle();}
 const result=await pending;
 assert.equal(result.verification.verdict==='satisfied',mode==='success'||mode==='late-settle');assert.equal(writes,mode==='wrong-target'?0:1);
});
test('image validation accepts every official polygon token',()=>{for(const token of ['L','ARC','CARC','C','R','CIRCLE'])assert.doesNotThrow(()=>silkImport.validate({polygons:[[0,0,token,1,1]],x:0,y:0}));});
