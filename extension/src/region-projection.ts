import {polygonRings,projectionError} from './compact-polygon';
import type {Primitive} from './fast-path';
// Only documented rule numbers. FOLLOW_REGION_RULE and unknown values require
// named rule expansion and remain unsupported, never silently permissive.
export function projectRegion(id:string,layer:number,source:unknown,rules:number[],width:number):Primitive{
 const rings=polygonRings(source);
 const known=rules.length>0&&rules.every(r=>[2,5,6,7,8].includes(r));
 return {id,kind:'region',layer,rings,width,projection_error:projectionError,rule_types:rules,
  routing_blocked:known?rules.some(r=>r===5||r===8):undefined,
  unsupported:!known||!rings,coverage:known&&rings?'conservative':'unsupported'};
}
