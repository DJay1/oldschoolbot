import { describe, expect, test } from 'vitest';

import {
	appendQueuedTrips,
	buildRecurringQueueTemplate,
	claimRecurringRun,
	clampRecurringTemplateToDailyCap,
	dequeueQueuedTrip,
	formatRecurringScheduleConfirmation,
	isValidQueueLocalTime,
	MAX_RECURRING_QUEUE_DAYS,
	nextQueueScheduleAt,
	parseQueuedTrips,
	parseRecurringDays,
	parseRecurringQueue,
	planRecurringEnqueue,
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
		expect(parseRecurringQueue(sampleRecurring())?.trips[0].count).toBe(2);
	});
});

describe('recurring schedule template', () => {
	const queuedEight = [{ activityId: 20294, type: 'AerialFishing', count: 8 }];
	const addedEight = { activityId: 20294, type: 'AerialFishing', count: 8 };

	test('a named daily count replaces the current queue instead of stacking on it', () => {
		expect(buildRecurringQueueTemplate(queuedEight, addedEight)).toEqual([addedEight]);
	});

	test('omitting a trip uses the current queue as the daily plan', () => {
		expect(buildRecurringQueueTemplate(queuedEight)).toEqual(queuedEight);
		expect(buildRecurringQueueTemplate(queuedEight, null)).toEqual(queuedEight);
	});

	test('an empty queue with a named trip still builds a plan', () => {
		expect(buildRecurringQueueTemplate([], addedEight)).toEqual([addedEight]);
	});

	test('clamps a plan that is larger than the daily cap', () => {
		const result = clampRecurringTemplateToDailyCap([{ ...addedEight, count: 16 }], 8);
		expect(result.requested).toBe(16);
		expect(result.stored).toBe(8);
		expect(result.trips).toEqual([{ activityId: 20294, type: 'AerialFishing', count: 8 }]);
	});

	test('clamps mixed trips in order and drops the overflow', () => {
		const result = clampRecurringTemplateToDailyCap(
			[
				{ activityId: 1, type: 'Woodcutting', count: 5 },
				{ activityId: 2, type: 'Fishing', count: 5 }
			],
			8
		);
		expect(result.requested).toBe(10);
		expect(result.stored).toBe(8);
		expect(result.trips).toEqual([
			{ activityId: 1, type: 'Woodcutting', count: 5 },
			{ activityId: 2, type: 'Fishing', count: 3 }
		]);
	});
});

describe('planRecurringEnqueue anti-exploit', () => {
	test('a 16-trip plan cannot enqueue more than the daily cap or queue room', () => {
		const planned = planRecurringEnqueue([{ activityId: 20294, type: 'AerialFishing', count: 16 }], 8, 8);
		expect(planned).toEqual([{ activityId: 20294, type: 'AerialFishing', count: 8 }]);
		expect(planned.reduce((sum, trip) => sum + trip.count, 0)).toBe(8);
	});

	test('enqueue cannot add trips when the daily allowance is already used', () => {
		expect(planRecurringEnqueue([{ activityId: 1, type: 'AerialFishing', count: 8 }], 0, 8)).toEqual([]);
	});

	test('enqueue cannot overflow an already full queue', () => {
		expect(planRecurringEnqueue([{ activityId: 1, type: 'AerialFishing', count: 8 }], 8, 0)).toEqual([]);
	});
});

describe('formatRecurringScheduleConfirmation', () => {
	const DISCORD_MESSAGE_LIMIT = 2000;
	const LENGTH_BUFFER = 150;
	const base = {
		trips: [{ activityId: 20294, type: 'AerialFishing', count: 8, label: 'Aerial Fishing' }],
		timeLabel: '10 PM CT',
		scheduledAt: 1795752000000,
		days: 5,
		refunded: 8
	};

	test('says each day and the total, and does not report a stacked 16', () => {
		const msg = formatRecurringScheduleConfirmation(base);
		expect(msg).toContain('Scheduled 8 Aerial Fishing trips each day at 10 PM CT');
		expect(msg).toContain('for 5 days (40 trips total)');
		expect(msg).toContain('Your current queue was refunded so those trips are not started twice.');
		expect(msg).not.toContain('16 Aerial');
		expect(msg).not.toContain('to start daily');
	});

	test('explains when the daily cap cuts the plan down', () => {
		const msg = formatRecurringScheduleConfirmation({
			...base,
			requestedPerDay: 16,
			dailyCap: 8
		});
		expect(msg).toContain(
			'You asked for 16 trips per day, but only 8 can start each day because of your daily queue limit.'
		);
	});

	test('worst-case confirmation stays 150 under the Discord message limit', () => {
		const longName = 'A'.repeat(100);
		const trips = Array.from({ length: 8 }, (_, index) => ({
			activityId: index + 1,
			type: 'MonsterKilling',
			count: 1,
			label: `${longName} ${index + 1}`
		}));
		const msg = formatRecurringScheduleConfirmation({
			trips,
			timeLabel: '12 AM Chamorro Time',
			scheduledAt: Date.parse('2099-12-31T23:59:59.000Z'),
			days: 5,
			refunded: 8,
			replacedRecurring: true,
			requestedPerDay: 18,
			dailyCap: 8
		});
		expect(msg.length).toBeLessThanOrEqual(DISCORD_MESSAGE_LIMIT - LENGTH_BUFFER);
	});
});
