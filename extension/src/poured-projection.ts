import type {Primitive,Point} from './fast-path';
import {polygonRings,sourcePath,projectionError} from './compact-polygon';

export interface NativeFill {id:string;source:unknown;filled:boolean;line_width:number}
export function projectPoured(id:string,net:string,layer:number,fills:NativeFill[],hostVersion:string):Primitive[] {
 // Empirically verified against native pad centers and requested boundary in
 // host-poured-3.2.186.json. Do not generalize this internal unit across Hosts.
 if(hostVersion!=='3.2.186')return [{id,net,layer,kind:'pour',unsupported:true,coverage:'unsupported'}];
 const scale=10;const point=(p:Point):Point=>[p[0]*scale,p[1]*scale];
 return fills.map(f=>{
  const rings=f.filled?polygonRings(f.source):undefined;
  const points=!f.filled?sourcePath(f.source):undefined;
  const supported=(f.filled?!!rings:!!points)&&Number.isFinite(f.line_width)&&f.line_width>=0;
  return {id:`${id}:${f.id}`,kind:f.filled?'fill':'arc',net,layer,
   rings:rings?.map(r=>r.map(point)),points:points?.map(point),width:f.line_width*scale,
   projection_error:projectionError*scale,unsupported:!supported,coverage:supported?'conservative':'unsupported'};
 });
}
