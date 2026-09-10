export type TitleBlockPatch = { showTitle?: boolean; showValue?: boolean; value?: unknown };

/**
 * 逐子字段判定一个明细项是否已落到位。未请求的子字段不参与判定。
 *
 * `value` 比对经 String() 归一化:平台会把数字回读成字符串(反之亦然),
 * 那是格式归一化而非丢弃,不能算 notApplied(同 #151 的 number→string 教训)。
 */
export function titleBlockFieldApplied(actual: TitleBlockPatch | undefined, want: TitleBlockPatch): boolean {
	if (!actual || typeof actual !== 'object') return false;
	if (want.value !== undefined && String(actual.value ?? '') !== String(want.value)) return false;
	if (want.showTitle !== undefined && actual.showTitle !== want.showTitle) return false;
	if (want.showValue !== undefined && actual.showValue !== want.showValue) return false;
	return true;
}

const TITLE_BLOCK_STRUCTURAL_FIELDS: ReadonlySet<string> = new Set([
	'Device', 'Symbol', 'ID',
	'Size', 'Page Size', 'Width', 'Height', 'Blade Width',
	'Region Start', 'X Region Count', 'Y Region Count', 'Title Block Position',
	'Border', 'Title Block', 'Color',
]);

/** `@` 前缀是平台自动投影的只读项,与上表同样不许下发。 */
export function isTitleBlockStructuralKey(key: string): boolean {
	return key.startsWith('@') || TITLE_BLOCK_STRUCTURAL_FIELDS.has(key);
}
