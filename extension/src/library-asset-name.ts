function normalizeLibraryNamePart(value: string, fallback: string): string {
	const normalized = value.normalize('NFKC').trim().toUpperCase()
		.replace(/[^\p{L}\p{N}]+/gu, '_')
		.replace(/^_+|_+$/g, '')
		.replace(/_+/g, '_');
	return normalized || fallback;
}

/** Keep agent-authored personal-library assets reusable and visibly separate. */
export async function namespacedLibraryAssetName(requestedName: string): Promise<{ name: string; requestedName: string; namespace: string }> {
	const assetMark = normalizeLibraryNamePart(requestedName, 'ASSET');
	const namespace = 'EA_AGENT';
	const prefix = `${namespace}__`;
	return {
		name: requestedName.toUpperCase().startsWith(prefix) ? requestedName : `${prefix}${assetMark}`,
		requestedName,
		namespace,
	};
}
