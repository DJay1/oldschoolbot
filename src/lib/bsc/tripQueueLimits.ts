import { Time } from '@oldschoolgg/toolkit';

import { PerkTier } from '@/lib/constants.js';

export const F2P_QUEUE_LIMIT = 2;
export const QUEUE_RESET_MS = Time.Day * 1;

export function maxQueuedTripsForPerkTier(perkTier: number): number {
	if (perkTier <= PerkTier.One) return F2P_QUEUE_LIMIT;
	return Math.min(8, F2P_QUEUE_LIMIT + (perkTier - PerkTier.One));
}

export function dailyQueueAllowance(perkTier: number): number {
	return maxQueuedTripsForPerkTier(perkTier);
}

export function utcDayStartMs(now: number): number {
	return Math.floor(now / QUEUE_RESET_MS) * QUEUE_RESET_MS;
}

/** When this player's allowance next refills, or 0 if no personal window is running. */
export function queueResetAtMs(dailyReset: number): number {
	if (dailyReset <= 0) return 0;
	return dailyReset + QUEUE_RESET_MS;
}

export function isQueueWindowActive(dailyReset: number, now: number): boolean {
	return dailyReset > 0 && now < dailyReset + QUEUE_RESET_MS;
}

/**
 * Clears daily usage when the player's personal window has expired.
 * Does not start a new window — that happens when they next use the queue.
 */
export function applyQueueDailyReset<T extends { dailyUsed: number; dailyReset: number }>(row: T, now: number): T {
	if (row.dailyReset <= 0) {
		return row.dailyUsed === 0 ? row : { ...row, dailyUsed: 0 };
	}
	if (now < row.dailyReset + QUEUE_RESET_MS) return row;
	return { ...row, dailyUsed: 0, dailyReset: 0 };
}

/** Start a personal refill window at `now` if the player does not already have one running. */
export function startQueueWindowIfNeeded<T extends { dailyUsed: number; dailyReset: number }>(row: T, now: number): T {
	const reset = applyQueueDailyReset(row, now);
	if (isQueueWindowActive(reset.dailyReset, now)) return reset;
	return { ...reset, dailyUsed: 0, dailyReset: now };
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
