// Native wire geometry is undirected. This module is business geometry only:
// it never authorizes an Outcome, chooses a target, or invokes a Host effect.
export type WireSegment = [number, number, number, number];
// Absolute coordinate normalization in mil, matching the existing group-move
// zero-length threshold. Not a routing clearance or a pin-discovery tolerance.
// Rounding can conservatively reject values across a cell boundary; it cannot
// hide a coordinate displacement greater than this resolution.
export const WIRE_COORDINATE_RESOLUTION = 1e-6;
const coordinate = (n: number) => {
 if(!Number.isFinite(n)||Math.abs(n/WIRE_COORDINATE_RESOLUTION)>Number.MAX_SAFE_INTEGER)throw Error('V2_WIRE_SHAPE');
 return Math.round(n/WIRE_COORDINATE_RESOLUTION)*WIRE_COORDINATE_RESOLUTION;
};
export function wireSegments(line: unknown, native = false): WireSegment[] {
 if(!Array.isArray(line)||!line.length)throw Error('V2_WIRE_SHAPE');
 // Explicit nested point notation is a polyline. Native rows of segment data
 // follow the baseline Host workaround, including unordered segment arrays.
 const points=Array.isArray(line[0])&&line.every(r=>Array.isArray(r)&&r.length===2);
 const rows:unknown[]=points?[line.flat()]:Array.isArray(line[0])?line:[line];
 const out:WireSegment[]=[];
 for(const raw of rows){
  if(!Array.isArray(raw)||raw.length<4||raw.length%2||!raw.every(v=>typeof v==='number'&&Number.isFinite(v)))throw Error('V2_WIRE_SHAPE');
  const stride=native&&!points&&raw.length>=8&&raw.length%4===0?4:2;
  for(let i=0;i+3<raw.length;i+=stride){
   const segment=raw.slice(i,i+4).map(coordinate) as WireSegment;
   if(segment[0]!==segment[2]||segment[1]!==segment[3])out.push(segment);
  }
 }
 return out;
}
export const nativeWireSegments=(line:unknown)=>wireSegments(line,true);
export function segmentCoverage(segments:WireSegment[]):string {
 const groups=new Map<string,Array<[number,number]>>();
 for(const [x,y,u,v] of segments){
  if(x===u&&y===v)continue;
  // Integer-grid line identity avoids slope/intercept roundoff changing when
  // the same diagonal is reversed or split into collinear native segments.
  const grid=(n:number)=>BigInt(Math.round(coordinate(n)/WIRE_COORDINATE_RESOLUTION));
  const X=grid(x),Y=grid(y),U=grid(u),V=grid(v);
  let dx=U-X,dy=V-Y;
  const abs=(n:bigint)=>n<0n?-n:n;
  let aG=abs(dx),bG=abs(dy);while(bG){[aG,bG]=[bG,aG%bG];}
  if(!aG)continue;
  dx/=aG;dy/=aG;if(dx<0n||dx===0n&&dy<0n){dx=-dx;dy=-dy;}
  const key=JSON.stringify([dx.toString(),dy.toString(),(dx*Y-dy*X).toString()]);
  const a=x===u?y:x,b=x===u?v:u,intervals=groups.get(key)??[];
  intervals.push([Math.min(a,b),Math.max(a,b)]);groups.set(key,intervals);
 }
 return JSON.stringify([...groups].sort(([a],[b])=>a.localeCompare(b)).map(([key,intervals])=>{
  intervals.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const merged:Array<[number,number]>=[]=[];
  for(const pair of intervals){const prev=merged[merged.length-1];if(prev&&pair[0]<=prev[1])prev[1]=Math.max(prev[1],pair[1]);else merged.push([...pair]);}
  return [key,merged];
 }));
}
export function wireGeometry(line:unknown,native=false):string {
 const segments=wireSegments(line,native);if(!segments.length)throw Error('V2_WIRE_SHAPE');return segmentCoverage(segments);
}
export function sameWireGeometry(actual:unknown,expected:unknown):boolean{return wireGeometry(actual,true)===wireGeometry(expected);}
export interface WireSnapshot {id:string;line:unknown;net:unknown;color:unknown;lineWidth:unknown;lineType:unknown}
export function wireInventoryCoverage(wires:WireSnapshot[]):string {
 const groups=new Map<string,WireSegment[]>();
 for(const w of wires){const key=JSON.stringify([w.net,w.color,w.lineWidth,w.lineType]),segments=groups.get(key)??[];segments.push(...nativeWireSegments(w.line));groups.set(key,segments);}
 return JSON.stringify([...groups].sort(([a],[b])=>a.localeCompare(b)).map(([key,segments])=>[key,segmentCoverage(segments)]));
}

export function wireAdditionProof(before:WireSnapshot[],after:WireSnapshot[],id:string,points:unknown,requested:Partial<Pick<WireSnapshot,'net'|'color'|'lineWidth'|'lineType'>>={},retagMerged=false):boolean {
 const byId=new Map(after.map(w=>[w.id,w])),fresh=byId.get(id),oldIds=new Set(before.map(w=>w.id));
 if(!fresh||oldIds.size!==before.length||new Set(after.map(w=>w.id)).size!==after.length||before.some(w=>!w.id)||after.some(w=>!w.id||!oldIds.has(w.id)&&w.id!==id))return false;
 const style=(w:WireSnapshot)=>JSON.stringify([w.net,w.color,w.lineWidth,w.lineType]);
 if((['net','color','lineWidth','lineType'] as const).some(k=>requested[k]!==undefined&&fresh[k]!==requested[k]))return false;
 const segments=wireSegments(points);if(!segments.length)return false;
 const expected:WireSnapshot[]=[];
 for(const old of before){
  const current=byId.get(old.id);
  if(current&&style(current)===style(old)&&wireGeometry(current.line,true)===wireGeometry(old.line,true)){expected.push(old);continue;}
  if(current&&old.id!==id||!wireTouches(old.line,points))return false;
  const sameStyle=old.color===fresh.color&&old.lineWidth===fresh.lineWidth&&old.lineType===fresh.lineType;
  if(!sameStyle||!retagMerged&&old.net!==fresh.net)return false;
  expected.push(retagMerged?{...old,net:fresh.net}:old);
 }
 expected.push({...fresh,line:segments});
 return wireInventoryCoverage(after)===wireInventoryCoverage(expected);
}

export function wireTouches(line:unknown,points:unknown):boolean {
 const segments=wireSegments(points);
 const at=(x:number,y:number,s:WireSegment)=>{
  const [a,b,u,v]=s,dx=u-a,dy=v-b,length=Math.hypot(dx,dy);
  return Math.abs((x-a)*dy-(y-b)*dx)<=WIRE_COORDINATE_RESOLUTION*length&&x>=Math.min(a,u)-WIRE_COORDINATE_RESOLUTION&&x<=Math.max(a,u)+WIRE_COORDINATE_RESOLUTION&&y>=Math.min(b,v)-WIRE_COORDINATE_RESOLUTION&&y<=Math.max(b,v)+WIRE_COORDINATE_RESOLUTION;
 };
 return nativeWireSegments(line).some(a=>segments.some(b=>at(a[0],a[1],b)||at(a[2],a[3],b)||at(b[0],b[1],a)||at(b[2],b[3],a)));
}
