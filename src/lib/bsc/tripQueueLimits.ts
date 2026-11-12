import { Time } from '@oldschoolgg/toolkit';

import { PerkTier } from '@/lib/constants.js';

/** Free players can queue this many trips per reset window. */
export const F2P_QUEUE_LIMIT = 2;

/** The queue allowance resets everyday (fixed UTC windows). */
export const QUEUE_RESET_MS = Time.Day * 1;

/**
 * Trips a player may queue per window (and have lined up at once).
 * Free players get 2, then each patron tier adds 1: Pup (PerkTier Two) 3 up to Biggest of Dogs (Seven) 8.
 */
export function maxQueuedTripsForPerkTier(perkTier: number): number {
	const level = perkTier >= PerkTier.Two ? Math.min(6, perkTier - 1) : 0;
	return F2P_QUEUE_LIMIT + level;
}

/** Trips a player may add per day window. Same as the at-once max. */
export function dailyQueueAllowance(perkTier: number): number {
	return maxQueuedTripsForPerkTier(perkTier);
}

/** Start of the current day UTC window, in unix milliseconds. */
export function utcDayStartMs(now: number): number {
	return Math.floor(now / QUEUE_RESET_MS) * QUEUE_RESET_MS;
}

/** When the current window ends and the allowance refills. */
export function queueResetAtMs(now: number): number {
	return utcDayStartMs(now) + QUEUE_RESET_MS;
}

export function applyQueueDailyReset<T extends { dailyUsed: number; dailyReset: number }>(row: T, now: number): T {
	const start = utcDayStartMs(now);
	if (row.dailyReset === start) return row;
	return { ...row, dailyUsed: 0, dailyReset: start };
}

/** Refund still-queued trips back to the day allowance and empty the queue. */
export function refundUnstartedTrips<T extends { remaining: number; dailyUsed: number }>(
	state: T
): { refunded: number; state: T } {
	const refunded = Math.max(0, state.remaining);
	return {
		refunded,
		state: {
			...state,
			remaining: 0,
			dailyUsed: Math.max(0, state.dailyUsed - refunded)
		}
	};
}
