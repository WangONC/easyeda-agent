import test from 'node:test';
import assert from 'node:assert/strict';
import { settleSchematic } from './lifecycle-settle';
test('delayed Host initial schematic is reused only after stable scoped inventory',async()=>{
 let reads=0;const item={uuid:'initial',parentProjectUuid:'p',page:[{uuid:'page'}]};
 const result=await settleSchematic({current:async()=> 'p',inventory:async()=>++reads<3?[]:[item],wait:async()=>{}},'p',undefined,6,0);
 assert.equal(result?.uuid,'initial');assert.equal(reads,4);
});
test('bounded empty/read-error inventory stays unknown; no proof of absence',async()=>{
 for(const throws of [false,true]){let reads=0;const result=await settleSchematic({current:async()=> 'p',inventory:async()=>{reads++;if(throws)throw Error('busy');return []},wait:async()=>{}},'p',undefined,4,0);assert.equal(result,undefined);assert.equal(reads,4);}
});
test('native returned UUID is reconciled, never replaced with an old or other project schematic',async()=>{
 let n=0;const old={uuid:'old',parentProjectUuid:'p'},fresh={uuid:'fresh',parentProjectUuid:'p'};
 const result=await settleSchematic({current:async()=> 'p',inventory:async()=>++n<2?[old]:[old,fresh],wait:async()=>{}},'p','fresh',5,0);
 assert.equal(result?.uuid,'fresh');
 assert.equal(await settleSchematic({current:async()=> 'p',inventory:async()=>[{uuid:'fresh',parentProjectUuid:'other'}],wait:async()=>{}},'p','fresh',2,0),undefined);
});
test('project change and multiple first-container candidates fail closed',async()=>{
 await assert.rejects(settleSchematic({current:async()=> 'other',inventory:async()=>[],wait:async()=>{}},'p'),/Project changed/);
 await assert.rejects(settleSchematic({current:async()=> 'p',inventory:async()=>[{uuid:'a',parentProjectUuid:'p'},{uuid:'b',parentProjectUuid:'p'}],wait:async()=>{}},'p'),/Multiple candidate/);
});

test('container before its automatic first page is not settled',async()=>{
 let reads=0;const result=await settleSchematic({current:async()=> 'p',inventory:async()=>[{uuid:'s',parentProjectUuid:'p',page:++reads<3?[]:[{uuid:'page'}]}],wait:async()=>{}},'p',undefined,5,0);
 assert.equal(result?.uuid,'s');assert.equal(reads,4);
});
