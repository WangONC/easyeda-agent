import test from 'node:test';
import assert from 'node:assert/strict';
import { ControlledExecutor, V2, type Request } from './execution-v2';
import { placeComponent } from './v2-place-component';
import { normalizeSchematicRotation, schematicComponentCreateRotation } from './schematic-rotation';

const target = {scope:'DOCUMENT' as const,session:'s',activation:'a',project_uuid:'p',document_uuid:'d',document_type:'schematic',tab_id:'t'};
const device = {
	uuid:'a'.repeat(32),libraryUuid:'lib',
	association:{symbol:{uuid:'b'.repeat(32),libraryUuid:'lib'},footprint:{uuid:'c'.repeat(32),libraryUuid:'lib'}},
	property:{supplierId:'',otherProperty:{}},
};

function host() {
	let createdRotation:number|undefined,createCalls=0,modifyCalls=0;
	let part:any;
	const storage=new Map<string,string>();
	const component=(rotation:number)=>({
		getState_PrimitiveId:()=> 'part-1',
		getState_Rotation:()=>rotation,
		getState_Designator:()=> '',
		getState_SupplierId:()=> '',
		getState_OtherProperty:()=>({}),
	});
	(globalThis as any).eda={
		lib_Device:{get:async()=>device},
			sch_PrimitiveComponent:{
			getAll:async()=>part?[part]:[],
			create:async(_source:unknown,_x:number,_y:number,_sub:unknown,rotation:number|undefined)=>{
				createCalls++;
				createdRotation=rotation;
				// Real Host create contract: public +90 is stored/read back as 270.
				part=component(rotation===undefined?0:normalizeSchematicRotation(360-rotation));
				return part;
			},
			modify:async(_id:string,patch:{rotation?:number})=>{
				modifyCalls++;
				if(patch.rotation!==undefined)part=component(patch.rotation);
				return part;
			},
		},
		sys_Storage:{
			getExtensionUserConfig:(key:string)=>storage.get(key),
			setExtensionUserConfig:(key:string,value:string)=>{storage.set(key,value);},
		},
	};
	return {created:()=>createdRotation,createCalls:()=>createCalls,modifyCalls:()=>modifyCalls};
}

test('schematic.component.place converts the Host create angle and performs one component mutation', async()=>{
	for(const rotation of [-90,0,90,180,270,360,450]){
		const h=host();
		const action=placeComponent(
			(c:any)=>({primitiveId:c.getState_PrimitiveId(),x:10,y:20,rotation:c.getState_Rotation(),mirror:false,addIntoBom:true,addIntoPcb:true,designator:'',subPartName:undefined,supplierId:'',otherProperty:{},component:{uuid:device.uuid,libraryUuid:'lib'},symbol:device.association.symbol,footprint:device.association.footprint}),
			(a)=>({merged:a,filled:[]}),
		);
		const request:Request={protocol:V2,action:'schematic.component.place',action_revision:'1',schema:'test',request_id:'r'+rotation,operation_id:'o'+rotation,target_ref:target,input:{libraryUuid:'lib',uuid:device.uuid,x:10,y:20,rotation},budget_ms:1000};
		const result=await new ControlledExecutor(()=>action,async()=>target).execute(request,'digest-'+rotation);
		assert.equal(h.created(),schematicComponentCreateRotation(rotation));
		assert.equal(h.createCalls(),1,'component must be created exactly once');
		assert.equal(h.modifyCalls(),0,'rotation must not require component.modify');
		assert.equal((result.value as any).component.rotation,normalizeSchematicRotation(rotation));
		assert.equal(result.verification.verdict,'satisfied');
		assert.equal(result.verification.residual,0);
	}
});

test('schematic rotations normalize before absolute modify/readback comparison',()=>{
	assert.deepEqual([-90,0,90,180,270,360,450].map(normalizeSchematicRotation),[270,0,90,180,270,0,90]);
	assert.deepEqual([-90,0,90,180,270,360,450].map(schematicComponentCreateRotation),[90,0,270,180,90,0,270]);
});
