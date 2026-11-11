import path from 'node:path';
import { type BuildOptions, build } from 'esbuild';

const baseBuildOptions: BuildOptions = {
	bundle: true,
	format: 'esm',
	legalComments: 'none',
	platform: 'node',
	loader: {
		'.node': 'file'
	},
	target: 'node24.8.0',
	sourcemap: 'inline',
	minify: false,
	metafile: true,
	packages: 'external',
	// pnpm build:quick is the prod deploy step. Workspace packages are
	// otherwise loaded from a stale packages/*/dist that this command does
	// not rebuild, so interaction reply fixes never went live. Bundle the
	// Discord package from source so baseReply changes ship with dist/.
	alias: {
		'@oldschoolgg/discord': path.resolve(import.meta.dirname, 'packages/discord/src/index.ts')
	}
};

build({
	...baseBuildOptions,
	entryPoints: ['src/index.ts'],
	outdir: './dist'
});

// Workers
build({
	...baseBuildOptions,
	entryPoints: [
		'src/lib/workers/kill.worker.ts',
		'src/lib/workers/finish.worker.ts',
		'src/lib/workers/casket.worker.ts'
	],
	outdir: './dist/lib/workers'
});
