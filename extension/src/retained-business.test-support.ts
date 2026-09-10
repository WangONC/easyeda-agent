// Test-only retained business fixture. This does not certify V2 migration.
import { execFileSync } from 'node:child_process';
import Module from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const names = ['libraryFootprintCreate','libraryFootprintCopy','libraryFootprintBuild','libraryDeviceCreate','libraryDeviceDelete','schematicPrimitivesDelete','schematicComponentDelete','schematicCheck','schematicComponentResolveLcsc','schematicComponentReplace'];
const filename = path.join(__dirname, 'retained-business.fixture.ts');
const fixture = new Module(filename, module) as Module & {paths:string[];_compile(source:string,filename:string):void;exports:{retained:Record<string,(input:Record<string,unknown>)=>Promise<any>>}};
fixture.filename = filename;
fixture.paths = module.paths;
const source = execFileSync('git',['show','a583bf731d946d2d39f1223e078d711bd41710d5:extension/src/actions.ts'],{encoding:'utf8'}) + '\nexport const retained = {' + names.join(',') + '};';
fixture._compile(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText, filename);
export const retained = fixture.exports.retained;
