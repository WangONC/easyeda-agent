export async function verifySchematicPageName(pageUuid: string, expected: string): Promise<boolean> {
	const delays = [0, 120, 250, 500]; // ~0.87s worst case, small enough to stay snappy
	for (const wait of delays) {
		if (wait > 0) {
			await new Promise<void>(resolve => setTimeout(resolve, wait));
		}
		try {
			const pages = await eda.dmt_Schematic.getAllSchematicPagesInfo();
			const hit = pages.find(p => p.uuid === pageUuid);
			if (hit && hit.name === expected) return true;
		}
		catch {
			/* best-effort — treat as not-yet-settled and keep polling */
		}
	}
	return false;
}

/**
 * Wait for a just-opened schematic page's data to settle. `openDocument`
 * resolves as soon as the tab exists — BEFORE the page's primitives finish
 * (re)loading — so a read fired right after would sample a half-loaded page
 * (empty findings, stale mixed-page data — issue #67). The SDK exposes no
 * load-complete signal, so we poll the active page's component count and treat
 * two identical consecutive reads as settled. A non-empty stable count settles
 * immediately; a stable 0 only settles after the full delay window, so a page
 * mid-load (0 → N) is not mistaken for a genuinely empty page. Returns true if
 * it settled, false on timeout — best-effort, read errors keep polling.
 */
export async function waitSchematicPageSettle(): Promise<boolean> {
	const delays = [0, 200, 300, 400, 500, 600]; // ~2s worst case
	let last: number | undefined;
	let sawStableEmpty = 0;
	for (const wait of delays) {
		if (wait > 0) {
			await new Promise<void>(resolve => setTimeout(resolve, wait));
		}
		let count: number | undefined;
		try {
			const comps = await eda.sch_PrimitiveComponent.getAll();
			count = Array.isArray(comps) ? comps.length : undefined;
		}
		catch {
			count = undefined; // treat as not-yet-settled, keep polling
		}
		if (count === undefined) continue;
		if (last !== undefined && last === count) {
			if (count > 0) return true;
			sawStableEmpty++;
			if (sawStableEmpty >= 2) return true; // stable-empty confirmed
		}
		last = count;
	}
	return false;
}
