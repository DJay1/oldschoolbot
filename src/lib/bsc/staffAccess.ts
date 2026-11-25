import { addToDoubleLootTimer, DOUBLE_LOOT_FINISH_TIME_CACHE } from '@/lib/bso/doubleLoot.js';
import { addToDoubleXpTimer, DOUBLE_XP_FINISH_TIME_CACHE } from '@/lib/bso/doubleXp.js';

import { time } from '@oldschoolgg/discord';
import { Time } from '@oldschoolgg/toolkit';

import {
	describeStaffAction,
	resolveStaffTier,
	STAFF_BOOST_LABELS,
	STAFF_BOOST_MINUTES,
	STAFF_TIER_NAMES,
	type StaffBoostKind,
	type StaffTier,
	staffBoostWeeklyCap,
	staffWeekKey
} from '@/lib/bsc/staffTiers.js';
import { higherStaffTier, staffTierFromRoleIds } from '@/lib/bsc/staffRoleBits.js';
import { Channel, globalConfig } from '@/lib/constants.js';
import { itemStatusIcon } from '@/lib/util/itemStatusIcon.js';

/** Test bot only: lets DJ try each tier without the prod role sync. Memory only, gone on restart. */
const testTierOverrides = new Map<string, StaffTier>();

export function setTestStaffTierOverride(userId: string, tier: StaffTier | null): boolean {
	if (globalConfig.isProduction) return false;
	if (tier === null) testTierOverrides.delete(userId);
	else testTierOverrides.set(userId, tier);
	return true;
}

export function staffTierOf(user: MUser, roleIds?: readonly string[] | null): StaffTier {
	const fromBits = resolveStaffTier({
		isAdmin: user.isAdmin(),
		isDeveloper: user.isDeveloper(),
		isMod: user.isMod(),
		isProduction: globalConfig.isProduction,
		override: globalConfig.isProduction ? null : (testTierOverrides.get(user.id) ?? null)
	});
	// Role IDs on the slash-command member are a live fallback if the saved flags are briefly out of date.
	// Roles can only raise the tier (Contributor still grants nothing). They never grant admin.
	return higherStaffTier(fromBits, staffTierFromRoleIds(roleIds));
}

/** Same rule as /admin and /rp: the support server only on prod, never in DMs. */
export function staffGuildAllowed(guildId: string | null | undefined): boolean {
	if (!guildId) return false;
	if (globalConfig.isProduction && guildId.toString() !== globalConfig.supportServerID) return false;
	return true;
}

export async function logStaffAction(user: MUser, source: 'admin' | 'rp', options: Record<string, any>) {
	const desc = describeStaffAction(source, options);
	if (!desc) return;
	await globalClient
		.sendMessage(Channel.BotLogs, {
			content: `${user.logName} [${STAFF_TIER_NAMES[staffTierOf(user)]}] used /${source} ${desc}`,
			allowedMentions: { parse: [], users: [], roles: [] }
		})
		.catch(err => Logging.logError(err as Error));
}

const BOOST_TABLE = 'bsc_staff_boosts';
let tableReady: Promise<unknown> | null = null;

function ensureBoostTable() {
	if (!tableReady) {
		tableReady = prisma
			.$executeRawUnsafe(`
				CREATE TABLE IF NOT EXISTS ${BOOST_TABLE} (
					user_id text NOT NULL,
					kind text NOT NULL,
					week text NOT NULL,
					uses integer NOT NULL DEFAULT 0,
					last_used_at timestamptz NOT NULL DEFAULT now(),
					PRIMARY KEY (user_id, kind, week)
				)
			`)
			.catch(err => {
				tableReady = null;
				throw err;
			});
	}
	return tableReady;
}

/** Atomically uses one boost. Returns the new use count, or null if the weekly cap is already reached. */
async function claimBoost(userId: string, kind: StaffBoostKind, week: string, cap: number): Promise<number | null> {
	if (cap < 1) return null;
	await ensureBoostTable();
	const rows = await prisma.$queryRaw<{ uses: number }[]>`
		INSERT INTO bsc_staff_boosts (user_id, kind, week, uses)
		VALUES (${userId}, ${kind}, ${week}, 1)
		ON CONFLICT (user_id, kind, week)
		DO UPDATE SET uses = bsc_staff_boosts.uses + 1, last_used_at = now()
		WHERE bsc_staff_boosts.uses < ${cap}
		RETURNING uses
	`;
	return rows.length > 0 ? Number(rows[0].uses) : null;
}

async function refundBoost(userId: string, kind: StaffBoostKind, week: string) {
	await prisma.$executeRaw`
		UPDATE bsc_staff_boosts SET uses = GREATEST(uses - 1, 0)
		WHERE user_id = ${userId} AND kind = ${kind} AND week = ${week}
	`;
}

export async function staffBoostsUsed(userId: string, now = Date.now()): Promise<Record<StaffBoostKind, number>> {
	await ensureBoostTable();
	const rows = await prisma.$queryRaw<{ kind: string; uses: number }[]>`
		SELECT kind, uses FROM bsc_staff_boosts WHERE user_id = ${userId} AND week = ${staffWeekKey(now)}
	`;
	const used: Record<StaffBoostKind, number> = { loot: 0, xp: 0 };
	for (const r of rows) {
		if (r.kind === 'loot' || r.kind === 'xp') used[r.kind] = Number(r.uses);
	}
	return used;
}

export function staffBoostAnnouncement(name: string, kind: StaffBoostKind, endsAt: number): string {
	const icon = itemStatusIcon(kind === 'loot' ? 'double_loot_token' : 'double_xp_token');
	const label = STAFF_BOOST_LABELS[kind];
	const ends = new Date(endsAt);
	return `${icon}**Staff boost!** ${name} added **${STAFF_BOOST_MINUTES} minutes** of ${label} for everyone. ${label} now ends ${time(ends)} (${time(ends, 'R')}).`;
}

export async function runStaffBoost(
	user: MUser,
	kind: StaffBoostKind,
	roleIds?: readonly string[] | null
): Promise<string> {
	const tier = staffTierOf(user, roleIds);
	const cap = staffBoostWeeklyCap(tier);
	const label = STAFF_BOOST_LABELS[kind];
	if (cap < 1) return 'Only staff can use boosts.';
	const week = staffWeekKey(Date.now());
	const used = await claimBoost(user.id, kind, week, cap);
	if (used === null) {
		return `You've used all ${cap} of your ${label} boosts this week. They reset Monday at 12:00 AM CT.`;
	}
	const remaining = cap - used;
	const amount = Time.Minute * STAFF_BOOST_MINUTES;
	const reason = `${user.usernameOrMention} used a staff boost!`;
	try {
		if (kind === 'loot') await addToDoubleLootTimer(amount, reason);
		else await addToDoubleXpTimer(amount, reason);
	} catch (err) {
		await refundBoost(user.id, kind, week).catch(e => Logging.logError(e as Error));
		throw err;
	}
	const endsAt = kind === 'loot' ? DOUBLE_LOOT_FINISH_TIME_CACHE : DOUBLE_XP_FINISH_TIME_CACHE;
	await globalClient
		.sendMessage(Channel.Notifications, {
			content: staffBoostAnnouncement(user.usernameOrMention, kind, endsAt),
			allowedMentions: { parse: [], users: [], roles: [] }
		})
		.catch(err => Logging.logError(err as Error));
	await globalClient
		.sendMessage(Channel.BotLogs, {
			content: `${user.logName} [${STAFF_TIER_NAMES[tier]}] used a staff boost: +${STAFF_BOOST_MINUTES} min ${label} (${used}/${cap} used this week, ${remaining} left)`,
			allowedMentions: { parse: [], users: [], roles: [] }
		})
		.catch(err => Logging.logError(err as Error));
	return `Added **${STAFF_BOOST_MINUTES} minutes** of ${label} for everyone. You have **${remaining}/${cap}** ${label} boosts left this week.`;
}
