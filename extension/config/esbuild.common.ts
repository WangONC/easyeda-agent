import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

import type esbuild from 'esbuild';

// Inject the real connector version (from extension.json) at build time so the
// handshake reports the actual build, not a stale hardcoded constant. This is
// what `easyeda daemon health` shows per window — load-bearing for diagnosing a
// stale open EasyEDA window running old connector code. (CommonJS via ts-node,
// so __dirname, not import.meta.)
const extJson = JSON.parse(
	readFileSync(join(__dirname, '..', 'extension.json'), 'utf-8'),
);

function sourceRevision(): string {
	if (process.env.EASYEDA_SOURCE_REVISION) return process.env.EASYEDA_SOURCE_REVISION;
	try {
		const root=join(__dirname,'..','..');
		const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
		const dirty=execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim();
		return commit+(dirty?'-dirty':'');
	} catch { return 'unknown'; }
}

export default {
	entryPoints: {
		index: './src/index',
	},
	entryNames: '[name]',
	assetNames: '[name]',
	bundle: true, // 用于内部方法调用，请勿修改
	minify: false, // 用于内部方法调用，请勿修改
	loader: {},
	outdir: './dist/',
	sourcemap: undefined,
	platform: 'browser', // 用于内部方法调用，请勿修改
	format: 'iife', // 用于内部方法调用，请勿修改
	globalName: 'edaEsbuildExportName', // 用于内部方法调用，请勿修改
	treeShaking: true,
	ignoreAnnotations: true,
	define: {
		__CONNECTOR_VERSION__: JSON.stringify(extJson.version ?? '0.0.0-dev'),
		__CONNECTOR_SOURCE_REVISION__: JSON.stringify(sourceRevision()),
	},
	external: [],
} satisfies Parameters<(typeof esbuild)['build']>[0];
