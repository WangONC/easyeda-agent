const fs = require('fs');
const ts = require('../extension/node_modules/typescript');
const input = fs.readFileSync('extension/src/execution.ts','utf8').replace("import contracts from './action-contracts.json';",'const contracts = '+fs.readFileSync('extension/src/action-contracts.json','utf8')+';');
const output = '// Generated from extension/src/execution.ts and the Go ActionSpec catalog. Do not edit.\n'+ts.transpileModule(input,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
if(process.argv.includes('--check')) {if(fs.readFileSync('mcp/src/execution.generated.mjs','utf8')!==output)throw Error('stale execution projection');}
else fs.writeFileSync('mcp/src/execution.generated.mjs',output);
