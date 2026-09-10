import {readFileSync} from 'node:fs';
import {interpret} from '../mcp/src/execution.generated.mjs';
const cases=JSON.parse(readFileSync(0,'utf8'));
process.stdout.write(JSON.stringify(cases.map(c=>{
 const first=interpret(c.request,c.response,c.before);
 const repeated=interpret(c.request,{...c.response,execution:first},c.before);
 return {first,repeated};
})));
