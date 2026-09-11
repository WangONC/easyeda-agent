import test from 'node:test';
import assert from 'node:assert/strict';
import {netlistDiagnostic} from './netlist-diagnostic';
test('read-only raw stored and rendered netlists remain distinct; identity is not guessed',async()=>{
 let calls=0; (globalThis as any).eda={pcb_Net:{getNetlist:async()=>{calls++;return '{"nets":[],"internal":"stored"}';}},pcb_ManufactureData:{getNetlistFile:async()=>({text:async()=>'{"nets":["N"]}'})}};
 const d=await netlistDiagnostic('pcb',[{getState_UniqueId:()=> 'u',getState_Pads:()=>[{padNumber:'1',net:''}]}]);
 assert.equal(d.stored_netlist.status,'observed');assert.notDeepEqual(d.stored_netlist,d.manufacture_netlist);assert.equal(calls,1);
 assert.deepEqual(d.bindings[0].UniqueId,{status:'observed',value:'u'});assert.deepEqual(d.bindings[0].Component,{status:'not_exposed'});
});
test('undefined/throw are unavailable and do not become empty graphs',async()=>{
 (globalThis as any).eda={pcb_Net:{getNetlist:async()=>{throw Error('no');}},pcb_ManufactureData:{getNetlistFile:async()=>undefined}};
 const d=await netlistDiagnostic('pcb',[]);assert.equal(d.stored_netlist.status,'unavailable');assert.equal(d.manufacture_netlist.status,'unavailable');
});
test('schematic uses only official manufacture getter; raw text preserved',async()=>{
 (globalThis as any).eda={sch_ManufactureData:{getNetlistFile:async()=>({text:async()=>' raw '})}};
 const d=await netlistDiagnostic('schematic',[]);assert.equal(d.manufacture_netlist.raw,' raw ');assert.equal(d.stored_netlist.status,'not_called');
});
