import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { backupFileName, libpqEnv } from '@/lib/hosting/wipePlan.js';

export function dumpDatabase(connectionString: string, databaseName: string, label: string): Promise<string> {
	const relative = backupFileName(databaseName, label);
	const file = path.resolve(relative);
	mkdirSync(path.dirname(file), { recursive: true });
	const env = { ...process.env, ...libpqEnv(connectionString) };
	return new Promise((resolve, reject) => {
		const child = spawn('pg_dump', ['--format=custom', '--no-owner', '--file', file], {
			env,
			stdio: 'inherit'
		});
		child.on('error', error => {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				reject(
					new Error(
						'pg_dump was not found on PATH. Install the PostgreSQL client tools and reopen the terminal.'
					)
				);
				return;
			}
			reject(error);
		});
		child.on('exit', code => {
			if (code === 0) {
				resolve(relative);
				return;
			}
			reject(new Error(`pg_dump exited with code ${code}. Nothing was wiped.`));
		});
	});
}
