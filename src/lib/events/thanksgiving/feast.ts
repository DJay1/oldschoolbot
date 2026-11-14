import { formatDuration, Time } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import { isThanksgivingActive, type ThanksgivingRng, thanksgivingCodeEnabled } from './core.js';
import { ThanksgivingItem } from './items.js';

/**
 * Harvest feast: offer a Harvest turkey for a personal 2x loot or 2x XP buff.
 *
 * Separate from the global Double Loot / Double XP timers (it never reads or writes
 * double_loot_finish_time or double_xp_finish_time). Only applies while The Straw Hat
 * Harvest is active, which is test-bot only for now.
 *
 * A trip only gets the boost for the part of it that overlapped the feast window, so a
 * 15 minute feast cannot double a 3 hour trip, and offering a turkey just before a long
 * trip returns only boosts those last minutes.
 */

export type HarvestFeastKind = 'loot' | 'xp';

export interface HarvestFeast {
	kind: HarvestFeastKind;
	startMs: number;
	endMs: number;
}

export const HARVEST_FEAST_MIN_MINUTES = 15;
export const HARVEST_FEAST_MAX_MINUTES = 60;

/** Group/boss trips and trips that are never doubled are skipped, same list as the Mystery box loot doubling. */
export const HARVEST_FEAST_LOOT_EXCLUDED_ACTIVITIES: readonly string[] = [
	'GroupMonsterKilling',
	'KingGoldemar',
	'Ignecarus',
	'Inferno',
	'Alching',
	'Agility',
	'BeachCombing'
];

/** Event items are never doubled by a feast: rares, pets, parts, and turkeys keep their designed rates. */
const FEAST_EXCLUDED_ITEM_IDS: ReadonlySet<number> = new Set(Object.values(ThanksgivingItem));

const SCALE = 1_000_000;
const ROW_PREFIX = 'feast:';
const START_ROW = 'feast:start';

/** userID -> latest feast. Loaded at startup, updated on every save. Single bot process, so this stays in sync. */
const feastCache = new Map<string, HarvestFeast>();

export function rollHarvestFeast(rng: ThanksgivingRng, now = Date.now()): HarvestFeast {
	const kind: HarvestFeastKind = rng.randInt(1, 2) === 1 ? 'loot' : 'xp';
	const minutes = rng.randInt(HARVEST_FEAST_MIN_MINUTES, HARVEST_FEAST_MAX_MINUTES);
	// Whole seconds, because that is what gets stored.
	const startMs = Math.floor(now / 1000) * 1000;
	return { kind, startMs, endMs: startMs + minutes * Time.Minute };
}

/** 0 to 1: how much of the trip [tripEnd - duration, tripEnd] was inside the feast window. */
export function feastOverlapFraction(feast: HarvestFeast | null | undefined, tripEndMs: number, durationMs: number) {
	if (!feast || !Number.isFinite(durationMs) || durationMs <= 0) return 0;
	const tripStart = tripEndMs - durationMs;
	const overlap = Math.min(tripEndMs, feast.endMs) - Math.max(tripStart, feast.startMs);
	if (overlap <= 0) return 0;
	return Math.min(1, overlap / durationMs);
}

export function getHarvestFeast(userID: string): HarvestFeast | null {
	if (!thanksgivingCodeEnabled()) return null;
	return feastCache.get(userID) ?? null;
}

/** The feast still running right now, if any. */
export function activeHarvestFeast(userID: string, now = Date.now()): HarvestFeast | null {
	const feast = getHarvestFeast(userID);
	if (!feast || feast.endMs <= now || !isThanksgivingActive(now)) return null;
	return feast;
}

/** Share of a trip that ended now that gets the feast boost of this kind. 0 when the event is off. */
export function harvestFeastFraction(userID: string, kind: HarvestFeastKind, durationMs: number, now = Date.now()) {
	if (!isThanksgivingActive(now)) return 0;
	const feast = getHarvestFeast(userID);
	if (!feast || feast.kind !== kind) return 0;
	return feastOverlapFraction(feast, now, durationMs);
}

/**
 * The extra loot a feast adds: each item x fraction (the remainder rolled as a chance).
 * Only tradeable, non-event items, so pets, capes, clue scrolls and event drops are never copied.
 */
export function harvestFeastBonusLoot(loot: Bank, fraction: number, rng: ThanksgivingRng): Bank {
	const bonus = new Bank();
	if (!(fraction > 0)) return bonus;
	const f = Math.min(1, fraction);
	for (const [item, qty] of loot.items()) {
		if (qty <= 0) continue;
		if (FEAST_EXCLUDED_ITEM_IDS.has(item.id)) continue;
		if (item.tradeable !== true) continue;
		const exact = qty * f;
		let extra = Math.floor(exact);
		const remainder = exact - extra;
		if (remainder > 0 && rng.randInt(1, SCALE) <= Math.round(remainder * SCALE)) extra++;
		if (extra > 0) bonus.add(item.id, extra);
	}
	return bonus;
}

export function harvestFeastName(kind: HarvestFeastKind): string {
	return kind === 'loot' ? '2x loot' : '2x XP';
}

export function harvestFeastStatusLine(userID: string, now = Date.now()): string {
	const feast = activeHarvestFeast(userID, now);
	if (!feast) {
		return `Harvest feast: none. Offer a Harvest turkey (\`/thanksgiving offer item:Harvest turkey\`) for a random 2x loot or 2x XP feast (${HARVEST_FEAST_MIN_MINUTES}-${HARVEST_FEAST_MAX_MINUTES} minutes).`;
	}
	return `Harvest feast: **${harvestFeastName(feast.kind)}** for ${formatDuration(feast.endMs - now, true)} more (ends <t:${Math.floor(feast.endMs / 1000)}:R>).`;
}

/* ---------- Storage: rows in the existing bsc_thanksgiving_daily table (no schema change) ---------- */

async function ensureDailyTable() {
	await prisma.$executeRawUnsafe(`
		CREATE TABLE IF NOT EXISTS bsc_thanksgiving_daily (
			user_id text NOT NULL,
			day text NOT NULL,
			offers integer NOT NULL DEFAULT 0,
			PRIMARY KEY (user_id, day)
		)
	`);
}

/** Load every saved feast into memory. Called once at startup, outside any activity transaction. */
export async function syncHarvestFeasts() {
	if (!thanksgivingCodeEnabled()) return;
	await ensureDailyTable();
	const rows = await prisma.$queryRaw<{ user_id: string; day: string; offers: number }[]>`
		SELECT user_id, day, offers FROM bsc_thanksgiving_daily WHERE day LIKE 'feast:%'
	`;
	const starts = new Map<string, number>();
	const kinds = new Map<string, { kind: HarvestFeastKind; endMs: number }>();
	for (const row of rows) {
		const seconds = Number(row.offers);
		if (row.day === START_ROW) starts.set(row.user_id, seconds * 1000);
		else if (row.day === `${ROW_PREFIX}loot` || row.day === `${ROW_PREFIX}xp`) {
			kinds.set(row.user_id, { kind: row.day === `${ROW_PREFIX}loot` ? 'loot' : 'xp', endMs: seconds * 1000 });
		}
	}
	feastCache.clear();
	for (const [userID, { kind, endMs }] of kinds) {
		const startMs = starts.get(userID);
		if (startMs === undefined || endMs <= startMs) continue;
		feastCache.set(userID, { kind, startMs, endMs });
	}
}

/** Replace the player's feast (feasts never stack). Memory is only updated after the database write succeeds. */
export async function saveHarvestFeast(userID: string, feast: HarvestFeast) {
	await ensureDailyTable();
	const kindRow = `${ROW_PREFIX}${feast.kind}`;
	const startSeconds = Math.floor(feast.startMs / 1000);
	const endSeconds = Math.floor(feast.endMs / 1000);
	await prisma.$transaction([
		prisma.$executeRaw`DELETE FROM bsc_thanksgiving_daily WHERE user_id = ${userID} AND day LIKE 'feast:%'`,
		prisma.$executeRaw`
			INSERT INTO bsc_thanksgiving_daily (user_id, day, offers)
			VALUES (${userID}, ${kindRow}, ${endSeconds}), (${userID}, ${START_ROW}, ${startSeconds})
		`
	]);
	feastCache.set(userID, { kind: feast.kind, startMs: startSeconds * 1000, endMs: endSeconds * 1000 });
}

/** Tests only. */
export function _setHarvestFeastForTests(userID: string, feast: HarvestFeast | null) {
	if (feast) feastCache.set(userID, feast);
	else feastCache.delete(userID);
}
