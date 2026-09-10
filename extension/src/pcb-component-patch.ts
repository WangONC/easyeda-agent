import { ActionError, ErrorCodes } from './protocol';
type PcbComponent = NonNullable<Awaited<ReturnType<typeof eda.pcb_PrimitiveComponent.getAll>>>[number];
export function serializePcbComponent(component: PcbComponent): Record<string, unknown> {
	return {
		primitiveId: component.getState_PrimitiveId(),
		// uniqueId is the SAME namespace the schematic side reports (serializeComponent
		// already exposes it): a component keeps one `gge*` id across both documents,
		// minted by the platform at first sch→PCB import. primitiveId does NOT — each
		// document mints its own — so uniqueId is the only reliable schematic↔PCB join
		// key. `pcb sync-designators` uses it to repair placeholder designators
		// (U? / C? / RF?) on boards wiped by the old attrs_backfill Designator-key bug.
		uniqueId: component.getState_UniqueId(),
		designator: component.getState_Designator(),
		name: component.getState_Name(),
		layer: component.getState_Layer(),
		x: component.getState_X(),
		y: component.getState_Y(),
		rotation: component.getState_Rotation(),
		locked: component.getState_PrimitiveLock(),
		addIntoBom: component.getState_AddIntoBom(),
		manufacturerId: component.getState_ManufacturerId(),
		supplierId: component.getState_SupplierId(),
	};
}

export const PCB_COMPONENT_PATCH_READBACK: Record<string, string | null> = {
	layer: 'layer',
	x: 'x',
	y: 'y',
	rotation: 'rotation',
	primitiveLock: 'locked',
	addIntoBom: 'addIntoBom',
	designator: 'designator',
	name: 'name',
	uniqueId: 'uniqueId',
	manufacturerId: 'manufacturerId',
	supplierId: 'supplierId',
	manufacturer: null,
	supplier: null,
	otherProperty: null,
};

/** Natural spellings accepted for the awkward official key names. */
export const PCB_COMPONENT_PATCH_ALIASES: Record<string, string> = {
	locked: 'primitiveLock',
	lock: 'primitiveLock',
};

/**
 * Normalize a pcb.component.modify patch: map aliases onto the official keys
 * and reject unknown keys (the platform ignores them WITHOUT erroring — the
 * root cause of the #174 fake success).
 */
export function normalizePcbComponentPatch(raw: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	const unknown: Array<string> = [];
	for (const [rawKey, value] of Object.entries(raw)) {
		const key = PCB_COMPONENT_PATCH_ALIASES[rawKey] ?? rawKey;
		if (!(key in PCB_COMPONENT_PATCH_READBACK)) {
			unknown.push(rawKey);
			continue;
		}
		if (key in out && out[key] !== value) {
			throw new ActionError(
				ErrorCodes.MISSING_PAYLOAD_FIELD,
				`Patch sets "${key}" twice with conflicting values (an alias like "locked" maps onto "primitiveLock").`,
			);
		}
		out[key] = value;
	}
	if (unknown.length > 0) {
		throw new ActionError(
			ErrorCodes.MISSING_PAYLOAD_FIELD,
			`Unknown patch field(s): ${unknown.join(', ')}. The platform silently ignores unknown keys and still `
			+ `reports success (#174), so they are rejected here. Valid keys: `
			+ `${Object.keys(PCB_COMPONENT_PATCH_READBACK).join(', ')} (aliases: locked/lock → primitiveLock).`,
		);
	}
	if (Object.keys(out).length === 0) {
		throw new ActionError(ErrorCodes.MISSING_PAYLOAD_FIELD, 'Patch object is empty — nothing to modify.');
	}
	return out;
}

export interface PcbPatchVerification {
	/** patch keys the fresh readback confirms. */
	applied: Array<string>;
	/** patch keys the readback contradicts — the write did NOT stick. */
	notApplied: Array<{ field: string; expected: unknown; actual: unknown }>;
	/** patch keys the serializer cannot read back (manufacturer/supplier/otherProperty, or a non-numeric layer literal). */
	unverified: Array<string>;
}

const normDeg = (v: number): number => ((v % 360) + 360) % 360;

/**
 * Compare a normalized patch against a FRESH readback record (#174). The
 * object returned by modify() — and even getState_* on the object you just
 * wrote — can echo the input, so the caller must re-pull before verifying.
 */
export function verifyPcbComponentPatch(
	patch: Record<string, unknown>,
	readback: Record<string, unknown>,
): PcbPatchVerification {
	const v: PcbPatchVerification = { applied: [], notApplied: [], unverified: [] };
	for (const [field, expected] of Object.entries(patch)) {
		const readKey = PCB_COMPONENT_PATCH_READBACK[field];
		if (readKey === null || readKey === undefined) {
			v.unverified.push(field);
			continue;
		}
		const actual = readback[readKey];
		let ok: boolean | null;
		if (field === 'layer' && typeof expected !== 'number') {
			// The CLI historically accepts layer literals like "BOTTOM"; the readback
			// is numeric, and we have no trusted name→id table here — don't guess.
			ok = null;
		}
		else if (typeof expected === 'number' && typeof actual === 'number') {
			ok = field === 'rotation'
				? Math.abs(normDeg(expected) - normDeg(actual)) < 1e-3
				: Math.abs(expected - actual) < 1e-3;
		}
		else if (expected === null) {
			// modify() documents null as "leave blank" — an empty readback matches.
			ok = actual === null || actual === undefined || actual === '';
		}
		else {
			ok = actual === expected;
		}
		if (ok === null) v.unverified.push(field);
		else if (ok) v.applied.push(field);
		else v.notApplied.push({ field, expected, actual });
	}
	return v;
}
