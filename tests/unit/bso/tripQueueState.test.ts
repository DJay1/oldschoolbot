import { describe, expect, test } from 'vitest';

import {
	appendQueuedTrips,
	claimRecurringRun,
	dequeueQueuedTrip,
	isValidQueueLocalTime,
	MAX_RECURRING_QUEUE_DAYS,
	nextQueueScheduleAt,
	parseQueuedTrips,
	parseRecurringDays,
	parseRecurringQueue,
	type QueuedTripGroup,
	type RecurringQueue
} from '@/lib/bsc/tripQueueState.js';

describe('trip queue state', () => {
	test('preserves mixed activity order and repeated trip counts', () => {
		let queue: QueuedTripGroup[] = [];
		queue = appendQueuedTrips(queue, { activityId: 1, type: 'Farming' }, 1);
		queue = appendQueuedTrips(queue, { activityId: 2, type: 'Agility' }, 1);
		queue = appendQueuedTrips(queue, { activityId: 2, type: 'Agility' }, 2);
		queue = appendQueuedTrips(queue, { activityId: 3, type: 'Farming' }, 1);
		queue = appendQueuedTrips(queue, { activityId: 4, type: 'Agility' }, 2);

		expect(queue).toEqual([
			{ activityId: 1, type: 'Farming', count: 1 },
			{ activityId: 2, type: 'Agility', count: 3 },
			{ activityId: 3, type: 'Farming', count: 1 },
			{ activityId: 4, type: 'Agility', count: 2 }
		]);
	});

	test('dequeues one trip at a time without changing later order', () => {
		const queue: QueuedTripGroup[] = [
			{ activityId: 1, type: 'Farming', count: 1 },
			{ activityId: 2, type: 'Agility', count: 2 }
		];

		expect(dequeueQueuedTrip(queue)).toEqual([{ activityId: 2, type: 'Agility', count: 2 }]);
		expect(dequeueQueuedTrip(queue.slice(1))).toEqual([{ activityId: 2, type: 'Agility', count: 1 }]);
	});

	test('loads existing single-trip rows using the stored remaining count', () => {
		expect(parseQueuedTrips({ activityId: 12, type: 'Agility' }, 3)).toEqual([
			{ activityId: 12, type: 'Agility', count: 3 }
		]);
	});

	test('loads ordered groups from JSON storage', () => {
		const stored = JSON.stringify([
			{ activityId: 1, type: 'Farming', count: 1 },
			{ activityId: 2, type: 'Agility', count: 3 }
		]);

		expect(parseQueuedTrips(stored, 4)).toEqual([
			{ activityId: 1, type: 'Farming', count: 1 },
			{ activityId: 2, type: 'Agility', count: 3 }
		]);
	});

	test('validates local times with IANA timezone identifiers', () => {
		expect(isValidQueueLocalTime('22:00', 'America/Chicago')).toBe(true);
		expect(isValidQueueLocalTime('10 pm', 'America/Chicago')).toBe(false);
		expect(isValidQueueLocalTime('22:00', 'CST')).toBe(false);
	});

	test('schedules the next local occurrence, including the timezone offset', () => {
		const now = Date.parse('2026-11-11T20:00:00.000Z');

		expect(nextQueueScheduleAt('22:00', 'America/Chicago', now)).toBe(Date.parse('2026-11-12T04:00:00.000Z'));
		expect(nextQueueScheduleAt('12:00', 'America/Chicago', now)).toBe(Date.parse('2026-11-12T18:00:00.000Z'));
	});
});

function sampleRecurring(overrides: Partial<RecurringQueue> = {}): RecurringQueue {
	return {
		trips: [{ activityId: 1, type: 'Woodcutting', count: 2, label: 'Woodcutting' }],
		daysLeft: 5,
		time: '22:00',
		timezone: 'America/Chicago',
		nextAt: Date.parse('2026-11-13T04:00:00.000Z'),
		channelId: '123',
		lastResult: null,
		lastClaimKey: null,
		...overrides
	};
}

describe('recurring scheduled queue', () => {
	test('days must be a whole number from 1 to 5', () => {
		expect(MAX_RECURRING_QUEUE_DAYS).toBe(5);
		expect(parseRecurringDays(1)).toBe(1);
		expect(parseRecurringDays(5)).toBe(5);
		expect(parseRecurringDays(0)).toBeNull();
		expect(parseRecurringDays(6)).toBeNull();
		expect(parseRecurringDays(2.5)).toBeNull();
	});

	test('claiming a due run is idempotent for the same local day', () => {
		const now = Date.parse('2026-11-13T04:01:00.000Z');
		const first = claimRecurringRun(sampleRecurring(), now);
		expect(first.ok).toBe(true);
		if (!first.ok) return;
		expect(first.runKey).toBe('2026-11-12');
		expect(first.recurring.daysLeft).toBe(4);
		expect(first.recurring.nextAt).toBeGreaterThan(now);
		expect(first.recurring.lastClaimKey).toBe('2026-11-12');

		expect(claimRecurringRun(first.recurring, now)).toEqual({ ok: false, reason: 'not-due' });
		const replay = claimRecurringRun({ ...first.recurring, nextAt: now - 1000 }, now);
		expect(replay).toEqual({ ok: false, reason: 'already-claimed' });
	});

	test('a run that is not due is not claimed', () => {
		const now = Date.parse('2026-11-13T03:00:00.000Z');
		expect(claimRecurringRun(sampleRecurring({ nextAt: now + 60_000 }), now)).toEqual({
			ok: false,
			reason: 'not-due'
		});
	});

	test('missed days are not claimed in a loop; nextAt jumps to the next future slot', () => {
		const now = Date.parse('2026-11-15T04:01:00.000Z');
		const result = claimRecurringRun(
			sampleRecurring({ nextAt: Date.parse('2026-11-13T04:00:00.000Z'), daysLeft: 5 }),
			now
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.recurring.daysLeft).toBe(4);
		expect(result.recurring.nextAt).toBeGreaterThan(now);
		const second = claimRecurringRun(result.recurring, now);
		expect(second.ok).toBe(false);
	});

	test('parseRecurringQueue rejects invalid payloads', () => {
		expect(parseRecurringQueue(null)).toBeNull();
		expect(
			parseRecurringQueue({
				trips: [],
				daysLeft: 3,
				time: '22:00',
				timezone: 'America/Chicago',
				nextAt: 1,
				channelId: '1'
			})
		).toBeNull();
		expect(parseRecurringQueue(sampleRecurring({ daysLeft: 6 }))).toBeNull();
		expect(parseRecurringQueue(sampleRecurring()).trips[0].count).toBe(2);
	});
});
