import { AsyncLocalStorage } from 'node:async_hooks';
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
 * Each turkey has a 1 in 3 chance to feast. A successful turkey starts a new feast (random
 * kind) or, if one is running, adds 10-30 minutes to it (same kind), capped at 3 hours left.
 *
 * A trip only gets the boost for the part of it that overlapped the feast window. The trip
 * window is the trip's own [finishDate - duration, finishDate], so it is right for real trips
 * and for instant test-bot trips (which finish before their finishDate).
 */

export type HarvestFeastKind = 'loot' | 'xp';

export interface HarvestFeast {
	kind: HarvestFeastKind;
	startMs: number;
	endMs: number;
}

export const HARVEST_FEAST_MIN_MINUTES = 10;
export const HARVEST_FEAST_MAX_MINUTES = 30;
/** 1 in N turkeys start or extend a feast. The rest are eaten with no feast. */
export const HARVEST_FEAST_SUCCESS_ONE_IN = 3;
/** A feast never has more than this much time left. */
export const HARVEST_FEAST_MAX_TOTAL_MS = 3 * Time.Hour;

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

export type TurkeyOfferResult =
	| { outcome: 'none' }
	| { outcome: 'new' | 'extended'; feast: HarvestFeast; addedMs: number };

/** True when the running feast is at the time cap, so another turkey could add nothing. */
export function harvestFeastIsFull(active: HarvestFeast | null | undefined, now = Date.now()): boolean {
	if (!active || active.endMs <= now) return false;
	return active.endMs - now >= HARVEST_FEAST_MAX_TOTAL_MS - Time.Minute;
}

/**
 * Roll one offered turkey. 1/3: feast. With a feast running (pass it as `active`), adds 10-30
 * minutes to it and keeps its kind; otherwise starts a new 2x loot or 2x XP feast (50/50).
 * Time left is capped at 3 hours. Whole seconds, because that is what gets stored.
 */
export function rollTurkeyOffer(
	rng: ThanksgivingRng,
	active: HarvestFeast | null | undefined,
	now = Date.now()
): TurkeyOfferResult {
	if (rng.randInt(1, HARVEST_FEAST_SUCCESS_ONE_IN) !== 1) return { outcome: 'none' };
	const nowS = Math.floor(now / 1000) * 1000;
	const cap = nowS + HARVEST_FEAST_MAX_TOTAL_MS;
	if (active && active.endMs > now) {
		const minutes = rng.randInt(HARVEST_FEAST_MIN_MINUTES, HARVEST_FEAST_MAX_MINUTES);
		const endMs = Math.min(cap, active.endMs + minutes * Time.Minute);
		return {
			outcome: 'extended',
			feast: { kind: active.kind, startMs: active.startMs, endMs },
			addedMs: Math.max(0, endMs - active.endMs)
		};
	}
	const kind: HarvestFeastKind = rng.randInt(1, 2) === 1 ? 'loot' : 'xp';
	const minutes = rng.randInt(HARVEST_FEAST_MIN_MINUTES, HARVEST_FEAST_MAX_MINUTES);
	const endMs = Math.min(cap, nowS + minutes * Time.Minute);
	return { outcome: 'new', feast: { kind, startMs: nowS, endMs }, addedMs: endMs - nowS };
}

/** Rare-channel text for a successful turkey. No pings (sent with mentions disabled). */
export function harvestFeastAnnouncement(name: string, result: TurkeyOfferResult): string | null {
	if (result.outcome === 'none') return null;
	const minutes = Math.max(1, Math.round(result.addedMs / Time.Minute));
	const kind = harvestFeastName(result.feast.kind);
	return result.outcome === 'new'
		? `🦃 ${name} offered a Harvest turkey and started a ${kind} Harvest feast (${minutes} min)!`
		: `🦃 ${name} offered a Harvest turkey and added ${minutes} min to their ${kind} feast!`;
}

/**
 * The trip being completed right now (set by ActivityManager around task.run), so addXP can
 * use the trip's own window. Async-local, so concurrent trips never see each other's window.
 */
const tripWindowStorage = new AsyncLocalStorage<{ finishDate: number }>();

export function runWithTripWindow<T>(finishDate: number | null | undefined, fn: () => T): T {
	if (typeof finishDate !== 'number' || !Number.isFinite(finishDate)) return fn();
	return tripWindowStorage.run({ finishDate }, fn);
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

/**
 * Share of a trip that gets the feast boost of this kind. 0 when the event is off.
 * The trip is [tripFinishMs - duration, tripFinishMs]: tripFinishMs is the trip's stored finishDate
 * (passed in, or from the trip being completed), falling back to now. Using the stored finishDate
 * instead of the wall clock keeps instant test-bot trips (completed before finishDate) correct.
 */
export function harvestFeastFraction(
	userID: string,
	kind: HarvestFeastKind,
	durationMs: number,
	tripFinishMs?: number | null,
	now = Date.now()
) {
	if (!isThanksgivingActive(now)) return 0;
	const feast = getHarvestFeast(userID);
	if (!feast || feast.kind !== kind) return 0;
	const end =
		typeof tripFinishMs === 'number' && Number.isFinite(tripFinishMs)
			? tripFinishMs
			: (tripWindowStorage.getStore()?.finishDate ?? now);
	return feastOverlapFraction(feast, end, durationMs);
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
		return [
			'**Harvest feast**: none',
			`-# Offer a Harvest turkey (\`/thanksgiving offer item:Harvest turkey\`): 1 in ${HARVEST_FEAST_SUCCESS_ONE_IN} chance of a 2x loot or 2x XP feast (${HARVEST_FEAST_MIN_MINUTES}-${HARVEST_FEAST_MAX_MINUTES} minutes).`
		].join('\n');
	}
	return [
		`**Harvest feast**: **${harvestFeastName(feast.kind)}** for ${formatDuration(feast.endMs - now, true)} more (ends <t:${Math.floor(feast.endMs / 1000)}:R>)`,
		`-# Each Harvest turkey has a 1 in ${HARVEST_FEAST_SUCCESS_ONE_IN} chance to add ${HARVEST_FEAST_MIN_MINUTES}-${HARVEST_FEAST_MAX_MINUTES} minutes (up to ${HARVEST_FEAST_MAX_TOTAL_MS / Time.Hour} hours left).`
	].join('\n');
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

/** Save the player's feast (new or extended; one row set per player). Memory is only updated after the database write succeeds. */
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
