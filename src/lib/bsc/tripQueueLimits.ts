import { Time } from '@oldschoolgg/toolkit';
import { DateTime } from 'luxon';

import { isValidQueueLocalTime } from '@/lib/bsc/tripQueueState.js';
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

/** A daily reset time: an hourly HH:mm and an IANA zone, so daylight saving is handled by the zone. */
export interface QueueResetSchedule {
	time: string;
	timezone: string;
}

export interface QueueResetState extends QueueResetSchedule {
	/** A requested new reset time. It becomes active at `from`, the refill at the current reset time. */
	pending: (QueueResetSchedule & { from: number }) | null;
	/** When the running allowance window refills, fixed when the window starts. */
	refillAt: number | null;
	/** The last refill that actually happened; the next day is never shorter than one calendar day after it. */
	lastRefillAt: number | null;
}

/** Everyone starts with the allowance refilling at 8 PM America/Chicago. */
export const QUEUE_RESET_TIMEZONE = 'America/Chicago';
export const QUEUE_RESET_HOUR = 20;
export const DEFAULT_QUEUE_RESET: QueueResetSchedule = { time: '20:00', timezone: QUEUE_RESET_TIMEZONE };

export function defaultQueueResetState(): QueueResetState {
	return { ...DEFAULT_QUEUE_RESET, pending: null, refillAt: null, lastRefillAt: null };
}

function boundaryOn(local: DateTime, schedule: QueueResetSchedule): DateTime {
	const [hour, minute] = schedule.time.split(':').map(Number);
	return local.set({ hour, minute, second: 0, millisecond: 0 });
}

/** The most recent reset at or before `now` for this schedule. */
export function resetPeriodStartMs(now: number, schedule: QueueResetSchedule = DEFAULT_QUEUE_RESET): number {
	const local = DateTime.fromMillis(now, { zone: schedule.timezone });
	let boundary = boundaryOn(local, schedule);
	if (boundary.toMillis() > now) boundary = boundaryOn(local.minus({ days: 1 }), schedule);
	return boundary.toMillis();
}

/** The first reset strictly after `now` for this schedule. */
export function nextResetAfterMs(now: number, schedule: QueueResetSchedule = DEFAULT_QUEUE_RESET): number {
	let cursor = DateTime.fromMillis(resetPeriodStartMs(now, schedule), { zone: schedule.timezone });
	for (let i = 0; i < 4; i++) {
		cursor = boundaryOn(cursor.plus({ days: 1 }), schedule);
		if (cursor.toMillis() > now) return cursor.toMillis();
	}
	return cursor.toMillis();
}

/** The first reset at or after `at` for this schedule. */
export function firstResetAtOrAfterMs(at: number, schedule: QueueResetSchedule): number {
	return resetPeriodStartMs(at, schedule) === at ? at : nextResetAfterMs(at, schedule);
}

/** Default-schedule helpers (8 PM America/Chicago). */
export function queuePeriodStartMs(now: number): number {
	return resetPeriodStartMs(now, DEFAULT_QUEUE_RESET);
}

export function nextQueueResetMs(now: number): number {
	return nextResetAfterMs(now, DEFAULT_QUEUE_RESET);
}

/**
 * When a window starting at `start` refills. Normally the next reset; after a refill it is never
 * earlier than one calendar day after that refill, so changing reset time can't shorten a day.
 */
export function queueWindowEndMs(start: number, schedule: QueueResetSchedule, lastRefillAt: number | null): number {
	let end = nextResetAfterMs(start, schedule);
	if (lastRefillAt && lastRefillAt > 0) {
		const minEnd = DateTime.fromMillis(lastRefillAt, { zone: schedule.timezone }).plus({ days: 1 }).toMillis();
		if (end < minEnd) end = firstResetAtOrAfterMs(minEnd, schedule);
	}
	return end;
}

/**
 * When this player's allowance next refills, or 0 if no window is running.
 * New windows store `refillAt`; older rows (personal 24h window start) refill at the next reset after it.
 */
export function queueResetAtMs(dailyReset: number, reset?: QueueResetState | null): number {
	if (dailyReset <= 0) return 0;
	if (reset?.refillAt && reset.refillAt > 0) return reset.refillAt;
	return nextResetAfterMs(dailyReset, reset ?? DEFAULT_QUEUE_RESET);
}

export function isQueueWindowActive(dailyReset: number, now: number, reset?: QueueResetState | null): boolean {
	return dailyReset > 0 && now < queueResetAtMs(dailyReset, reset);
}

/** Activates a pending reset time once its refill has passed. */
export function applyPendingResetIfDue(reset: QueueResetState, now: number): QueueResetState {
	if (!reset.pending || now < reset.pending.from) return reset;
	const { from, time, timezone } = reset.pending;
	return {
		time,
		timezone,
		pending: null,
		refillAt: reset.refillAt,
		lastRefillAt: Math.max(reset.lastRefillAt ?? 0, from)
	};
}

type QueueAllowanceRow = { dailyUsed: number; dailyReset: number; reset?: QueueResetState | null };

/**
 * Clears daily usage once the running window has refilled, then activates any pending reset time.
 * Does not start a new window; that happens when they next use the queue.
 */
export function applyQueueDailyReset<T extends QueueAllowanceRow>(row: T, now: number): T {
	let out: T = row;
	if (row.dailyReset <= 0) {
		if (row.dailyUsed !== 0) out = { ...row, dailyUsed: 0 };
	} else {
		const refill = queueResetAtMs(row.dailyReset, row.reset);
		if (now < refill) return row;
		out = { ...row, dailyUsed: 0, dailyReset: 0 };
		if (row.reset) out.reset = { ...row.reset, refillAt: null, lastRefillAt: refill };
	}
	if (out.reset?.pending && now >= out.reset.pending.from) {
		out = { ...out, reset: applyPendingResetIfDue(out.reset, now) };
	}
	return out;
}

/** Start an allowance window on the player's active reset time if one is not already running. */
export function startQueueWindowIfNeeded<T extends QueueAllowanceRow>(row: T, now: number): T {
	const reset = applyQueueDailyReset(row, now);
	if (isQueueWindowActive(reset.dailyReset, now, reset.reset)) return reset;
	const schedule = reset.reset ?? DEFAULT_QUEUE_RESET;
	const start = resetPeriodStartMs(now, schedule);
	const out: T = { ...reset, dailyUsed: 0, dailyReset: start };
	if (reset.reset) {
		out.reset = { ...reset.reset, refillAt: queueWindowEndMs(start, schedule, reset.reset.lastRefillAt) };
	}
	return out;
}

/** The refill time to show players: the running window's refill, otherwise when a window started now would refill. */
export function queueRefillDisplayMs(dailyReset: number, now: number, reset?: QueueResetState | null): number {
	if (isQueueWindowActive(dailyReset, now, reset)) return queueResetAtMs(dailyReset, reset);
	if (reset?.pending && now < reset.pending.from) return reset.pending.from;
	const active = reset ? applyPendingResetIfDue(reset, now) : null;
	const schedule = active ?? DEFAULT_QUEUE_RESET;
	return queueWindowEndMs(resetPeriodStartMs(now, schedule), schedule, active?.lastRefillAt ?? null);
}

export type QueueResetChange =
	| { kind: 'unchanged'; reset: QueueResetState }
	| { kind: 'cancelled'; reset: QueueResetState }
	| { kind: 'pending'; reset: QueueResetState; from: number };

/**
 * Request a new reset time. It never applies straight away: it waits for the refill at the
 * current reset time, so switching (any number of times) can't grant an extra refill.
 */
export function requestQueueResetChange<T extends QueueAllowanceRow & { reset: QueueResetState }>(
	row: T,
	schedule: QueueResetSchedule,
	now: number
): QueueResetChange {
	const current = applyQueueDailyReset(row, now).reset;
	const sameAsActive = current.time === schedule.time && current.timezone === schedule.timezone;
	if (sameAsActive) {
		if (!current.pending) return { kind: 'unchanged', reset: current };
		return { kind: 'cancelled', reset: { ...current, pending: null } };
	}
	const settled = applyQueueDailyReset(row, now);
	// The refill at the current reset time: the running window's, or when one started now would refill.
	const from = queueRefillDisplayMs(settled.dailyReset, now, current);
	return { kind: 'pending', reset: { ...current, pending: { ...schedule, from } }, from };
}

const QUEUE_RESET_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function parseResetSchedule(value: unknown): QueueResetSchedule | null {
	if (!value || typeof value !== 'object') return null;
	const raw = value as Partial<QueueResetSchedule>;
	const time = String(raw.time ?? '');
	const timezone = String(raw.timezone ?? '');
	if (!QUEUE_RESET_TIME_RE.test(time) || !isValidQueueLocalTime(time, timezone)) return null;
	return { time, timezone };
}

function positiveOrNull(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** Reads the stored personal reset time; anything missing or invalid falls back to 8 PM CT. */
export function parseQueueResetState(value: unknown): QueueResetState {
	let parsed: unknown = value;
	if (typeof value === 'string') {
		try {
			parsed = JSON.parse(value);
		} catch {
			parsed = null;
		}
	}
	const base = defaultQueueResetState();
	if (!parsed || typeof parsed !== 'object') return base;
	const raw = parsed as Partial<QueueResetState>;
	const active = parseResetSchedule(raw) ?? DEFAULT_QUEUE_RESET;
	const pendingSchedule = parseResetSchedule(raw.pending);
	const pendingFrom = positiveOrNull(raw.pending?.from);
	return {
		time: active.time,
		timezone: active.timezone,
		pending: pendingSchedule && pendingFrom ? { ...pendingSchedule, from: pendingFrom } : null,
		refillAt: positiveOrNull(raw.refillAt),
		lastRefillAt: positiveOrNull(raw.lastRefillAt)
	};
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
