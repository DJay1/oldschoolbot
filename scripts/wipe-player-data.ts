import { Client } from 'pg';

import {
	clientStorageResetSql,
	databaseNameFromUrl,
	keptPerkBits,
	knownTables,
	modelsFor,
	parseWipeArgs,
	pgClientConfig,
	quoteIdent,
	robochimpUserResetSql,
	STORE_CODE_RESET_SQL,
	tablesFor,
	truncateSql,
	unexpectedTables,
	wipeConfirmationError
} from '@/lib/hosting/wipePlan.js';
import { dumpDatabase } from './pgDump.js';

interface TableCount {
	table: string;
	rows: number;
}

async function listTables(client: Client): Promise<string[]> {
	const result = await client.query<{ tablename: string }>(
		"SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
	);
	return result.rows.map(row => row.tablename);
}

async function countRows(client: Client, table: string): Promise<number> {
	const result = await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${quoteIdent(table)}`);
	return result.rows[0]?.n ?? 0;
}

async function columnNames(client: Client, table: string): Promise<string[]> {
	const result = await client.query<{ column_name: string }>(
		`SELECT column_name FROM information_schema.columns
		 WHERE table_schema = 'public' AND table_name = $1
		 ORDER BY ordinal_position`,
		[table]
	);
	return result.rows.map(row => row.column_name);
}

function printClassified(title: string, names: readonly string[]) {
	console.log(`${title} (${names.length})`);
	for (const name of names) console.log(`  ${name}`);
}

async function wipeMain(client: Client, keepPerks: boolean) {
	const live = new Set(await listTables(client));
	const wipeTables = tablesFor('main', 'wipe').filter(table => live.has(table));
	const missing = tablesFor('main', 'wipe').filter(table => !live.has(table));
	const counts: TableCount[] = [];
	for (const table of wipeTables) {
		counts.push({ table, rows: await countRows(client, table) });
	}

	const perkRows: { id: string; bitfield: number[] }[] = [];
	if (keepPerks && live.has('users')) {
		const users = await client.query<{ id: string; bitfield: number[] | null }>('SELECT id, bitfield FROM users');
		for (const user of users.rows) {
			const bits = keptPerkBits(user.bitfield ?? []);
			if (bits.length > 0) perkRows.push({ id: user.id, bitfield: bits });
		}
	}

	await client.query('BEGIN');
	try {
		if (wipeTables.length > 0) {
			await client.query(truncateSql(wipeTables));
		}
		for (const row of perkRows) {
			await client.query('INSERT INTO users (id, bitfield) VALUES ($1, $2::int[])', [row.id, row.bitfield]);
		}
		let storageSql: string | null = null;
		if (live.has('clientStorage')) {
			storageSql = clientStorageResetSql(await columnNames(client, 'clientStorage'));
			if (storageSql) await client.query(storageSql);
		}
		await client.query('COMMIT');
		return { counts, missing, perkRows: perkRows.length, storageReset: Boolean(storageSql) };
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	}
}

async function resetRobochimp(connectionString: string, keepPerks: boolean) {
	const client = new Client(pgClientConfig(connectionString));
	await client.connect();
	try {
		const live = await listTables(client);
		const unknown = unexpectedTables(live, knownTables('robochimp'));
		if (unknown.length > 0) {
			throw new Error(`Refusing to touch Robochimp. Unclassified tables: ${unknown.join(', ')}`);
		}
		const present = new Set(live);
		await client.query('BEGIN');
		try {
			if (present.has('user')) await client.query(robochimpUserResetSql(keepPerks));
			if (present.has('store_code')) await client.query(STORE_CODE_RESET_SQL);
			await client.query('COMMIT');
		} catch (error) {
			await client.query('ROLLBACK');
			throw error;
		}
	} finally {
		await client.end();
	}
}

async function main() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error('DATABASE_URL is not set. Run this through pnpm wipe:prod so .env.production is loaded.');
	}
	const databaseName = databaseNameFromUrl(databaseUrl);
	const args = parseWipeArgs(process.argv.slice(2));
	const confirmation = wipeConfirmationError(databaseName, args.confirm);
	if (confirmation) throw new Error(confirmation);

	const client = new Client(pgClientConfig(databaseUrl));
	await client.connect();
	const backups: string[] = [];
	let mainWiped = false;
	try {
		const live = await listTables(client);
		const unknown = unexpectedTables(live, knownTables('main'));
		if (unknown.length > 0) {
			throw new Error(
				`Refusing to wipe. These public tables are not classified as wipe or keep: ${unknown.join(', ')}. Add them to src/lib/hosting/wipePlan.ts first.`
			);
		}

		const roboUrl = process.env.ROBOCHIMP_DATABASE_URL;
		let roboName: string | null = null;
		if (roboUrl) {
			roboName = databaseNameFromUrl(roboUrl);
			const robo = new Client(pgClientConfig(roboUrl));
			await robo.connect();
			try {
				const roboLive = await listTables(robo);
				const roboUnknown = unexpectedTables(roboLive, knownTables('robochimp'));
				if (roboUnknown.length > 0) {
					throw new Error(`Refusing to wipe. Unclassified Robochimp tables: ${roboUnknown.join(', ')}.`);
				}
			} finally {
				await robo.end();
			}
		}

		console.log(`Backing up ${databaseName} before the wipe.`);
		backups.push(await dumpDatabase(databaseUrl, databaseName, 'pre-wipe'));
		if (roboUrl && roboName) {
			console.log(`Backing up ${roboName} before the wipe.`);
			backups.push(await dumpDatabase(roboUrl, roboName, 'pre-wipe'));
		}

		const result = await wipeMain(client, args.keepPerks);
		mainWiped = true;
		if (roboUrl) {
			await resetRobochimp(roboUrl, args.keepPerks);
		}

		console.log('');
		console.log(`Wipe finished for ${databaseName}.`);
		console.log(`Keep perks: ${args.keepPerks ? 'yes (default)' : 'no'}`);
		console.log(`Backups:`);
		for (const file of backups) console.log(`  ${file}`);
		console.log('Rows removed:');
		for (const count of result.counts) console.log(`  ${count.table}: ${count.rows}`);
		if (result.missing.length > 0) {
			console.log(`Wipe tables not in this database (skipped): ${result.missing.join(', ')}`);
		}
		console.log(`Users reinserted with patron or Early Supporter bits: ${result.perkRows}`);
		console.log(`ClientStorage economy columns reset: ${result.storageReset ? 'yes' : 'no'}`);
		if (roboUrl) {
			console.log(
				`Robochimp progress columns reset. Perk tier and bits ${args.keepPerks ? 'kept' : 'cleared'}. patreon_id and github_id kept.`
			);
		} else {
			console.log('ROBOCHIMP_DATABASE_URL is not set. Robochimp was not touched.');
		}
		printClassified(
			'Kept',
			modelsFor('main')
				.filter(model => model.action !== 'wipe')
				.map(model => `${model.table} (${model.action})`)
		);
	} catch (error) {
		if (!mainWiped) {
			console.error('Wipe aborted. Player tables were not changed.');
		} else {
			console.error(
				'The game database was wiped, then a later step failed. Restore from the backup if you need to undo it.'
			);
			for (const file of backups) console.error(`  ${file}`);
		}
		throw error;
	} finally {
		await client.end();
	}
}

try {
	await main();
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
}
