import test from 'node:test';
import assert from 'node:assert/strict';
import {manufacturingExport} from './manufacturing';
test('manufacturing uses explicit profile, requests both drills and never certifies returned File',async()=>{
 let calls=0;
 const file=Object.assign(new Blob(['fixture']),{name:'fixture.csv'}) as File;
 (globalThis as unknown as {eda:unknown}).eda={dmt_Project:{getCurrentProjectInfo:async()=>({uuid:'p'})},dmt_SelectControl:{getCurrentDocumentInfo:async()=>({uuid:'d',documentType:3})},pcb_Layer:{getAllLayers:async()=>[{id:1}]},pcb_ManufactureData:{getGerberFile:async(...args:unknown[])=>{calls++;assert.deepEqual(args[4],{metallicDrillingInformation:true,nonMetallicDrillingInformation:true,drillTable:true,flyingProbeTestingFile:false});return file},getBomFile:async()=>{calls++;return file},getPickAndPlaceFile:async()=>{calls++;return file}}};
 const p={project_uuid:'p',document_uuid:'d',profile:{id:'test',reviewed:true,units:'mm',layers:[1]}};
 const r=await manufacturingExport(p,async()=>({id:'artifact',kind:'fixture',mimeType:'text/csv'}));
 assert.equal(calls,3);assert.equal(r.result.status,'unverified');assert.equal(r.artifacts.length,3);
 await assert.rejects(manufacturingExport({...p,document_uuid:'other'},async()=>({id:'x',kind:'x'})),/document changed/);
 assert.equal(calls,3);
});
