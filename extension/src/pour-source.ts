/// <reference types="@jlceda/pro-api-types" />
// Pure polygon construction shared with pour.create; no Host primitive writes.
export function createPourPolygon(points: number[][]) {
 const polygon = eda.pcb_MathPolygon.createPolygon([points[0][0], points[0][1], 'L', ...points.slice(1).flat(), ...points[0]] as TPCB_PolygonSourceArray);
 if (!polygon) throw Error('V2_INVALID_POLYGON');
 return polygon;
}
export function exactSourceDiff(expected: unknown, actual: unknown, path = ''): Array<{path:string;expected:unknown;actual:unknown}> {
 if (JSON.stringify(expected) === JSON.stringify(actual)) return [];
 if (Array.isArray(expected) && Array.isArray(actual) && expected.length === actual.length)
  return expected.flatMap((x,i) => exactSourceDiff(x,actual[i],`${path}/${i}`));
 return [{path,expected,actual}];
}
export function readPourSource(pours: IPCB_PrimitivePour[], raw: unknown) {
 if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('V2_INVALID_SOURCE_PROBE');
 const p = raw as Record<string,unknown>;
 if (Object.keys(p).some(k=>!['primitiveId','points'].includes(k)) || typeof p.primitiveId !== 'string' || !p.primitiveId || !Array.isArray(p.points) || p.points.length < 3 || p.points.length > 4096 || !p.points.every(x=>Array.isArray(x)&&x.length>=2&&x.slice(0,2).every(n=>typeof n==='number'&&Number.isFinite(n)))) throw Error('V2_INVALID_SOURCE_PROBE');
 const matches = pours.filter(x=>x.getState_PrimitiveId()===p.primitiveId);
 if (matches.length !== 1) throw Error('V2_SOURCE_PROBE_IDENTITY_MISMATCH');
 const fresh = matches[0];
 const expected = createPourPolygon((p.points as number[][]).map(x=>[x[0],x[1]])).getSource();
 const actual = fresh.getState_ComplexPolygon().getSource();
 if (expected == null || actual == null) throw Error('V2_SOURCE_PROBE_UNAVAILABLE');
 return {primitiveId:fresh.getState_PrimitiveId(),net:fresh.getState_Net(),layer:fresh.getState_Layer(),name:fresh.getState_PourName(),expected_source:expected,actual_source:actual,diff:exactSourceDiff(expected,actual)};
}
