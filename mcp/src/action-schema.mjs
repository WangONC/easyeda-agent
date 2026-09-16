const selectorProperties={window:{type:'string'},project:{type:'string'},document:{type:'string'}};

function typeSchema(raw){
 const type=raw.replace(/^!/, '');
 if(type==='string')return {type:'string',...(raw.startsWith('!')?{minLength:1}:{})};
 if(type==='number')return {type:'number'};
 if(type==='boolean')return {type:'boolean'};
 if(type==='object')return {type:'object'};
 if(type==='array')return {type:'array'};
 if(type==='string[]')return {type:'array',items:{type:'string',minLength:1}};
 const choices=type.split('|').map(part=>part==='string'?{type:'string',minLength:1}:part==='number'?{type:'number'}:part==='array'?{type:'array'}:part==='string[]'?{type:'array',items:{type:'string'}}:null).filter(Boolean);
 return choices.length===1?choices[0]:{oneOf:choices};
}

export function actionCallSchema(action){
 const properties={};const required=[];
 for(const [name,kind] of Object.entries(action.inputs??{})){
  properties[name]=typeSchema(kind);
  if(kind.startsWith('!'))required.push(name);
 }
 return {type:'object',properties:{action:{const:action.name},input:{type:'object',properties,required,additionalProperties:false},...selectorProperties},required:action.mode==='UNSUPPORTED'?['action']:['action','input'],additionalProperties:false};
}

export function domainCallSchema(actions){
 return {
  type:'object',
  properties:{action:{type:'string',enum:actions.map(action=>action.name)},input:{type:'object'},...selectorProperties},
  required:['action'],
  additionalProperties:false,
  oneOf:actions.map(actionCallSchema)
 };
}

function matches(value,schema){
 if(schema.oneOf)return schema.oneOf.some(choice=>matches(value,choice));
 if(schema.type==='string')return typeof value==='string'&&(!schema.minLength||value.length>=schema.minLength);
 if(schema.type==='number')return typeof value==='number'&&Number.isFinite(value);
 if(schema.type==='boolean')return typeof value==='boolean';
 if(schema.type==='array')return Array.isArray(value)&&(!schema.items||value.every(item=>matches(item,schema.items)));
 if(schema.type==='object')return value!==null&&typeof value==='object'&&!Array.isArray(value);
 return false;
}

export function validateActionInput(action,input){
 if(!input||typeof input!=='object'||Array.isArray(input))return 'input must be an object';
 const schema=actionCallSchema(action).properties.input;
 for(const name of schema.required)if(!Object.hasOwn(input,name))return `missing required field: ${name}`;
 for(const [name,value] of Object.entries(input)){
  if(!Object.hasOwn(schema.properties,name))return `unknown business field: ${name}`;
  if(!matches(value,schema.properties[name]))return `wrong type: ${name}`;
 }
 return '';
}
