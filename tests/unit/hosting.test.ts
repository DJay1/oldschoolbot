import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

import { BitField } from '@/lib/constants.js';
import { isProductionMode, parseProductionFlag } from '@/lib/hosting/productionMode.js';
import {
	backupFileName,
	clientStorageResetColumns,
	clientStorageResetSql,
	connectionStringForPg,
	databaseNameFromUrl,
	KEPT_PERK_BITS,
	keptPerkBits,
	knownTables,
	libpqEnv,
	MAIN_MODELS,
	modelsFor,
	parseWipeArgs,
	pgClientConfig,
	ROBOCHIMP_MODELS,
	robochimpUserResetSql,
	tablesFor,
	truncateSql,
	unexpectedTables,
	wipeConfirmationError
} from '@/lib/hosting/wipePlan.js';

function modelNames(schemaPath: string): string[] {
	const text = readFileSync(schemaPath, 'utf8');
	return [...text.matchAll(/^model (\w+) \{/gm)].map(match => match[1] ?? '');
}

describe('production mode', () => {
	test('PRODUCTION wins over NODE_ENV', () => {
		expect(isProductionMode({ PRODUCTION: 'true', NODE_ENV: 'development' })).toBe(true);
		expect(isProductionMode({ PRODUCTION: 'false', NODE_ENV: 'production' })).toBe(false);
		expect(isProductionMode({ PRODUCTION: '1' })).toBe(true);
		expect(isProductionMode({ PRODUCTION: 'off' })).toBe(false);
	});

	test('a blank PRODUCTION falls back to NODE_ENV', () => {
		expect(parseProductionFlag(undefined)).toBeUndefined();
		expect(parseProductionFlag('  ')).toBeUndefined();
		expect(isProductionMode({ PRODUCTION: '  ', NODE_ENV: 'production' })).toBe(true);
		expect(isProductionMode({ NODE_ENV: 'test' })).toBe(false);
	});

	test('an unknown PRODUCTION value throws', () => {
		expect(() => parseProductionFlag('sometimes')).toThrow(/PRODUCTION must be true or false/);
	});
});

describe('launch wipe classification', () => {
	test('every main prisma model is classified once', () => {
		const schemaModels = modelNames('prisma/schema.prisma').sort();
		const classified = MAIN_MODELS.map(model => model.model).sort();
		expect(classified).toEqual(schemaModels);
		expect(new Set(classified).size).toBe(classified.length);
	});

	test('every robochimp prisma model is classified once', () => {
		const schemaModels = modelNames('prisma/robochimp.prisma').sort();
		const classified = ROBOCHIMP_MODELS.map(model => model.model).sort();
		expect(classified).toEqual(schemaModels);
		expect(new Set(ROBOCHIMP_MODELS.map(model => model.table)).size).toBe(ROBOCHIMP_MODELS.length);
	});

	test('wipe, keep, and reset tables do not overlap, and seasonal config is kept', () => {
		for (const schema of ['main', 'robochimp'] as const) {
			const actions = ['wipe', 'keep', 'reset'] as const;
			const sets = actions.map(
				action =>
					new Set(
						modelsFor(schema)
							.filter(model => model.action === action)
							.map(model => model.table)
					)
			);
			for (let i = 0; i < sets.length; i++) {
				for (let j = i + 1; j < sets.length; j++) {
					for (const table of sets[i] ?? []) {
						expect(sets[j]?.has(table)).toBe(false);
					}
				}
			}
		}
		expect(knownTables('main')).toContain('seasonal_event_config');
		expect(tablesFor('main', 'wipe')).toContain('users');
		expect(tablesFor('main', 'keep')).toContain('guilds');
		expect(tablesFor('main', 'keep')).not.toContain('users');
		expect(tablesFor('main', 'reset')).toContain('clientStorage');
		expect(unexpectedTables(['users', 'guilds', 'made_up'], knownTables('main'))).toEqual(['made_up']);
	});

	test('perk bits are patron tiers, Early Supporter, Launch Founder, and the cosmetic mark', () => {
		expect(KEPT_PERK_BITS).toEqual([
			BitField.PatronTier1,
			BitField.PatronTier2,
			BitField.PatronTier3,
			BitField.PatronTier4,
			BitField.PatronTier5,
			BitField.PatronTier6,
			BitField.BSCEarlySupporter,
			BitField.LaunchFounder,
			BitField.BSCPatronCosmetic
		]);
		expect(BitField.BSCEarlySupporter).toBe(199);
		expect(keptPerkBits([BitField.Moderator, 199, BitField.PatronTier3, BitField.HasHosidiusWallkit])).toEqual([
			199,
			BitField.PatronTier3
		]);
		expect(keptPerkBits([BitField.PermanentIronman])).toEqual([]);
	});

	test('client storage reset leaves config columns alone', () => {
		const columns = [
			'id',
			'disabled_commands',
			'custom_prices',
			'maxing_message',
			'shutdown',
			'grand_exchange_is_locked',
			'gp_sell',
			'prices'
		];
		expect(clientStorageResetColumns(columns)).toEqual(['gp_sell', 'prices']);
		const sql = clientStorageResetSql(columns);
		expect(sql).toContain('"gp_sell" = DEFAULT');
		expect(sql).not.toContain('"disabled_commands"');
		expect(sql?.startsWith('UPDATE "clientStorage" SET ')).toBe(true);
	});

	test('robochimp perk columns stay unless perks are dropped', () => {
		expect(robochimpUserResetSql(true)).not.toContain('"perk_tier"');
		expect(robochimpUserResetSql(true)).toContain('"osb_total_xp" = NULL');
		expect(robochimpUserResetSql(false)).toContain('"perk_tier" = 0');
		expect(robochimpUserResetSql(false)).toContain('"bits" = \'{}\'');
		expect(robochimpUserResetSql(false)).not.toContain('patreon_id');
	});

	test('truncate quotes every wipe table', () => {
		expect(truncateSql(['users', 'activity'])).toBe('TRUNCATE TABLE "users", "activity" RESTART IDENTITY');
	});
});

describe('wipe confirmation and backups', () => {
	const url = 'postgresql://postgres:p%40ss@localhost:5432/bsc_prod?schema=public';

	test('the database name comes from the URL and the confirm string must match it', () => {
		expect(databaseNameFromUrl(url)).toBe('bsc_prod');
		expect(wipeConfirmationError('bsc_prod', undefined)).toMatch(/--confirm-wipe bsc_prod/);
		expect(wipeConfirmationError('bsc_prod', 'bsc_test')).toMatch(/does not match/);
		expect(wipeConfirmationError('bsc_prod', 'bsc_prod')).toBeNull();
	});

	test('pg clients do not receive the prisma schema query parameter', () => {
		expect(connectionStringForPg(url)).toBe('postgresql://postgres:p%40ss@localhost:5432/bsc_prod');
		expect(pgClientConfig(url).connectionString).not.toContain('schema=');
		expect(libpqEnv(url)).toMatchObject({
			PGHOST: 'localhost',
			PGPORT: '5432',
			PGUSER: 'postgres',
			PGPASSWORD: 'p@ss',
			PGDATABASE: 'bsc_prod'
		});
	});

	test('backup file names cannot escape the backups directory', () => {
		expect(backupFileName('bsc_prod', 'pre-wipe', new Date('2026-11-07T23:03:01.000Z'))).toBe(
			'backups/bsc_prod-pre-wipe-20261107T230301Z.dump'
		);
		expect(() => backupFileName('../etc', 'pre-wipe')).toThrow(/file name/);
	});

	test('--keep-perks defaults to keeping perks', () => {
		expect(parseWipeArgs([])).toEqual({ confirm: undefined, keepPerks: true });
		expect(parseWipeArgs(['--confirm-wipe', 'bsc_prod'])).toEqual({ confirm: 'bsc_prod', keepPerks: true });
		expect(parseWipeArgs(['--confirm-wipe=bsc_prod', '--keep-perks'])).toEqual({
			confirm: 'bsc_prod',
			keepPerks: true
		});
		expect(parseWipeArgs(['--confirm-wipe', 'bsc_prod', '--no-keep-perks'])).toEqual({
			confirm: 'bsc_prod',
			keepPerks: false
		});
		expect(parseWipeArgs(['--keep-perks', 'false'])).toEqual({ confirm: undefined, keepPerks: false });
		expect(parseWipeArgs(['--keep-perks=false'])).toEqual({ confirm: undefined, keepPerks: false });
	});
});
