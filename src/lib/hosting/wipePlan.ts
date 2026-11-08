/**
 * Launch wipe: which database tables are player progress, and which are configuration.
 * The owner script in scripts/wipe-player-data.ts is the only caller. There is no slash command.
 *
 * `reset` keeps the rows and writes progress columns back to empty defaults.
 * Patron tier bits, BSC Early Supporter (199), Launch Founder (237), and the supporter cosmetic (239)
 * are not columns. They live inside users.bitfield and are copied onto fresh user rows when
 * --keep-perks is set (the default).
 */

export type WipeAction = 'wipe' | 'keep' | 'reset';
export type WipeSchema = 'main' | 'robochimp';

export interface ClassifiedModel {
	schema: WipeSchema;
	model: string;
	table: string;
	action: WipeAction;
	reason: string;
}

/** Patron tiers, Early Supporter, Launch Founder, and the monthly cosmetic mark. Other bits are cleared. */
export const KEPT_PERK_BITS = [2, 3, 4, 5, 6, 21, 199, 237, 239] as const;

export const CLIENT_STORAGE_KEEP_COLUMNS = [
	'id',
	'disabled_commands',
	'custom_prices',
	'maxing_message',
	'shutdown',
	'grand_exchange_is_locked'
] as const;

/** Created by SQL at startup, not a Prisma model. Guild settings for seasonal events. */
export const NON_PRISMA_KEEP_TABLES = ['seasonal_event_config', 'bsc_patron_override', '_prisma_migrations'] as const;

export const MAIN_MODELS: readonly ClassifiedModel[] = [
	{
		schema: 'main',
		model: 'Activity',
		table: 'activity',
		action: 'wipe',
		reason: 'Trips in progress and trip history'
	},
	{
		schema: 'main',
		model: 'Analytic',
		table: 'analytics_table',
		action: 'wipe',
		reason: 'Economy and population snapshots'
	},
	{
		schema: 'main',
		model: 'ClientStorage',
		table: 'clientStorage',
		action: 'reset',
		reason: 'Keep the row and its config columns. Zero economy banks, GP counters, prices, and lottery state'
	},
	{
		schema: 'main',
		model: 'BuyCommandTransaction',
		table: 'buy_command_transaction',
		action: 'wipe',
		reason: 'Shop purchases'
	},
	{ schema: 'main', model: 'GearPreset', table: 'gear_presets', action: 'wipe', reason: 'Saved gear presets' },
	{ schema: 'main', model: 'Giveaway', table: 'giveaway', action: 'wipe', reason: 'Giveaways and entries' },
	{
		schema: 'main',
		model: 'Guild',
		table: 'guilds',
		action: 'keep',
		reason: 'Per-server settings: disabled commands, pet channel, staff channels, mega duck location'
	},
	{ schema: 'main', model: 'PlayerOwnedHouse', table: 'poh', action: 'wipe', reason: 'Player-owned houses' },
	{ schema: 'main', model: 'SlayerTask', table: 'slayer_tasks', action: 'wipe', reason: 'Slayer tasks' },
	{
		schema: 'main',
		model: 'User',
		table: 'users',
		action: 'wipe',
		reason: 'Accounts, minions, banks, GP, skills, CL, cooldowns, and bitfield. Perk bits are reinserted when --keep-perks is set'
	},
	{
		schema: 'main',
		model: 'MortimerTricks',
		table: 'mortimer_trick',
		action: 'wipe',
		reason: 'Mortimer trick progress'
	},
	{
		schema: 'main',
		model: 'ReclaimableItem',
		table: 'reclaimable_item',
		action: 'wipe',
		reason: 'Reclaimable item claims'
	},
	{
		schema: 'main',
		model: 'Webhook',
		table: 'webhook_table',
		action: 'keep',
		reason: 'Discord webhooks the bot created for channels. Not player progress'
	},
	{ schema: 'main', model: 'XPGain', table: 'xp_gains', action: 'wipe', reason: 'XP gain history' },
	{ schema: 'main', model: 'Metric', table: 'metrics', action: 'wipe', reason: 'Process stats samples' },
	{ schema: 'main', model: 'Minigame', table: 'minigames', action: 'wipe', reason: 'Minigame points and counts' },
	{
		schema: 'main',
		model: 'BossEvent',
		table: 'boss_event',
		action: 'wipe',
		reason: 'Live boss-event state, not seasonal config'
	},
	{ schema: 'main', model: 'TameActivity', table: 'tame_activity', action: 'wipe', reason: 'Tame trips' },
	{ schema: 'main', model: 'Tame', table: 'tames', action: 'wipe', reason: 'Tames' },
	{ schema: 'main', model: 'CommandUsage', table: 'command_usage', action: 'wipe', reason: 'Command usage stats' },
	{
		schema: 'main',
		model: 'FishingContestCatch',
		table: 'fishing_contest_catch',
		action: 'wipe',
		reason: 'Fishing contest catches'
	},
	{ schema: 'main', model: 'LootTrack', table: 'loot_track', action: 'wipe', reason: 'Loot tracking' },
	{ schema: 'main', model: 'EconomyItem', table: 'economy_item', action: 'wipe', reason: 'Economy item totals' },
	{
		schema: 'main',
		model: 'EconomyItemBanks',
		table: 'economy_item_banks',
		action: 'wipe',
		reason: 'Economy item banks'
	},
	{ schema: 'main', model: 'LastManStandingGame', table: 'lms_games', action: 'wipe', reason: 'LMS games' },
	{
		schema: 'main',
		model: 'EconomyTransaction',
		table: 'economy_transaction',
		action: 'wipe',
		reason: 'Trades, gifts, dues, and other transfers'
	},
	{ schema: 'main', model: 'StashUnit', table: 'stash_unit', action: 'wipe', reason: 'STASH units' },
	{
		schema: 'main',
		model: 'UserStats',
		table: 'user_stats',
		action: 'wipe',
		reason: 'KC, collection log, and other stats'
	},
	{ schema: 'main', model: 'FarmedCrop', table: 'farmed_crop', action: 'wipe', reason: 'Farming patches planted' },
	{ schema: 'main', model: 'BotItemSell', table: 'bot_item_sell', action: 'wipe', reason: 'Item sales to the bot' },
	{ schema: 'main', model: 'PinnedTrip', table: 'pinned_trip', action: 'wipe', reason: 'Pinned trips' },
	{
		schema: 'main',
		model: 'HistoricalData',
		table: 'historical_data',
		action: 'wipe',
		reason: 'Historical XP, GP, and CL snapshots'
	},
	{ schema: 'main', model: 'GEListing', table: 'ge_listing', action: 'wipe', reason: 'Grand Exchange listings' },
	{
		schema: 'main',
		model: 'GETransaction',
		table: 'ge_transaction',
		action: 'wipe',
		reason: 'Grand Exchange trades'
	},
	{ schema: 'main', model: 'GEBank', table: 'ge_bank', action: 'wipe', reason: 'Grand Exchange bank' },
	{ schema: 'main', model: 'Bingo', table: 'bingo', action: 'wipe', reason: 'Bingos' },
	{ schema: 'main', model: 'BingoTeam', table: 'bingo_team', action: 'wipe', reason: 'Bingo teams' },
	{
		schema: 'main',
		model: 'BingoParticipant',
		table: 'bingo_participant',
		action: 'wipe',
		reason: 'Bingo participants'
	},
	{ schema: 'main', model: 'GiftBox', table: 'gift_box', action: 'wipe', reason: 'Gift boxes' },
	{ schema: 'main', model: 'Portent', table: 'portent', action: 'wipe', reason: 'Portent charges' },
	{
		schema: 'main',
		model: 'UserEvent',
		table: 'user_event',
		action: 'wipe',
		reason: 'Max and collection-log events'
	},
	{ schema: 'main', model: 'Badges', table: 'badges', action: 'keep', reason: 'Static badge text catalog' },
	{
		schema: 'main',
		model: 'CLCategory',
		table: 'categories',
		action: 'keep',
		reason: 'Static collection-log categories'
	},
	{
		schema: 'main',
		model: 'CLCategoryItem',
		table: 'category_items',
		action: 'keep',
		reason: 'Static collection-log category items'
	},
	{ schema: 'main', model: 'UserCounter', table: 'user_counter', action: 'wipe', reason: 'Per-user counters' },
	{ schema: 'main', model: 'TableBank', table: 'table_bank', action: 'wipe', reason: 'Relational banks' },
	{
		schema: 'main',
		model: 'TableBankItem',
		table: 'table_bank_item',
		action: 'wipe',
		reason: 'Relational bank items'
	},
	{
		schema: 'main',
		model: 'HalloweenEvent',
		table: 'halloween_event',
		action: 'wipe',
		reason: 'Per-user Halloween candy. Seasonal on/off config is seasonal_event_config and is kept'
	},
	{
		schema: 'main',
		model: 'JsonBank',
		table: 'json_bank',
		action: 'wipe',
		reason: 'JSON banks, KC, and collection log'
	},
	{ schema: 'main', model: 'ShootingStars', table: 'shooting_stars', action: 'wipe', reason: 'Shooting stars' },
	{
		schema: 'main',
		model: 'SystemLogs',
		table: 'system_logs',
		action: 'wipe',
		reason: 'Runtime error log, not configuration'
	},
	{ schema: 'main', model: 'UserLog', table: 'user_logs', action: 'wipe', reason: 'User action log' },
	{
		schema: 'main',
		model: 'QualityCheckCampaign',
		table: 'quality_check_campaign',
		action: 'keep',
		reason: 'Quality-check board campaign. Staff workflow, not a player save'
	},
	{
		schema: 'main',
		model: 'QualityCheckBounty',
		table: 'quality_check_bounty',
		action: 'keep',
		reason: 'Quality-check bounties. Staff workflow, not a player save'
	}
];

export const ROBOCHIMP_MODELS: readonly ClassifiedModel[] = [
	{
		schema: 'robochimp',
		model: 'TriviaQuestion',
		table: 'trivia_question',
		action: 'keep',
		reason: 'Trivia question catalog'
	},
	{
		schema: 'robochimp',
		model: 'BlacklistedEntity',
		table: 'blacklisted_entity',
		action: 'keep',
		reason: 'Blacklist of users and guilds'
	},
	{
		schema: 'robochimp',
		model: 'User',
		table: 'user',
		action: 'reset',
		reason: 'Clear cached XP, CL, mastery, leagues, store bits, and testing points. Keep the user id, Patreon link, and GitHub link. Perk tier and bits stay unless --no-keep-perks'
	},
	{
		schema: 'robochimp',
		model: 'PingableRole',
		table: 'pingable_role',
		action: 'keep',
		reason: 'Pingable role config'
	},
	{ schema: 'robochimp', model: 'Tag', table: 'tag', action: 'keep', reason: 'Support tags' },
	{
		schema: 'robochimp',
		model: 'StoreCode',
		table: 'store_code',
		action: 'reset',
		reason: 'Keep the codes. Clear who redeemed them so the launch economy does not inherit redemptions'
	},
	{ schema: 'robochimp', model: 'UserGroup', table: 'user_group', action: 'keep', reason: 'Account link groups' },
	{
		schema: 'robochimp',
		model: 'UserSecrets',
		table: 'user_secrets',
		action: 'keep',
		reason: 'OAuth secrets, not game progress'
	},
	{
		schema: 'robochimp',
		model: 'DiscordUser',
		table: 'discord_user',
		action: 'keep',
		reason: 'Discord profile cache'
	}
];

/** Robochimp columns that mirror player progress. Values are SQL literals, not user input. */
export const ROBOCHIMP_PROGRESS_RESETS: Readonly<Record<string, string>> = {
	leagues_completed_tasks_ids: "'{}'",
	leagues_points_balance_osb: '0',
	leagues_points_balance_bso: '0',
	leagues_points_total: '0',
	osb_total_level: 'NULL',
	bso_total_level: 'NULL',
	osb_total_xp: 'NULL',
	bso_total_xp: 'NULL',
	osb_cl_percent: 'NULL',
	bso_cl_percent: 'NULL',
	osb_mastery: 'NULL',
	bso_mastery: 'NULL',
	store_bitfield: "'{}'",
	testing_points: '0',
	testing_points_balance: '0'
};

/** Cleared only with --no-keep-perks. patreon_id and github_id are identity links and always stay. */
export const ROBOCHIMP_PERK_RESETS: Readonly<Record<string, string>> = {
	bits: "'{}'",
	perk_tier: '0',
	premium_balance_tier: 'NULL',
	premium_balance_expiry_date: 'NULL',
	last_patreon_gift: 'NULL'
};

export const STORE_CODE_RESET_SQL = 'UPDATE "store_code" SET "redeemed_at" = NULL, "redeemed_by_user_id" = NULL';

export function modelsFor(schema: WipeSchema): readonly ClassifiedModel[] {
	return schema === 'main' ? MAIN_MODELS : ROBOCHIMP_MODELS;
}

export function tablesFor(schema: WipeSchema, action: WipeAction): string[] {
	return modelsFor(schema)
		.filter(model => model.action === action)
		.map(model => model.table);
}

export function knownTables(schema: WipeSchema): string[] {
	const tables = modelsFor(schema).map(model => model.table);
	if (schema === 'main') tables.push(...NON_PRISMA_KEEP_TABLES);
	return tables;
}

export function unexpectedTables(live: readonly string[], known: readonly string[]): string[] {
	const allowed = new Set(known);
	return live.filter(name => !allowed.has(name));
}

export function quoteIdent(name: string): string {
	if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(name)) {
		throw new Error(`Refusing unsafe SQL identifier: ${name}`);
	}
	return `"${name}"`;
}

export function truncateSql(tables: readonly string[]): string {
	if (tables.length === 0) throw new Error('No tables to truncate');
	return `TRUNCATE TABLE ${tables.map(quoteIdent).join(', ')} RESTART IDENTITY`;
}

export function clientStorageResetColumns(columnNames: readonly string[]): string[] {
	const keep = new Set<string>(CLIENT_STORAGE_KEEP_COLUMNS);
	return columnNames.filter(column => !keep.has(column));
}

export function clientStorageResetSql(columnNames: readonly string[]): string | null {
	const assignments = clientStorageResetColumns(columnNames).map(column => `${quoteIdent(column)} = DEFAULT`);
	if (assignments.length === 0) return null;
	return `UPDATE ${quoteIdent('clientStorage')} SET ${assignments.join(', ')}`;
}

export function robochimpUserResetSql(keepPerks: boolean): string {
	const resets = keepPerks ? ROBOCHIMP_PROGRESS_RESETS : { ...ROBOCHIMP_PROGRESS_RESETS, ...ROBOCHIMP_PERK_RESETS };
	const assignments = Object.entries(resets).map(([column, value]) => `${quoteIdent(column)} = ${value}`);
	return `UPDATE ${quoteIdent('user')} SET ${assignments.join(', ')}`;
}

export function keptPerkBits(bitfield: readonly number[]): number[] {
	const keep = new Set<number>(KEPT_PERK_BITS);
	return bitfield.filter(bit => keep.has(bit));
}

export function databaseNameFromUrl(connectionString: string): string {
	let url: URL;
	try {
		url = new URL(connectionString);
	} catch {
		throw new Error('Database URL is not a valid postgres URL');
	}
	const name = decodeURIComponent(url.pathname.replace(/^\//, ''));
	if (!name) throw new Error('Database URL is missing a database name');
	return name;
}

export function connectionStringForPg(connectionString: string): string {
	const stripped = connectionString.split('?')[0];
	if (!stripped) throw new Error('Database URL is empty');
	return stripped;
}

export function pgClientConfig(connectionString: string): {
	connectionString: string;
	ssl?: { rejectUnauthorized: boolean };
} {
	const url = new URL(connectionString);
	const sslmode = url.searchParams.get('sslmode');
	const config: { connectionString: string; ssl?: { rejectUnauthorized: boolean } } = {
		connectionString: connectionStringForPg(connectionString)
	};
	if (sslmode === 'require' || sslmode === 'prefer') {
		config.ssl = { rejectUnauthorized: false };
	} else if (sslmode === 'verify-ca' || sslmode === 'verify-full') {
		config.ssl = { rejectUnauthorized: true };
	}
	return config;
}

function decodeUserinfo(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

export function libpqEnv(connectionString: string): Record<string, string> {
	const url = new URL(connectionString);
	const env: Record<string, string> = {
		PGHOST: url.hostname,
		PGPORT: url.port || '5432',
		PGUSER: decodeUserinfo(url.username),
		PGPASSWORD: decodeUserinfo(url.password),
		PGDATABASE: databaseNameFromUrl(connectionString)
	};
	const sslmode = url.searchParams.get('sslmode');
	if (sslmode) env.PGSSLMODE = sslmode;
	return env;
}

export function backupFileName(databaseName: string, label: string, when = new Date()): string {
	if (!/^[A-Za-z0-9_-]+$/.test(databaseName)) {
		throw new Error(`Database name ${databaseName} cannot be used in a backup file name`);
	}
	if (!/^[A-Za-z0-9_-]+$/.test(label)) {
		throw new Error(`Backup label ${label} is not safe for a file name`);
	}
	const stamp = when
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}Z$/, 'Z');
	return `backups/${databaseName}-${label}-${stamp}.dump`;
}

export interface WipeArgs {
	confirm: string | undefined;
	keepPerks: boolean;
}

export function parseWipeArgs(argv: readonly string[]): WipeArgs {
	let confirm: string | undefined;
	let keepPerks = true;
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--confirm-wipe') {
			confirm = argv[i + 1];
			i++;
			continue;
		}
		if (arg?.startsWith('--confirm-wipe=')) {
			confirm = arg.slice('--confirm-wipe='.length);
			continue;
		}
		if (arg === '--no-keep-perks' || arg === '--keep-perks=false') {
			keepPerks = false;
			continue;
		}
		if (arg === '--keep-perks=true') {
			keepPerks = true;
			continue;
		}
		if (arg === '--keep-perks') {
			const next = argv[i + 1];
			if (next === 'false' || next === '0') {
				keepPerks = false;
				i++;
			} else if (next === 'true' || next === '1') {
				keepPerks = true;
				i++;
			}
		}
	}
	return { confirm, keepPerks };
}

export function wipeConfirmationError(databaseName: string, confirm: string | undefined): string | null {
	if (!confirm) {
		return `Refusing to wipe ${databaseName}. Re-run with --confirm-wipe ${databaseName}`;
	}
	if (confirm !== databaseName) {
		return `Refusing to wipe ${databaseName}. --confirm-wipe ${confirm} does not match that database name.`;
	}
	return null;
}
