import path from 'node:path';
import { defineConfig } from 'vitest/config';

/** Slash command registration limits. Separate from the unit suite because it loads every command. */
export default defineConfig({
	test: {
		name: 'Old School Bot - Command limits',
		include: ['tests/commands/**/*.test.ts'],
		setupFiles: 'tests/unit/setup.ts',
		pool: 'forks',
		teardownTimeout: 10_000
	},
	resolve: {
		alias: {
			'@': path.resolve(import.meta.dirname, './src')
		}
	}
});
