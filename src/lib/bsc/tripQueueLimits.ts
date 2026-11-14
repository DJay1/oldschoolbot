import { Time } from '@oldschoolgg/toolkit';
import { DateTime } from 'luxon';

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

/** Everyone's queue allowance refills at this local time (DST handled by the zone). */
export const QUEUE_RESET_TIMEZONE = 'America/Chicago';
export const QUEUE_RESET_HOUR = 20;
export const QUEUE_RESET_LABEL = '8 PM CT';

function atResetHour(dt: DateTime): DateTime {
	return dt.set({ hour: QUEUE_RESET_HOUR, minute: 0, second: 0, millisecond: 0 });
}

/** Start of the queue day containing `now`: the most recent 8 PM America/Chicago at or before it. */
export function queuePeriodStartMs(now: number): number {
	const local = DateTime.fromMillis(now, { zone: QUEUE_RESET_TIMEZONE });
	let boundary = atResetHour(local);
	if (boundary.toMillis() > now) boundary = atResetHour(local.minus({ days: 1 }));
	return boundary.toMillis();
}

/** The next 8 PM America/Chicago strictly after `now`. */
export function nextQueueResetMs(now: number): number {
	const start = DateTime.fromMillis(queuePeriodStartMs(now), { zone: QUEUE_RESET_TIMEZONE });
	return atResetHour(start.plus({ days: 1 })).toMillis();
}

/**
 * When this player's allowance next refills, or 0 if no window is running.
 * `dailyReset` is the start of the queue day the usage belongs to; older rows may hold
 * a personal window start, which simply refills at the next 8 PM CT after it.
 */
export function queueResetAtMs(dailyReset: number): number {
	if (dailyReset <= 0) return 0;
	return nextQueueResetMs(dailyReset);
}

/** Refill time to show players: the running window's refill, otherwise the next 8 PM CT. */
export function queueRefillDisplayMs(dailyReset: number, now: number): number {
	return isQueueWindowActive(dailyReset, now) ? queueResetAtMs(dailyReset) : nextQueueResetMs(now);
}

export function isQueueWindowActive(dailyReset: number, now: number): boolean {
	return dailyReset > 0 && now < queueResetAtMs(dailyReset);
}

/**
 * Clears daily usage once the queue day the usage belongs to has ended (8 PM CT).
 * Does not start a new window; that happens when they next use the queue.
 */
export function applyQueueDailyReset<T extends { dailyUsed: number; dailyReset: number }>(row: T, now: number): T {
	if (row.dailyReset <= 0) {
		return row.dailyUsed === 0 ? row : { ...row, dailyUsed: 0 };
	}
	if (now < queueResetAtMs(row.dailyReset)) return row;
	return { ...row, dailyUsed: 0, dailyReset: 0 };
}

/** Tie usage to the current queue day if the player does not already have one running. */
export function startQueueWindowIfNeeded<T extends { dailyUsed: number; dailyReset: number }>(row: T, now: number): T {
	const reset = applyQueueDailyReset(row, now);
	if (isQueueWindowActive(reset.dailyReset, now)) return reset;
	return { ...reset, dailyUsed: 0, dailyReset: queuePeriodStartMs(now) };
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
