import { type Bank, Items } from 'oldschooljs';

import { announceToRareChannel } from '@/lib/bsc/rareAnnouncements.js';
import {
	badLuckText,
	findBadLuckDrops,
	MAX_SHARED_FIRST_NAMES,
	planScan,
	type ScanRow,
	serverFirstBossText,
	serverFirstItemText,
	serverFirstLogText
} from '@/lib/bsc/serverFirstsCore.js';
import { allCLItems } from '@/lib/data/Collections.js';
import { isThanksgivingActive, thanksgivingCL, thanksgivingCodeEnabled } from '@/lib/events/thanksgiving/core.js';
import { ThanksgivingItem } from '@/lib/events/thanksgiving/items.js';
import { effectiveMonsters } from '@/lib/minions/data/killableMonsters/index.js';
import type { KillableMonster } from '@/lib/minions/types.js';

/**
 * Server firsts (first kill of each boss, Straw Hat Harvest firsts) and bad luck drops, posted to the rare drop
 * channel. Never changes loot, KC or trips: firsts are found by a ticker that only reads stats, and bad luck runs
 * after a trip's items are already saved. Every send is fire-and-forget and catches its own errors.
 *
 * Each first is claimed once in bsc_server_firsts (PRIMARY KEY kind + key, INSERT ... ON CONFLICT DO NOTHING), so
 * two scans or two processes can never announce the same first twice. The first scan of each scope claims everything
 * that already exists without posting ("seeding"), so only firsts that happen after this shipped are announced.
 *
 * TODO(weekly-recap): a weekly recap post can read bsc_server_firsts (claimed_at in the last 7 days, seeded = false)
 * for its "Server firsts" section. Not built yet; waiting on the approved sample format.
 */

const TABLE = 'bsc_server_firsts';
export const BOSS_KIND = 'boss_kc';
export const THANKSGIVING_KIND = 'event_thanksgiving';

const ready = { done: false };

async function ensureTable() {
	if (ready.done) return;
	await prisma.$executeRawUnsafe(`
		CREATE TABLE IF NOT EXISTS ${TABLE} (
			kind text NOT NULL,
			key text NOT NULL,
			user_ids text[] NOT NULL DEFAULT '{}',
			seeded boolean NOT NULL DEFAULT false,
			claimed_at timestamptz NOT NULL DEFAULT now(),
			PRIMARY KEY (kind, key)
		)
	`);
	ready.done = true;
}

const seedMarker = (kind: string) => `seeded:${kind}`;

async function isSeeded(kind: string): Promise<boolean> {
	const rows = await prisma.$queryRaw<{ key: string }[]>`
		SELECT key FROM bsc_server_firsts WHERE kind = 'meta' AND key = ${seedMarker(kind)}
	`;
	return rows.length > 0;
}

async function claimedKeys(kind: string): Promise<Set<string>> {
	const rows = await prisma.$queryRaw<{ key: string }[]>`SELECT key FROM bsc_server_firsts WHERE kind = ${kind}`;
	return new Set(rows.map(r => r.key));
}

async function seed(kind: string, keys: string[]) {
	if (keys.length > 0) {
		await prisma.$executeRaw`
			INSERT INTO bsc_server_firsts (kind, key, seeded)
			SELECT ${kind}, k, true FROM unnest(${keys}::text[]) AS k
			ON CONFLICT DO NOTHING
		`;
	}
	await prisma.$executeRaw`
		INSERT INTO bsc_server_firsts (kind, key, seeded) VALUES ('meta', ${seedMarker(kind)}, true)
		ON CONFLICT DO NOTHING
	`;
}

/** True only for the one caller that inserted the row. */
async function claim(kind: string, key: string, userIDs: string[]): Promise<boolean> {
	const rows = await prisma.$queryRaw<{ key: string }[]>`
		INSERT INTO bsc_server_firsts (kind, key, user_ids, seeded) VALUES (${kind}, ${key}, ${userIDs}::text[], false)
		ON CONFLICT DO NOTHING
		RETURNING key
	`;
	return rows.length > 0;
}

async function namesFor(userIDs: string[]): Promise<string[]> {
	const names: string[] = [];
	for (const id of userIDs) {
		try {
			const user = await mUserFetch(id);
			names.push(user.usernameOrMention);
		} catch {
			names.push(`<@${id}>`);
		}
	}
	return names;
}

async function runScope({
	kind,
	rows,
	canAnnounce,
	text
}: {
	kind: string;
	rows: ScanRow[];
	canAnnounce: (key: string) => boolean;
	text: (key: string, names: string[]) => string;
}) {
	const seeded = await isSeeded(kind);
	for (const action of planScan({ seeded, rows, canAnnounce })) {
		if (action.type === 'seed') {
			await seed(kind, action.keys);
			continue;
		}
		const won = await claim(kind, action.key, action.userIDs.slice(0, MAX_SHARED_FIRST_NAMES));
		if (!won || !action.announce) continue;
		try {
			await announceToRareChannel(text(action.key, await namesFor(action.userIDs)));
		} catch (err) {
			Logging.logError(err as Error);
		}
	}
}

const monsterNames = new Map<string, string>(effectiveMonsters.map(m => [m.id.toString(), m.name]));

async function scanBossKills() {
	const claimed = await claimedKeys(BOSS_KIND);
	const rows = await prisma.$queryRawUnsafe<{ key: string; user_ids: string[] }[]>(`
		SELECT k.key, (array_agg(s.user_id::text ORDER BY s.user_id))[1:${MAX_SHARED_FIRST_NAMES + 1}] AS user_ids
		FROM user_stats s
		CROSS JOIN LATERAL jsonb_each_text(s.monster_scores::jsonb) AS k
		WHERE k.value ~ '^[0-9]+$' AND k.value::bigint > 0
		GROUP BY k.key
	`);
	await runScope({
		kind: BOSS_KIND,
		rows: rows.filter(r => !claimed.has(r.key)).map(r => ({ key: r.key, userIDs: r.user_ids ?? [] })),
		canAnnounce: key => monsterNames.has(key),
		text: (key, names) => serverFirstBossText(names, monsterNames.get(key)!)
	});
}

/** Straw Hat Harvest firsts: item keys are "item:<id>", the full log is "cl:complete". */
export const THANKSGIVING_FIRST_ITEMS: number[] = [
	ThanksgivingItem.BOUNTIFUL_CORNUCOPIA,
	ThanksgivingItem.GOBBLES,
	ThanksgivingItem.GOBBLE_GOBBLE,
	ThanksgivingItem.LABOON,
	ThanksgivingItem.LABOON_STRAW_HAT
];
const CL_COMPLETE_KEY = 'cl:complete';
export const THANKSGIVING_LOG_NAME = 'The Straw Hat Harvest';

async function scanThanksgiving() {
	// Inert unless the event code is on (never on the live bot until it ships). Seeds while the event is off, so
	// the first real cornucopia after the event starts is not swallowed by seeding.
	if (!thanksgivingCodeEnabled()) return;
	const seeded = await isSeeded(THANKSGIVING_KIND);
	if (seeded && !isThanksgivingActive()) return;
	const claimed = await claimedKeys(THANKSGIVING_KIND);
	const itemKeys = THANKSGIVING_FIRST_ITEMS.map(id => `item:${id}`);
	if (seeded && itemKeys.every(k => claimed.has(k)) && claimed.has(CL_COMPLETE_KEY)) return;

	const anyIDs = THANKSGIVING_FIRST_ITEMS.map(String);
	const allIDs = thanksgivingCL.map(String);
	const users = await prisma.$queryRaw<{ id: string; owned: string[]; complete: boolean }[]>`
		SELECT id::text AS id,
			ARRAY(SELECT x FROM unnest(${anyIDs}::text[]) AS x WHERE jsonb_exists("collectionLogBank", x)) AS owned,
			jsonb_exists_all("collectionLogBank", ${allIDs}::text[]) AS complete
		FROM users
		WHERE jsonb_exists_any("collectionLogBank", ${anyIDs}::text[])
		ORDER BY id
	`;
	const byKey = new Map<string, string[]>();
	const add = (key: string, id: string) => {
		const list = byKey.get(key) ?? [];
		if (list.length <= MAX_SHARED_FIRST_NAMES) list.push(id);
		byKey.set(key, list);
	};
	for (const u of users) {
		for (const itemID of u.owned) add(`item:${itemID}`, u.id);
		if (u.complete) add(CL_COMPLETE_KEY, u.id);
	}
	await runScope({
		kind: THANKSGIVING_KIND,
		rows: [...byKey.entries()].filter(([k]) => !claimed.has(k)).map(([key, userIDs]) => ({ key, userIDs })),
		canAnnounce: () => true,
		text: (key, names) =>
			key === CL_COMPLETE_KEY
				? serverFirstLogText(names, THANKSGIVING_LOG_NAME)
				: serverFirstItemText(names, Items.itemNameFromId(Number(key.slice('item:'.length))) ?? 'Unknown item')
	});
}

const running = { now: false };

/** Ticker body. Never throws. */
export async function serverFirstsTick() {
	if (running.now) return;
	running.now = true;
	try {
		await ensureTable();
		await scanBossKills().catch(err => Logging.logError(err as Error));
		await scanThanksgiving().catch(err => Logging.logError(err as Error));
	} catch (err) {
		Logging.logError(err as Error);
	} finally {
		running.now = false;
	}
}

type TableLike = {
	table?: { item: unknown }[];
	oneInItems?: { item: unknown; chance: number }[];
	tertiaryItems?: { item: unknown; chance: number }[];
	everyItems?: { item: unknown }[];
};

function asTable(x: unknown): TableLike | null {
	if (!x || typeof x !== 'object') return null;
	const t = x as TableLike;
	return Array.isArray(t.tertiaryItems) && Array.isArray(t.table) ? t : null;
}

function countItem(t: TableLike, id: number, seen = new Set<TableLike>()): number {
	if (seen.has(t)) return 0;
	seen.add(t);
	let n = 0;
	for (const list of [t.table, t.oneInItems, t.tertiaryItems, t.everyItems]) {
		for (const entry of list ?? []) {
			if (entry.item === id) n++;
			const sub = asTable(entry.item);
			if (sub) n += countItem(sub, id, seen);
		}
	}
	return n;
}

const rateCache = new Map<number, ReadonlyMap<number, number>>();

/**
 * 1/N per-kill rates we can trust: collection log items that are a single top-level "1 in N" roll (tertiary or
 * one-in, never a clue scroll) in the monster's own loot table and appear nowhere else in it. Anything else is skipped.
 */
export function knownKillRates(monster: Pick<KillableMonster, 'id' | 'table'>): ReadonlyMap<number, number> {
	const cached = rateCache.get(monster.id);
	if (cached) return cached;
	const rates = new Map<number, number>();
	const table = asTable((monster.table as { table?: unknown } | undefined)?.table);
	if (table) {
		for (const entry of [...(table.tertiaryItems ?? []), ...(table.oneInItems ?? [])]) {
			if (typeof entry.item !== 'number' || !allCLItems.has(entry.item)) continue;
			// Clue scrolls are in the clue log but are not drops anyone is "dry" on.
			if (Items.itemNameFromId(entry.item)?.toLowerCase().startsWith('clue scroll')) continue;
			if (!Number.isFinite(entry.chance) || entry.chance < 1) continue;
			if (countItem(table, entry.item) !== 1) continue;
			rates.set(entry.item, entry.chance);
		}
	}
	rateCache.set(monster.id, rates);
	return rates;
}

/**
 * Call after a monster trip's items were saved. Posts one message per first-ever known-rate drop that took 3x the
 * rate or longer. Synchronous work only up front; the send is fire-and-forget and never throws.
 */
export function announceBadLuckDrops({
	user,
	monster,
	itemsAdded,
	previousCL,
	kcAfter,
	quantity
}: {
	user: MUser;
	monster: Pick<KillableMonster, 'id' | 'name' | 'table'>;
	itemsAdded: Bank;
	previousCL: Bank | undefined;
	kcAfter: number;
	quantity: number;
}): void {
	try {
		if (!previousCL) return;
		const drops = findBadLuckDrops({
			added: itemsAdded.items().map(([item, qty]) => [item.id, qty] as [number, number]),
			amountBefore: id => previousCL.amount(id),
			rates: knownKillRates(monster),
			kcAfter,
			quantity
		});
		for (const drop of drops) {
			const content = badLuckText(
				user.usernameOrMention,
				Items.itemNameFromId(drop.itemID) ?? 'Unknown item',
				monster.name,
				drop
			);
			void announceToRareChannel(content).catch(err => Logging.logError(err as Error));
		}
	} catch (err) {
		Logging.logError(err as Error);
	}
}
