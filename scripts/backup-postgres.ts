import { databaseNameFromUrl } from '@/lib/hosting/wipePlan.js';
import { dumpDatabase } from './pgDump.js';

const targets = [
	['DATABASE_URL', process.env.DATABASE_URL],
	['ROBOCHIMP_DATABASE_URL', process.env.ROBOCHIMP_DATABASE_URL]
] as const;

let failed = false;
for (const [name, connectionString] of targets) {
	if (!connectionString) {
		console.log(`${name} is not set. Skipped.`);
		continue;
	}
	const databaseName = databaseNameFromUrl(connectionString);
	try {
		const file = await dumpDatabase(connectionString, databaseName, 'nightly');
		console.log(`${name} ${databaseName} -> ${file}`);
	} catch (error) {
		failed = true;
		console.error(error instanceof Error ? error.message : error);
	}
}

if (failed) process.exitCode = 1;
