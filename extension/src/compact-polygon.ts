import type {Point} from './fast-path';

// Finite native-source adapter, not a Boolean/CAD engine. Native complex
// polygons use NONZERO winding (pro-api-types IPCB_ComplexPolygon remarks).
export const projectionError = 0.05; // mil; distance checks subtract this bound
function finite(n:unknown):n is number {return typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<1e8}
export function arcPoints(a:Point,b:Point,degrees:number):Point[]|undefined {
 if(![...a,...b,degrees].every(finite)||degrees===0||Math.abs(degrees)>=360)return undefined;
 const theta=degrees*Math.PI/180;const chord=Math.hypot(b[0]-a[0],b[1]-a[1]);if(chord===0)return undefined;
 const cx=(a[0]+b[0])/2-(b[1]-a[1])/(2*Math.tan(theta/2));
 const cy=(a[1]+b[1])/2+(b[0]-a[0])/(2*Math.tan(theta/2));
 const radius=Math.hypot(a[0]-cx,a[1]-cy);if(!finite(radius)||radius<=0)return undefined;
 const step=2*Math.acos(Math.max(-1,1-projectionError/radius));
 const count=Math.max(1,Math.ceil(Math.abs(theta)/step));if(!Number.isFinite(count)||count>4096)return undefined;
 const start=Math.atan2(a[1]-cy,a[0]-cx);const points:Point[]=[a];
 for(let i=1;i<count;i++)points.push([cx+radius*Math.cos(start+theta*i/count),cy+radius*Math.sin(start+theta*i/count)]);
 points.push(b);return points;
}
export function sourcePath(source:unknown, closed=false):Point[]|undefined {
 if(!Array.isArray(source)||source.length>16384)return undefined;
 if(source[0]==='R') {
  const [,x,y,w,h,rot,round]=source;
  if(source.length!==7||![x,y,w,h,rot,round].every(finite)||w<=0||h<=0||round!==0)return undefined;
  const angle=rot*Math.PI/180;
  return ([[0,0],[w,0],[w,h],[0,h]] as Point[]).map(([dx,dy])=>[x+dx*Math.cos(angle)-dy*Math.sin(angle),y+dx*Math.sin(angle)+dy*Math.cos(angle)]);
 }
 if(source[0]==='CIRCLE') {
  const [,x,y,r]=source;if(source.length!==4||![x,y,r].every(finite)||r<=0)return undefined;
  const count=Math.max(8,Math.ceil(Math.PI/Math.acos(Math.max(-1,1-projectionError/r))));if(count>4096)return undefined;
  return Array.from({length:count},(_,i)=>[x+r*Math.cos(i*2*Math.PI/count),y+r*Math.sin(i*2*Math.PI/count)] as Point);
 }
 if(!finite(source[0])||!finite(source[1]))return undefined;
 const points:Point[]=[[source[0],source[1]]];let i=2;let mode='L';
 while(i<source.length){
  if(typeof source[i]==='string'){mode=source[i++];if(!['L','ARC','CARC'].includes(mode))return undefined}
  if(mode==='L') {if(!finite(source[i])||!finite(source[i+1]))return undefined;points.push([source[i],source[i+1]]);i+=2}
  else {const [angle,x,y]=source.slice(i,i+3);if(![angle,x,y].every(finite))return undefined;const arc=arcPoints(points[points.length-1],[x,y],angle);if(!arc)return undefined;points.push(...arc.slice(1));i+=3;mode='L'}
  if(points.length>16384)return undefined;
 }
 if(closed&&points.length>1&&points[0][0]===points[points.length-1][0]&&points[0][1]===points[points.length-1][1])points.pop();
 if(points.length<(closed?3:2))return undefined;return points;
}
export function polygonRings(source:unknown):Point[][]|undefined {
 if(!Array.isArray(source)||source.length===0)return undefined;
 const sources=Array.isArray(source[0])?source:[source];if(sources.length>1024)return undefined;
 const result:Point[][]=[];let total=0;
 for(const s of sources){const r=sourcePath(s,true);if(!r)return undefined;total+=r.length;if(total>32768)return undefined;result.push(r)}
 return result;
}
