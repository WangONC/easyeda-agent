import {wireGeometry} from './wire-geometry';
// Exact straight closed-path coverage, not a bounding-box or allInside proof.
// Native source may rotate its starting vertex and reverse winding. Curves,
// open paths, malformed commands and missing coverage do not satisfy this proof.
export function closedOutlineGeometry(source:unknown):string {
 if(!Array.isArray(source)||source.length<9)throw Error('V2_OUTLINE_SHAPE');
 const points:number[]=[];
 const pair=(i:number)=>{if(typeof source[i]!=='number'||typeof source[i+1]!=='number'||!Number.isFinite(source[i])||!Number.isFinite(source[i+1]))throw Error('V2_OUTLINE_SHAPE');points.push(source[i],source[i+1]);};
 pair(0);let i=2;
 while(i<source.length){
  if(source[i++]!=='L')throw Error('V2_OUTLINE_SHAPE');
  const start=i;while(i<source.length&&typeof source[i]==='number'){pair(i);i+=2;}
  if(start===i)throw Error('V2_OUTLINE_SHAPE');
 }
 if(points.length<8||points[0]!==points[points.length-2]||points[1]!==points[points.length-1])throw Error('V2_OUTLINE_NOT_CLOSED');
 return wireGeometry(points);
}
export function sameClosedOutline(actual:unknown,expected:unknown):boolean {
 try{return closedOutlineGeometry(actual)===closedOutlineGeometry(expected);}catch{return false;}
}
