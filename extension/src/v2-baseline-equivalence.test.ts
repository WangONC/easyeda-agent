import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import Module from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import { nativeAction } from './actions';
import { ControlledExecutor, V2, type Request } from './execution-v2';

// Test-only independent business oracle: immutable baseline handler bodies,
// executed exclusively against fake eda. No legacy runtime bridge is shipped.
const source = execFileSync('git', ['show','a583bf731d946d2d39f1223e078d711bd41710d5:extension/src/actions.ts'], {encoding:'utf8'});
const oracleSource = source + '\nexport const baselineQueries = HANDLERS;';
const baseline = new Module(path.join(__dirname, 'baseline-actions.test-only.ts'), module) as Module & {paths:string[];_compile(source:string,filename:string):void;exports:{baselineQueries:Record<string,(input:Record<string,unknown>)=>Promise<{result:unknown}>>}};
baseline.filename = path.join(__dirname, 'baseline-actions.test-only.ts');
baseline.paths = module.paths;
baseline._compile(ts.transpileModule(oracleSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText, baseline.filename);
const target={scope:'DOCUMENT' as const,session:'s',activation:'a',project_uuid:'p',document_uuid:'d',document_type:'pcb',tab_id:'t'};
async function equivalent(action:string,input:Record<string,unknown>,hostFactory:()=>unknown){
 (globalThis as unknown as {eda:unknown}).eda=hostFactory();
 const expected=await baseline.exports.baselineQueries[action](input);
 (globalThis as unknown as {eda:unknown}).eda=hostFactory();
 const binding=action.startsWith('board.')?{scope:'PROJECT' as const,session:'s',activation:'a',project_uuid:'p'}:target;
 const request:Request={protocol:V2,action,action_revision:'1',schema:'test',request_id:'r',operation_id:'o',target_ref:binding,input,budget_ms:1000};
 const result=await new ControlledExecutor(nativeAction,async()=>binding).execute(request,'d');
 assert.equal(result.verification.verdict,'satisfied');const actual=result.value as Record<string,unknown>;if(action.startsWith("pcb.silk."))delete actual.verification;if(action==='board.rebind')delete actual.rollback;assert.deepEqual(actual,expected.result);
}
const devices=[{uuid:'resistor',name:'0402 resistor',supplierId:'C1',otherProperty:{Value:'100k'},description:'resistor'},{uuid:'capacitor',name:'100nF 0402',supplierId:'C2',otherProperty:{Value:'100nF'},description:'capacitor'}];
test('baseline-equivalent device search ranking and compact output',()=>equivalent('schematic.library.search',{query:'100nF 0402'},()=>({lib_Device:{search:async()=>devices}})));
test('baseline-equivalent exact LCSC search',()=>equivalent('schematic.library.search',{query:'C2'},()=>({lib_Device:{search:async()=>devices}})));
test('baseline-equivalent LCSC scalar, notFound and projected fields',()=>equivalent('schematic.library.get_by_lcsc',{lcscIds:'C2'},()=>({lib_Device:{getByLcscIds:async()=>[devices[1]]}})));
test('baseline-equivalent model search classification and limit',()=>equivalent('library.model3d.search',{query:'case',libraryUuid:'lib',classification:['Mechanical'],limit:2},()=>({lib_3DModel:{search:async(q:string,lib:string,classification:string[],limit:number)=>[{uuid:'m',name:q,libraryUuid:lib,classification,limit}]}})));
test('baseline-equivalent scoped net report and unavailable lengths',()=>equivalent('pcb.report',{nets:['A','B']},()=>({pcb_Net:{getNetLength:async(n:string)=>n==='A'?12:undefined},pcb_Drc:{getAllDifferentialPairs:async()=>[],getAllEqualLengthNetGroups:async()=>[]}})));
test('baseline-equivalent empty outline shape',()=>equivalent('pcb.outline.get',{},()=>({pcb_PrimitivePolyline:{getAll:async()=>[]},pcb_PrimitiveLine:{getAll:async()=>[]},pcb_PrimitiveArc:{getAll:async()=>[]}})));

function layoutHost(){const state=new Map([['a',{x:1,y:1}],['b',{x:15,y:14}],['c',{x:31,y:32}]]);const get=(id:string)=>{const p=state.get(id);return p?{getState_PrimitiveId:()=>id,getState_Designator:()=>id.toUpperCase(),getState_PrimitiveLock:()=>false,getState_X:()=>p.x,getState_Y:()=>p.y}:undefined;};return {pcb_SelectControl:{getAllSelectedPrimitives_PrimitiveId:async()=>['c','a','b']},pcb_PrimitiveComponent:{get:async(id:string)=>get(id),modify:async(id:string,patch:object)=>{Object.assign(state.get(id)!,patch);return get(id);}},pcb_Primitive:{getPrimitivesBBox:async(ids:string[])=>{const p=state.get(ids[0])!;return {minX:p.x-1,minY:p.y-2,maxX:p.x+1,maxY:p.y+2};}}};}
for(const mode of ['left','right','top','bottom','centerX','centerY'])test('baseline-equivalent align '+mode,()=>equivalent('pcb.align',{mode},layoutHost));
for(const axis of ['x','y'])test('baseline-equivalent distribution sorting '+axis,()=>equivalent('pcb.distribute',{axis},layoutHost));
test('baseline-equivalent grid scalar ID',()=>equivalent('pcb.grid_snap',{grid:10,primitiveIds:'b'},layoutHost));
test('baseline-equivalent relative move selection fallback',()=>equivalent('pcb.components.move',{dx:3,dy:-2},layoutHost));
function emptySch(){return {sch_PrimitiveComponent:{getAll:async()=>[]},sch_PrimitiveWire:{getAll:async()=>[]},sch_ManufactureData:{getNetlistFile:async()=>({text:async()=>JSON.stringify({components:{}})})}};}
for(const action of ['schematic.check','schematic.bridgeCheck','schematic.read'])test('baseline-equivalent empty '+action,()=>equivalent(action,{},emptySch));

for(const mode of ["grid","cluster"])test("baseline-equivalent arrange "+mode,()=>equivalent("pcb.components.arrange",{mode},layoutHost));

function silkHost(){
 const strings:any[]=[];const pad={getState_PrimitiveId:()=> 'pad',getState_Net:()=> 'N',getState_PadNumber:()=> '1',getState_X:()=>0,getState_Y:()=>0,getState_Pad:()=>['RECT',20,20],getState_Rotation:()=>0};
 return {pcb_Net:{getAllNetsName:async()=>['N']},pcb_PrimitivePad:{getAll:async()=>[pad]},pcb_PrimitiveComponent:{getAll:async()=>[{getState_PrimitiveId:()=> 'comp',getState_Designator:()=> 'J1'}],getAllPinsByPrimitiveId:async()=>[pad]},pcb_PrimitiveString:{getAll:async()=>strings,create:async(...a:any[])=>{const id='text'+strings.length;const x={getState_PrimitiveId:()=>id,getState_Layer:()=>a[0],getState_X:()=>a[1],getState_Y:()=>a[2],getState_Text:()=>a[3],getState_FontSize:()=>a[5],getState_LineWidth:()=>a[6],getState_Rotation:()=>a[8],getState_Mirror:()=>a[11]};strings.push(x);return x;}},pcb_Primitive:{getPrimitivesBBox:async(ids:string[])=>ids[0]==='comp'?{minX:-10,maxX:10,minY:-50,maxY:50}:{minX:30,maxX:80,minY:-10,maxY:10}}};
}
test('baseline-equivalent net label geometry/defaults and actual bbox',()=>equivalent('pcb.silk.netnames',{zone_rect:{left:-200,right:400,top:300,bottom:-300}},silkHost));
for(const content of ['pin-number','net-name','both'])for(const side of ['auto','left','above'])test('baseline-equivalent pad label '+content+' '+side,()=>equivalent('pcb.silk.label_pads',{refs:['J1'],content,side},silkHost));

function addHost(){let made=false;const state={x:0,y:0,layer:1,designator:'?',uniqueId:''},net={value:''};const comp={getState_PrimitiveId:()=> 'c',getState_X:()=>state.x,getState_Y:()=>state.y,getState_Layer:()=>state.layer,getState_Rotation:()=>0,getState_Designator:()=>state.designator,getState_UniqueId:()=>state.uniqueId};const pad={getState_PrimitiveId:()=> 'cp',getState_PadNumber:()=> '1',getState_Net:()=>net.value,getState_X:()=>0,getState_Y:()=>0,getState_Rotation:()=>0,getState_Pad:()=>['RECT',20,20]};return {lib_Device:{get:async()=>({uuid:'device',libraryUuid:'lib'})},pcb_PrimitiveComponent:{getAll:async()=>made?[comp]:[],create:async(_d:any,layer:number,x:number,y:number)=>{made=true;Object.assign(state,{layer,x,y});return comp;},getAllPinsByPrimitiveId:async()=>[pad],modify:async(_id:string,p:object)=>{Object.assign(state,p);return comp;}},pcb_PrimitivePad:{modify:async(_id:string,p:{net:string})=>{net.value=p.net;return pad;}},pcb_PrimitiveVia:{getAll:async()=>[]},pcb_Document:{startCalculatingRatline:async()=>true},dmt_Board:{getCurrentBoardInfo:async()=>undefined}};}
for(const input of [{device:{uuid:'device',libraryUuid:'lib'},x:10,y:20,nets:{'1':'N'},designator:'R1',uniqueId:'u'},{uuid:'device',libraryUuid:'lib',x:0,y:0}])test('baseline-equivalent PCB placement aliases/defaults '+JSON.stringify(input),()=>equivalent('pcb.add_component',input,addHost));
function attrsHost(){const props={Value:'',User:'kept'};const part={getState_PrimitiveId:()=> 'c',getState_Designator:()=> 'R1',getState_SupplierId:()=> 'C1',getState_OtherProperty:()=>({...props}),getState_X:()=>0,getState_Y:()=>0,getState_Rotation:()=>0,getState_Layer:()=>1,getState_UniqueId:()=> 'u'};return {lib_Device:{getByLcscIds:async()=>[{supplierId:'C1',otherProperty:{Value:'10k',User:'library'}}]},pcb_PrimitiveComponent:{getAll:async()=>[part],modify:async(_id:string,p:any)=>{Object.assign(props,p.otherProperty);return part;}}};}
for(const overwrite of [false,true])test('baseline-equivalent attribute backfill overwrite '+overwrite,()=>equivalent('pcb.component.attrs_backfill',{overwrite},attrsHost));
function boardHost(){let rows:any[]=[{name:'B',schematic:{uuid:'old'}}];return {dmt_Schematic:{getSchematicInfo:async(uuid:string)=>({uuid,parentProjectUuid:'p'})},dmt_Board:{getAllBoardsInfo:async()=>structuredClone(rows),getCurrentBoardInfo:async()=>rows[0],deleteBoard:async(name:string)=>{rows=rows.filter(x=>x.name!==name);return true;},createBoard:async(uuid:string)=>{rows.push({name:'New',schematic:{uuid}});return 'New';},modifyBoardName:async(from:string,to:string)=>{rows.find(x=>x.name===from).name=to;return true;}}};}
for(const input of [{schematicUuid:'new'},{schematicUuid:'new',name:'B'}])test('baseline-equivalent rebind current/name resolution '+JSON.stringify(input),()=>equivalent('board.rebind',input,boardHost));

function newBoardHost(){
 let rows:any[]=[{name:'Old',schematic:{uuid:'sch'}}],pcbs:any[]=[];
 return {dmt_Schematic:{getSchematicInfo:async()=>({uuid:'sch',parentProjectUuid:'p'})},
 dmt_Board:{getAllBoardsInfo:async()=>structuredClone(rows),getCurrentBoardInfo:async()=>{throw Error('no current board');},createBoard:async()=>{rows[0].schematic=undefined;rows.push({name:'New',schematic:{uuid:'sch'}});return 'New';}},
 dmt_Pcb:{getAllPcbsInfo:async()=>structuredClone(pcbs),createPcb:async()=>{pcbs.push({uuid:'pcb',name:'PCB',parentProjectUuid:'p'});rows[1].pcb={uuid:'pcb'};return 'pcb';}}};
}
for(const input of [{force:true},{force:true,schematic:'sch'},{force:true,schematicUuid:'sch'}])test('baseline-equivalent new PCB discovery/alias '+JSON.stringify(input),()=>equivalent('board.new_pcb',input,newBoardHost));

for(const points of [[80,100,80,50,320,50,320,100],[[80,100],[80,50],[320,50],[320,100]]])test('baseline-equivalent wire native segment array and line output '+JSON.stringify(points),()=>equivalent('schematic.wire.create',{points,net:'GND'},()=>{
 let made=false;const wire={getState_PrimitiveId:()=> 'wire',getState_Net:()=> 'GND',getState_Line:()=>[80,50,80,100,320,50,80,50,320,100,320,50],getState_Color:()=>null,getState_LineWidth:()=>null,getState_LineType:()=>null};
 return {sch_PrimitiveWire:{getAll:async()=>made?[wire]:[],create:async(line:unknown)=>{assert.deepEqual(line,[80,100,80,50,320,50,320,100]);made=true;return wire;}}};
}));
// Formal baseline registry, used only in this test module. Valid empty data is
// still a business success; unavailable native observations are tested separately.
for(const action of ['schematic.text.list','schematic.library.search','schematic.library.get_by_lcsc','pcb.documents.list','pcb.silk.list','pcb.line.list','pcb.via.list','pcb.pour.list','pcb.region.list','pcb.fill.list'])test('baseline-equivalent valid empty list '+action,()=>equivalent(action,action==='schematic.library.search'?{query:'resistor'}:action==='schematic.library.get_by_lcsc'?{lcscIds:'C1'}:{},()=>{
 const proxy:any=new Proxy(function(){return Promise.resolve([]);},{get:(_t,k)=>k==='then'?undefined:proxy});return proxy;
}));
