import { DateTime } from 'luxon';

export interface QueuedTrip {
	activityId: number;
	type: string;
}

export interface QueuedTripGroup extends QueuedTrip {
	count: number;
}

export function isValidQueueLocalTime(time: string, timezone: string): boolean {
	if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return false;
	if (timezone !== 'UTC' && !timezone.includes('/')) return false;
	return DateTime.now().setZone(timezone).isValid;
}

export function nextQueueScheduleAt(time: string, timezone: string, now: number): number | null {
	if (!isValidQueueLocalTime(time, timezone)) return null;
	const [hour, minute] = time.split(':').map(Number);
	const current = DateTime.fromMillis(now, { zone: timezone });
	let scheduled = current.set({ hour, minute, second: 0, millisecond: 0 });
	if (scheduled.toMillis() <= now) scheduled = scheduled.plus({ days: 1 });
	return scheduled.toMillis();
}

export function parseQueuedTrips(value: unknown, remaining: number): QueuedTripGroup[] {
	if (!value || remaining <= 0) return [];
	let parsed: unknown;
	try {
		parsed = typeof value === 'string' ? JSON.parse(value) : value;
	} catch {
		return [];
	}
	if (Array.isArray(parsed)) {
		return parsed.flatMap(entry => {
			if (!entry || typeof entry !== 'object') return [];
			const group = entry as Partial<QueuedTripGroup>;
			if (
				typeof group.activityId !== 'number' ||
				typeof group.type !== 'string' ||
				!Number.isInteger(group.count) ||
				group.count! <= 0
			) {
				return [];
			}
			return [{ activityId: group.activityId, type: group.type, count: group.count! }];
		});
	}
	if (typeof parsed !== 'object' || parsed === null) return [];
	const trip = parsed as Partial<QueuedTrip>;
	if (typeof trip.activityId !== 'number' || typeof trip.type !== 'string') return [];
	return [{ activityId: trip.activityId, type: trip.type, count: remaining }];
}

export function appendQueuedTrips(queue: QueuedTripGroup[], trip: QueuedTrip, count: number): QueuedTripGroup[] {
	const last = queue.at(-1);
	if (last?.activityId === trip.activityId && last.type === trip.type) {
		return [...queue.slice(0, -1), { ...last, count: last.count + count }];
	}
	return [...queue, { ...trip, count }];
}

export function dequeueQueuedTrip(queue: QueuedTripGroup[]): QueuedTripGroup[] {
	const [first, ...rest] = queue;
	if (!first) return [];
	return first.count > 1 ? [{ ...first, count: first.count - 1 }, ...rest] : rest;
}

/** Recurring scheduled queue runs may repeat daily this many times. */
export const MAX_RECURRING_QUEUE_DAYS = 5;

export interface RecurringQueuedTrip extends QueuedTripGroup {
	label?: string;
}

export interface RecurringQueue {
	trips: RecurringQueuedTrip[];
	daysLeft: number;
	time: string;
	timezone: string;
	nextAt: number;
	channelId: string;
	lastResult: string | null;
	lastClaimKey: string | null;
}

export function parseRecurringDays(value: unknown): number | null {
	if (typeof value !== 'number' || !Number.isInteger(value)) return null;
	if (value < 1 || value > MAX_RECURRING_QUEUE_DAYS) return null;
	return value;
}

export function recurringRunKey(now: number, timezone: string): string | null {
	const local = DateTime.fromMillis(now, { zone: timezone });
	return local.isValid ? local.toISODate() : null;
}

export function parseRecurringQueue(value: unknown): RecurringQueue | null {
	if (!value) return null;
	let parsed: unknown = value;
	if (typeof value === 'string') {
		try {
			parsed = JSON.parse(value);
		} catch {
			return null;
		}
	}
	if (!parsed || typeof parsed !== 'object') return null;
	const rec = parsed as Partial<RecurringQueue>;
	if (!isValidQueueLocalTime(String(rec.time ?? ''), String(rec.timezone ?? ''))) return null;
	if (!Number.isInteger(rec.daysLeft) || rec.daysLeft! < 0 || rec.daysLeft! > MAX_RECURRING_QUEUE_DAYS) {
		return null;
	}
	if (!Number.isFinite(rec.nextAt) || typeof rec.nextAt !== 'number' || rec.nextAt <= 0) return null;
	if (typeof rec.channelId !== 'string') return null;
	if (rec.lastResult != null && typeof rec.lastResult !== 'string') return null;
	if (rec.lastClaimKey != null && typeof rec.lastClaimKey !== 'string') return null;
	const trips = parseQueuedTrips(rec.trips, 1);
	if (trips.length === 0) return null;
	const labelled = Array.isArray(rec.trips)
		? trips.map((trip, index) => {
				const raw = rec.trips?.[index] as RecurringQueuedTrip | undefined;
				return raw?.label ? { ...trip, label: raw.label } : trip;
			})
		: trips;
	return {
		trips: labelled,
		daysLeft: rec.daysLeft!,
		time: rec.time!,
		timezone: rec.timezone!,
		nextAt: rec.nextAt!,
		channelId: rec.channelId,
		lastResult: rec.lastResult ?? null,
		lastClaimKey: rec.lastClaimKey ?? null
	};
}

export type RecurringClaimResult =
	| { ok: false; reason: 'not-due' | 'already-claimed' | 'finished' }
	| { ok: true; recurring: RecurringQueue; runKey: string };

/**
 * Claim one due recurring run. Idempotent for the local calendar day.
 * Missed days are not claimed in a loop; nextAt jumps to the next future slot.
 */
export function claimRecurringRun(recurring: RecurringQueue, now: number): RecurringClaimResult {
	if (recurring.daysLeft <= 0) return { ok: false, reason: 'finished' };
	if (recurring.nextAt > now) return { ok: false, reason: 'not-due' };
	const runKey = recurringRunKey(now, recurring.timezone);
	if (!runKey) return { ok: false, reason: 'not-due' };
	if (recurring.lastClaimKey === runKey) return { ok: false, reason: 'already-claimed' };

	const nextAt = nextQueueScheduleAt(recurring.time, recurring.timezone, now);
	if (nextAt === null) return { ok: false, reason: 'not-due' };

	return {
		ok: true,
		runKey,
		recurring: {
			...recurring,
			daysLeft: recurring.daysLeft - 1,
			nextAt,
			lastClaimKey: runKey
		}
	};
}

export function recurringTripSummary(trips: RecurringQueuedTrip[]): string {
	return trips
		.map(trip => {
			const label = trip.label ?? trip.type;
			return `${trip.count} ${label} trip${trip.count === 1 ? '' : 's'}`;
		})
		.join(', ');
}

/**
 * The daily recurring plan. If the player names a trip and a daily count,
 * that count is the plan. It is not added on top of the current queue.
 * Otherwise the current queue is the plan.
 */
export function buildRecurringQueueTemplate(
	currentQueue: QueuedTripGroup[],
	addedTrip?: QueuedTripGroup | null
): QueuedTripGroup[] {
	if (addedTrip && addedTrip.count > 0) {
		return [{ activityId: addedTrip.activityId, type: addedTrip.type, count: addedTrip.count }];
	}
	return currentQueue
		.filter(trip => trip.count > 0)
		.map(trip => ({ activityId: trip.activityId, type: trip.type, count: trip.count }));
}

/** Drop trips past the player's daily allowance so the stored plan matches what can start. */
export function clampRecurringTemplateToDailyCap<T extends QueuedTripGroup>(
	trips: T[],
	dailyCap: number
): { trips: T[]; requested: number; stored: number } {
	const requested = trips.reduce((sum, trip) => sum + trip.count, 0);
	const cap = Math.max(0, dailyCap);
	let left = cap;
	const clamped: T[] = [];
	for (const trip of trips) {
		if (left <= 0) break;
		const count = Math.min(trip.count, left);
		clamped.push({ ...trip, count });
		left -= count;
	}
	const stored = clamped.reduce((sum, trip) => sum + trip.count, 0);
	return { trips: clamped, requested, stored };
}

/** How many of a recurring plan can be copied into the live queue this window. */
export function planRecurringEnqueue(
	trips: QueuedTripGroup[],
	dailyLeft: number,
	room: number
): QueuedTripGroup[] {
	const planned: QueuedTripGroup[] = [];
	let added = 0;
	for (const trip of trips) {
		const remainingCap = Math.min(dailyLeft - added, room - added, trip.count);
		if (remainingCap <= 0) break;
		planned.push({ activityId: trip.activityId, type: trip.type, count: remainingCap });
		added += remainingCap;
	}
	return planned;
}

export function formatRecurringScheduleConfirmation(options: {
	trips: RecurringQueuedTrip[];
	timeLabel: string;
	scheduledAt: number;
	days: number;
	refunded?: number;
	replacedRecurring?: boolean;
	requestedPerDay?: number;
	dailyCap?: number;
}): string {
	const perDay = options.trips.reduce((sum, trip) => sum + trip.count, 0);
	const total = perDay * options.days;
	const extras: string[] = [];
	if (
		options.requestedPerDay !== undefined &&
		options.dailyCap !== undefined &&
		options.requestedPerDay > options.dailyCap
	) {
		extras.push(
			`You asked for ${options.requestedPerDay} trip${options.requestedPerDay === 1 ? '' : 's'} per day, but only ${options.dailyCap} can start each day because of your daily queue limit.`
		);
	}
	if ((options.refunded ?? 0) > 0) {
		extras.push('Your current queue was refunded so those trips are not started twice.');
	}
	if (options.replacedRecurring) {
		extras.push('This replaces your previous recurring schedule.');
	}
	return `Scheduled ${recurringTripSummary(options.trips)} each day at ${options.timeLabel} (next <t:${Math.floor(options.scheduledAt / 1000)}:F>) for ${options.days} day${options.days === 1 ? '' : 's'} (${total} trip${total === 1 ? '' : 's'} total). Use /queue unschedule to cancel.${extras.length ? ` ${extras.join(' ')}` : ''}`;
}
