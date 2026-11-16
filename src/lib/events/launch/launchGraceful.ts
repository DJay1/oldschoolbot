import { formatOrdinal } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import { announceToRareChannel } from '@/lib/bsc/rareAnnouncements.js';
import { LAUNCH_GRACEFUL_PIECES, LaunchItem } from './items.js';

/** One full Launch graceful set for every this many Launch boxes opened. */
export const LAUNCH_GRACEFUL_OPENS_PER_SET = 50;

export const launchGracefulItemIDs: number[] = LAUNCH_GRACEFUL_PIECES.map(([id]) => id);

/** Sets earned from the real opened count (user_stats.openable_scores), never from items held. */
export function launchGracefulSetsEarned(opened: number): number {
	if (!Number.isFinite(opened) || opened <= 0) return 0;
	return Math.floor(opened / LAUNCH_GRACEFUL_OPENS_PER_SET);
}

export function launchGracefulSetsOwed(opened: number, alreadyGranted: number): number {
	return Math.max(0, launchGracefulSetsEarned(opened) - Math.max(0, alreadyGranted));
}

export function launchGracefulBank(sets: number): Bank {
	const bank = new Bank();
	if (sets <= 0) return bank;
	for (const id of launchGracefulItemIDs) bank.add(id, sets);
	return bank;
}

const ready = { done: false };

async function ensureStore() {
	if (ready.done) return;
	await prisma.$executeRawUnsafe(`
		CREATE TABLE IF NOT EXISTS bsc_launch_graceful (
			user_id text PRIMARY KEY,
			sets_granted int NOT NULL DEFAULT 0,
			updated_at timestamptz NOT NULL DEFAULT now()
		)
	`);
	ready.done = true;
}

/** Raises a player's granted count to `earned` if it is lower and returns the old count, or null if it was already there. */
export interface LaunchGracefulStore {
	raise(userID: string, earned: number): Promise<number | null>;
	/** Players given at least one set so far. */
	countRecipients(): Promise<number>;
}

/**
 * The row is locked, so two opens at once (or an open during the startup backfill) can never both grant
 * the same set.
 */
export const dbLaunchGracefulStore: LaunchGracefulStore = {
	async raise(userID, earned) {
		await ensureStore();
		await prisma.$executeRaw`
			INSERT INTO bsc_launch_graceful (user_id, sets_granted) VALUES (${userID}, 0)
			ON CONFLICT (user_id) DO NOTHING
		`;
		const rows = await prisma.$queryRaw<{ old: number }[]>`
			UPDATE bsc_launch_graceful t
			SET sets_granted = ${earned}, updated_at = now()
			FROM (SELECT user_id, sets_granted AS old FROM bsc_launch_graceful WHERE user_id = ${userID} FOR UPDATE) o
			WHERE t.user_id = o.user_id AND o.old < ${earned}
			RETURNING o.old AS old
		`;
		return rows.length === 0 ? null : Number(rows[0].old);
	},
	async countRecipients() {
		await ensureStore();
		const rows = await prisma.$queryRaw<
			{ n: number }[]
		>`SELECT count(*)::int AS n FROM bsc_launch_graceful WHERE sets_granted > 0`;
		return Number(rows[0]?.n ?? 0);
	}
};

/**
 * How many new sets this player gets now. Only the opened count is used, never items held, so trading or
 * dropping sets can't trigger another award.
 */
export async function claimLaunchGracefulSets(
	userID: string,
	opened: number,
	store: LaunchGracefulStore = dbLaunchGracefulStore
): Promise<number> {
	const earned = launchGracefulSetsEarned(opened);
	if (earned <= 0) return 0;
	const old = await store.raise(userID, earned);
	if (old === null) return 0;
	return launchGracefulSetsOwed(opened, old);
}

/** Where a set came from. Only live /open awards are announced; the startup backfill is always silent. */
export type LaunchGracefulSource = 'open' | 'backfill';

type GraceUser = Pick<MUser, 'id' | 'transactItems' | 'notificationName'>;

export interface LaunchGracefulAward {
	items: Bank;
	/** Sets given now. */
	sets: number;
	/** Sets this player has been given in total, including now. */
	totalSets: number;
}

/** Same style as the rare item announcements (e.g. Corgo party hat). One message per award, not per piece. */
export function buildLaunchGracefulAnnouncement(input: {
	notificationName: string;
	sets: number;
	totalSets: number;
	opened: number;
	recipients: number;
}): string {
	const opened = `for opening ${input.opened.toLocaleString()} Launch boxes`;
	if (input.totalSets === input.sets && input.sets === 1) {
		return `${input.notificationName} just received their first **Launch graceful** set ${opened}! They are the ${formatOrdinal(input.recipients)} person to receive one.`;
	}
	if (input.sets === 1) {
		return `${input.notificationName} just received their ${formatOrdinal(input.totalSets)} **Launch graceful** set ${opened}!`;
	}
	return `${input.notificationName} just received ${input.sets} **Launch graceful** sets (${input.totalSets} total) ${opened}!`;
}

export function launchGracefulAnnouncementFor(
	source: LaunchGracefulSource,
	input: Parameters<typeof buildLaunchGracefulAnnouncement>[0]
): string | null {
	if (source !== 'open') return null;
	return buildLaunchGracefulAnnouncement(input);
}

/**
 * Gives any newly earned sets. Returns what was given (also shown in the /open loot image), or null.
 * `send` posts to the rare drop channel and is only used for source 'open'.
 */
export async function grantLaunchGracefulSets(
	user: GraceUser,
	opened: number,
	{
		source,
		store = dbLaunchGracefulStore,
		send = announceToRareChannel
	}: { source: LaunchGracefulSource; store?: LaunchGracefulStore; send?: (content: string) => Promise<void> }
): Promise<LaunchGracefulAward | null> {
	const sets = await claimLaunchGracefulSets(user.id, opened, store);
	if (sets <= 0) return null;
	const items = launchGracefulBank(sets);
	await user.transactItems({ itemsToAdd: items, collectionLog: true });
	const totalSets = launchGracefulSetsEarned(opened);
	if (source === 'open') {
		try {
			const content = launchGracefulAnnouncementFor(source, {
				notificationName: user.notificationName,
				sets,
				totalSets,
				opened,
				recipients: await store.countRecipients()
			});
			if (content) await send(content);
		} catch (err) {
			Logging.logError(err as Error);
		}
	}
	return { items, sets, totalSets };
}

export function launchGracefulMessage(sets: number, opened: number): string {
	return `🎉 You received ${sets}x Launch graceful set${sets === 1 ? '' : 's'} for opening ${opened.toLocaleString()} Launch boxes (1 set every ${LAUNCH_GRACEFUL_OPENS_PER_SET})!`;
}

/** Runs the same claim as /open for every listed player, silently. Safe to rerun: players already paid get nothing. */
export async function backfillLaunchGracefulRows(
	rows: { user_id: string; opened: number }[],
	fetchUser: (id: string) => Promise<GraceUser>,
	store: LaunchGracefulStore = dbLaunchGracefulStore,
	send?: (content: string) => Promise<void>
): Promise<{ users: number; sets: number }> {
	let users = 0;
	let sets = 0;
	for (const row of rows) {
		try {
			const given = await grantLaunchGracefulSets(await fetchUser(row.user_id), Number(row.opened), {
				source: 'backfill',
				store,
				send
			});
			if (given) {
				users++;
				sets += given.sets;
			}
		} catch (err) {
			Logging.logError(err as Error);
		}
	}
	return { users, sets };
}

/**
 * Catch-up for players who opened Launch boxes before this existed. Runs on startup with the real opened
 * counts from user_stats.openable_scores.
 */
export async function backfillLaunchGraceful(): Promise<{ users: number; sets: number }> {
	const key = String(LaunchItem.LAUNCH_BOX);
	const rows = await prisma.$queryRaw<{ user_id: string; opened: number }[]>`
		SELECT user_id::text AS user_id, (openable_scores->>${key})::int AS opened
		FROM user_stats
		WHERE (openable_scores->>${key})::int >= ${LAUNCH_GRACEFUL_OPENS_PER_SET}
	`;
	const result = await backfillLaunchGracefulRows(rows, id => mUserFetch(id));
	if (result.users > 0) {
		Logging.logDebug(`Launch graceful backfill: ${result.sets} sets to ${result.users} players`);
	}
	return result;
}
