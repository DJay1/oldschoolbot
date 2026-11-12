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
