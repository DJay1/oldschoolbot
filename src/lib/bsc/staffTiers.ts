/**
 * Staff tiers for /staff, /admin and /rp. Pure helpers only (no Discord or DB), so they are easy to test.
 *
 * Moderator and Developer come from the account flags that the Los Perros role sync sets on prod.
 * Admin is only the ADMIN_USER_IDS list in the env, never a Discord role.
 * Contributor gets no staff powers.
 */
export type StaffTier = 'none' | 'moderator' | 'developer' | 'admin';

export const STAFF_TIER_RANK: Record<StaffTier, number> = { none: 0, moderator: 1, developer: 2, admin: 3 };

export const STAFF_TIER_NAMES: Record<StaffTier, string> = {
	none: 'Player',
	moderator: 'Moderator',
	developer: 'Developer',
	admin: 'Admin'
};

export function tierAtLeast(tier: StaffTier, min: StaffTier): boolean {
	return STAFF_TIER_RANK[tier] >= STAFF_TIER_RANK[min];
}

export function resolveStaffTier({
	isAdmin,
	isDeveloper,
	isMod,
	isProduction,
	override
}: {
	isAdmin: boolean;
	isDeveloper: boolean;
	isMod: boolean;
	isProduction: boolean;
	override?: StaffTier | null;
}): StaffTier {
	const real: StaffTier = isAdmin ? 'admin' : isDeveloper ? 'developer' : isMod ? 'moderator' : 'none';
	// The test override never works on prod, and it can never make someone an admin.
	if (isProduction || !override) return real;
	if (override === 'admin' && !isAdmin) return 'developer';
	return override;
}

/** Staff boosts: fixed length and weekly uses per kind. */
export const STAFF_BOOST_MINUTES = 30;
export type StaffBoostKind = 'loot' | 'xp';
export const STAFF_BOOST_LABELS: Record<StaffBoostKind, string> = { loot: 'Double Loot', xp: 'Double XP' };

export function staffBoostWeeklyCap(tier: StaffTier): number {
	if (tier === 'admin') return 4;
	if (tier === 'developer' || tier === 'moderator') return 2;
	return 0;
}

/** Week key = the Monday (America/Chicago) the week started on, as YYYY-MM-DD. Resets Monday 12:00 AM CT. */
export function staffWeekKey(now: number): string {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/Chicago',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		weekday: 'short'
	}).formatToParts(new Date(now));
	const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
	const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	const daysSinceMonday = weekdays.indexOf(get('weekday'));
	const day = new Date(Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day'))));
	day.setUTCDate(day.getUTCDate() - Math.max(daysSinceMonday, 0));
	return day.toISOString().slice(0, 10);
}

type Opts = Record<string, any> | null | undefined;

/** Lowest tier allowed to run this /admin call. Anything not listed is Admin only. */
export function adminActionTier(options: Opts): StaffTier {
	if (!options) return 'admin';
	if (options.cancel_task) return 'moderator';
	if (options.testerpoints || options.item_stats || options.fix_giveaways || options.announce) return 'developer';
	if (
		options.leagues &&
		(options.leagues.validate_tasks || options.leagues.verify_tasks) &&
		!options.leagues.cleanup_duplicates
	) {
		return 'developer';
	}
	if (options.event && options.event.action === 'list') return 'developer';
	return 'admin';
}

/** Lowest tier allowed to run this /rp call. Anything not listed is Admin only. */
export function rpActionTier(options: Opts): StaffTier {
	const player = options?.player;
	if (!player || options?.user_event) return 'admin';
	if (player.viewbank || player.viewgear || player.view_user || player.list_trades || player.ge_cancel) {
		const keys = Object.keys(player).filter(k => player[k] !== undefined && player[k] !== null);
		if (keys.length === 1) return 'moderator';
	}
	return 'admin';
}

function who(opt: any): string {
	const u = opt?.user?.user ?? opt?.user;
	if (!u?.id) return 'unknown';
	return `${u.username ?? 'Unknown'}[${u.id}]`;
}

/** BotLogs line for important staff actions run through /admin or /rp (null = not logged here). */
export function describeStaffAction(source: 'admin' | 'rp', options: Opts): string | null {
	if (!options) return null;
	if (source === 'admin') {
		if (options.cancel_task) return `cancel_task on ${who(options.cancel_task)}`;
		if (options.announce) {
			const msg = String(options.announce.message ?? '').replace(/`/g, "'");
			return `announce: ${msg.length > 300 ? `${msg.slice(0, 300)}...` : msg}`;
		}
		if (options.event) return `event ${options.event.action}${options.event.name ? ` ${options.event.name}` : ''}`;
		return null;
	}
	if (options.player?.ge_cancel) return `ge_cancel on ${who(options.player.ge_cancel)}`;
	return null;
}

export type StaffActionInfo = { command: string; minTier: StaffTier; help: string };

/** What /staff help lists. Order matters. */
export const STAFF_ACTIONS: StaffActionInfo[] = [
	{ command: '/staff help', minTier: 'moderator', help: 'Shows this list and your boosts left this week.' },
	{
		command: '/staff tickets',
		minTier: 'moderator',
		help: 'List tickets. Confirm or Ignore new ones in the ticket channel.'
	},
	{
		command: '/staff ticket_file',
		minTier: 'developer',
		help: 'File a ticket for a player (staff only until Confirm).'
	},
	{
		command: '/staff boost type:2x loot',
		minTier: 'moderator',
		help: `Adds ${STAFF_BOOST_MINUTES} min of Double Loot for everyone. Weekly limit.`
	},
	{
		command: '/staff boost type:2x XP',
		minTier: 'moderator',
		help: `Adds ${STAFF_BOOST_MINUTES} min of Double XP for everyone. Weekly limit.`
	},
	{
		command: '/staff view',
		minTier: 'moderator',
		help: "Look at a player's minion stats (including play time), /data stats, bank, collection log, or gear (read only). Everyone in the channel can see the reply."
	},
	{ command: '/staff view_bank', minTier: 'moderator', help: "Look at a player's bank (read only)." },
	{ command: '/staff view_gear', minTier: 'moderator', help: "Look at a player's gear (read only)." },
	{ command: '/staff view_user', minTier: 'moderator', help: "Look at a player's account info (read only)." },
	{ command: '/staff list_trades', minTier: 'moderator', help: "List a player's recent trades (read only)." },
	{
		command: '/staff ge_cancel',
		minTier: 'moderator',
		help: "Cancel all of a player's GE listings. Their items or GP go back to them. Logged."
	},
	{
		command: '/staff cancel_task',
		minTier: 'moderator',
		help: "Cancel a player's stuck trip. No loot is given. Logged."
	},
	{
		command: '/staff tester_points give|take',
		minTier: 'developer',
		help: 'Give or take tester points, with a reason. Logged.'
	},
	{ command: '/staff item_stats', minTier: 'developer', help: 'Show how many of an item exist in total.' },
	{
		command: '/staff fix_giveaways',
		minTier: 'developer',
		help: 'Put the buttons back on running giveaways. Never returns items.'
	},
	{
		command: '/staff leagues validate_tasks|verify_tasks',
		minTier: 'developer',
		help: 'Check and repair leagues task data.'
	},
	{
		command: '/staff announce',
		minTier: 'developer',
		help: 'Post a message in the notifications channel. It cannot ping roles or everyone. Logged.'
	},
	{ command: '/staff event_list', minTier: 'developer', help: 'List seasonal events and whether they are on.' },
	{
		command: '/admin and /rp',
		minTier: 'admin',
		help: 'Everything else (give, giveaways, prices, events on/off, bitfields, patron, and more).'
	}
];

export function staffActionsFor(tier: StaffTier): StaffActionInfo[] {
	if (tier === 'none') return [];
	return STAFF_ACTIONS.filter(a => tierAtLeast(tier, a.minTier));
}
