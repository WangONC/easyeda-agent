// Public schematic rotations use the same canonical absolute degrees returned
// by component fresh readback. Component.modify accepts this convention.
export function normalizeSchematicRotation(rotation: number): number {
	const normalized = rotation % 360;
	return Object.is(normalized, -0) ? 0 : (normalized + 360) % 360;
}

// SCH_PrimitiveComponent.create stores/readbacks the opposite direction from
// its rotation argument. This is a deterministic modulo-360 conversion at the
// Host write boundary; component.modify already uses public/readback degrees.
export function schematicComponentCreateRotation(rotation: number): number {
	return normalizeSchematicRotation(-rotation);
}
