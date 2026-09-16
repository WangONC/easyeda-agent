import test from 'node:test';
import assert from 'node:assert/strict';
import {actionCallSchema,domainCallSchema,validateActionInput} from '../src/action-schema.mjs';

const create={name:'project.create',inputs:{name:'!string',team_uuid:'string',folder_uuid:'string'}};

test('MCP derives per-action JSON schema from the public catalog',()=>{
 const schema=domainCallSchema([create,{name:'project.list',inputs:{team_uuid:'string'}}]);
 assert.equal(schema.oneOf.length,2);
 const call=actionCallSchema(create);
 assert.deepEqual(call.properties.action,{const:'project.create'});
 assert.deepEqual(call.properties.input.required,['name']);
 assert.equal(call.properties.input.additionalProperties,false);
});

test('MCP rejects unknown, missing and wrong-type business fields before CLI',()=>{
 assert.equal(validateActionInput(create,{name:'Personal'}),'');
 assert.match(validateActionInput(create,{}),/missing required field: name/);
 assert.match(validateActionInput(create,{name:3}),/wrong type: name/);
 for(const field of ['client_transaction_id','session_token','activation','target_ref']){
  assert.match(validateActionInput(create,{name:'Personal',[field]:'injected'}),/unknown business field/);
 }
});
