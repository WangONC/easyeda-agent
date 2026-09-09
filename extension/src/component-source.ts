/// <reference types="@jlceda/pro-api-types" />
import { canonical } from './fast-path';
export const SOURCE_KEY = 'EasyEDA Agent Source Device';
type RecordValue = Record<string, unknown>;
export const object = (v:unknown):RecordValue => v && typeof v==='object' && !Array.isArray(v)?v as RecordValue:{};
const ref = (v:unknown) => {const r=object(v);return {uuid:r.uuid,libraryUuid:r.libraryUuid};};
export function sourceAsset(device:unknown) {
 const d=object(device),a=object(d.association);
 if(typeof d.uuid!=='string'||!/^[a-f0-9]{32}$/i.test(d.uuid)||typeof d.libraryUuid!=='string'||!d.libraryUuid)throw Error('Source requires a real 32-character library device UUID');
 const symbol=ref(a.symbol),footprint=ref(a.footprint);
 if(typeof symbol.uuid!=='string'||!/^[a-f0-9]{32}$/i.test(symbol.uuid)||!symbol.libraryUuid)throw Error('Source symbol association unavailable');
 return {uuid:d.uuid,libraryUuid:d.libraryUuid,symbol,footprint,subPartNames:d.subPartNames};
}
function binding(s:RecordValue){return {component:ref(s.component),symbol:ref(s.symbol),footprint:ref(s.footprint),subPartName:s.subPartName};}
export function sourceReceipt(snapshot:RecordValue,device:unknown):string {
 return canonical({version:1,source:sourceAsset(device),binding:binding(snapshot)});
}
export async function resolveSource(snapshot:RecordValue,get:(uuid:string,library:string)=>Promise<unknown>) {
 const value=object(snapshot.otherProperty)[SOURCE_KEY];if(value===undefined)return undefined;
 if(typeof value!=='string'||value.length>8192)throw Error('Invalid saved source identity');
 const saved=object(JSON.parse(value)),source=object(saved.source);
 if(saved.version!==1||canonical(saved.binding)!==canonical(binding(snapshot)))throw Error('Saved source identity does not match current instance binding');
 const live=sourceAsset(await get(String(source.uuid),String(source.libraryUuid)));
 if(canonical(source)!==canonical(live))throw Error('Source library association changed; reconstruction is unverified');
 return {uuid:live.uuid,libraryUuid:live.libraryUuid,via:'placement-source'};
}

export function sourceStorageKey(project:string,document:string,primitive:unknown):string {
 if(!project||!document||typeof primitive!=='string'||!primitive)throw Error('Source receipt requires project/page/primitive identity');
 return `component-source-v1:${project}:${document}:${primitive}`;
}
