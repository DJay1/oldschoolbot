import { PerkTier } from '@/lib/constants.js';

/** F2P players can queue this many trips each UTC calendar day. */
export const F2P_DAILY_QUEUE_LIMIT = 2;

/**
 * Max trips that can be queued at once for each patron perk tier.
 * PerkTier Two is Pup, through Seven (Biggest of Dogs).
 */
const PATRON_QUEUE_LIMITS: ReadonlyArray<{ minPerk: PerkTier; max: number }> = [
	{ minPerk: PerkTier.Seven, max: 18 },
	{ minPerk: PerkTier.Six, max: 15 },
	{ minPerk: PerkTier.Five, max: 12 },
	{ minPerk: PerkTier.Four, max: 9 },
	{ minPerk: PerkTier.Three, max: 6 },
	{ minPerk: PerkTier.Two, max: 3 }
];

/** How many trips a player may have lined up at once. F2P (below Pup) is 2. */
export function maxQueuedTripsForPerkTier(perkTier: number): number {
	for (const entry of PATRON_QUEUE_LIMITS) {
		if (perkTier >= entry.minPerk) return entry.max;
	}
	return F2P_DAILY_QUEUE_LIMIT;
}

/**
 * Daily add cap. Patrons (Pup and up) have no daily cap, only the at-once max.
 * Returns null when there is no daily cap.
 */
export function dailyQueueAllowance(perkTier: number): number | null {
	if (perkTier >= PerkTier.Two) return null;
	return F2P_DAILY_QUEUE_LIMIT;
}

/** Start of the current UTC calendar day, in unix milliseconds. */
export function utcDayStartMs(now: number): number {
	const date = new Date(now);
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function applyQueueDailyReset<T extends { dailyUsed: number; dailyReset: number }>(row: T, now: number): T {
	const start = utcDayStartMs(now);
	if (row.dailyReset === start) return row;
	return { ...row, dailyUsed: 0, dailyReset: start };
}
