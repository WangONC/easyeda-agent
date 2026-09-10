import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const catalog=JSON.parse(execFileSync(process.env.GO_BIN||'go',['run','./cmd/easyeda','v2','catalog'],{cwd:root,encoding:'utf8'}));
const generated=Object.fromEntries(catalog.filter(a=>a.mode==='V2_NATIVE').map(a=>[a.name,{schema:a.schema,...a.v2}]));
const output=JSON.stringify(generated,null,2)+'\n';
const path=fileURLToPath(new URL('../extension/src/v2-catalog.generated.json',import.meta.url));
if(process.argv.includes('--check')){if(readFileSync(path,'utf8').replaceAll('\r\n','\n')!==output)throw Error('V2_CATALOG_OUT_OF_DATE');}else writeFileSync(path,output);
