import { describe, expect, test } from 'vitest';

import {
	applyQueueDailyReset,
	dailyQueueAllowance,
	F2P_QUEUE_LIMIT,
	maxQueuedTripsForPerkTier,
	nextQueueResetMs,
	QUEUE_RESET_HOUR,
	QUEUE_RESET_MS,
	QUEUE_RESET_TIMEZONE,
	queuePeriodStartMs,
	queueRefillDisplayMs,
	queueResetAtMs,
	refundUnstartedTrips,
	startQueueWindowIfNeeded
} from '@/lib/bsc/tripQueueLimits.js';
import { PerkTier } from '@/lib/constants.js';

describe('trip queue limits', () => {
	test('F2P and booster perk tiers can queue 2 trips', () => {
		expect(maxQueuedTripsForPerkTier(0)).toBe(2);
		expect(maxQueuedTripsForPerkTier(PerkTier.One)).toBe(2);
		expect(F2P_QUEUE_LIMIT).toBe(2);
	});

	test('each patron tier adds one trip', () => {
		expect(maxQueuedTripsForPerkTier(PerkTier.Two)).toBe(3);
		expect(maxQueuedTripsForPerkTier(PerkTier.Three)).toBe(4);
		expect(maxQueuedTripsForPerkTier(PerkTier.Four)).toBe(5);
		expect(maxQueuedTripsForPerkTier(PerkTier.Five)).toBe(6);
		expect(maxQueuedTripsForPerkTier(PerkTier.Six)).toBe(7);
		expect(maxQueuedTripsForPerkTier(PerkTier.Seven)).toBe(8);
		expect(maxQueuedTripsForPerkTier(99)).toBe(8);
	});

	test('everyone has an allowance equal to their cap', () => {
		expect(dailyQueueAllowance(0)).toBe(2);
		expect(dailyQueueAllowance(PerkTier.Seven)).toBe(8);
	});

	const at = (iso: string) => Date.parse(iso);

	test('the queue day starts at the most recent 8 PM Central', () => {
		// Sat Nov 14 2026, 7 AM CST -> day started Fri Nov 13, 8 PM CST (02:00Z).
		expect(queuePeriodStartMs(at('2026-11-14T13:00:00.000Z'))).toBe(at('2026-11-14T02:00:00.000Z'));
		expect(nextQueueResetMs(at('2026-11-14T13:00:00.000Z'))).toBe(at('2026-11-15T02:00:00.000Z'));
		// Exactly 8 PM starts a new day; one ms before is still the old one.
		expect(queuePeriodStartMs(at('2026-11-15T02:00:00.000Z'))).toBe(at('2026-11-15T02:00:00.000Z'));
		expect(queuePeriodStartMs(at('2026-11-15T01:59:59.999Z'))).toBe(at('2026-11-14T02:00:00.000Z'));
		expect(QUEUE_RESET_TIMEZONE).toBe('America/Chicago');
		expect(QUEUE_RESET_HOUR).toBe(20);
	});

	test('8 PM Central follows daylight saving (CDT is 01:00Z, CST is 02:00Z)', () => {
		// Summer: 8 PM CDT.
		expect(nextQueueResetMs(at('2027-07-01T12:00:00.000Z'))).toBe(at('2027-07-02T01:00:00.000Z'));
		// Spring forward (Sun Mar 14 2027): a 23 hour queue day.
		expect(queuePeriodStartMs(at('2027-03-14T12:00:00.000Z'))).toBe(at('2027-03-14T02:00:00.000Z'));
		expect(nextQueueResetMs(at('2027-03-14T12:00:00.000Z'))).toBe(at('2027-03-15T01:00:00.000Z'));
		// Fall back (Sun Nov 7 2027): a 25 hour queue day.
		expect(queuePeriodStartMs(at('2027-11-07T12:00:00.000Z'))).toBe(at('2027-11-07T01:00:00.000Z'));
		expect(nextQueueResetMs(at('2027-11-07T12:00:00.000Z'))).toBe(at('2027-11-08T02:00:00.000Z'));
	});

	test('queueResetAtMs is the next 8 PM Central after the stored day start', () => {
		const dayStart = at('2026-11-14T02:00:00.000Z');
		expect(queueResetAtMs(dayStart)).toBe(at('2026-11-15T02:00:00.000Z'));
		expect(queueResetAtMs(0)).toBe(0);
		// Rows saved under the old personal 24h window refill at the next 8 PM CT, never later than before.
		const legacyWindow = at('2026-11-13T21:00:00.000Z');
		expect(queueResetAtMs(legacyWindow)).toBe(at('2026-11-14T02:00:00.000Z'));
		expect(queueResetAtMs(legacyWindow)).toBeLessThanOrEqual(legacyWindow + QUEUE_RESET_MS);
	});

	test('applyQueueDailyReset keeps usage until 8 PM Central, then clears it', () => {
		const dayStart = at('2026-11-14T02:00:00.000Z');
		const used = { dailyUsed: 2, dailyReset: dayStart };
		expect(applyQueueDailyReset(used, at('2026-11-15T01:59:59.999Z'))).toEqual(used);
		expect(applyQueueDailyReset(used, at('2026-11-15T02:00:00.000Z'))).toEqual({ dailyUsed: 0, dailyReset: 0 });
	});

	test('applyQueueDailyReset does not start a new window just by viewing', () => {
		const now = at('2026-11-09T12:00:00.000Z');
		expect(applyQueueDailyReset({ dailyUsed: 0, dailyReset: 0 }, now)).toEqual({ dailyUsed: 0, dailyReset: 0 });
		expect(applyQueueDailyReset({ dailyUsed: 3, dailyReset: 0 }, now)).toEqual({ dailyUsed: 0, dailyReset: 0 });
	});

	test('startQueueWindowIfNeeded ties usage to the current queue day', () => {
		const now = at('2026-11-14T13:00:00.000Z');
		const dayStart = at('2026-11-14T02:00:00.000Z');
		expect(startQueueWindowIfNeeded({ dailyUsed: 0, dailyReset: 0 }, now)).toEqual({
			dailyUsed: 0,
			dailyReset: dayStart
		});
		expect(startQueueWindowIfNeeded({ dailyUsed: 2, dailyReset: dayStart }, now)).toEqual({
			dailyUsed: 2,
			dailyReset: dayStart
		});
		const yesterday = at('2026-11-13T02:00:00.000Z');
		expect(startQueueWindowIfNeeded({ dailyUsed: 2, dailyReset: yesterday }, now)).toEqual({
			dailyUsed: 0,
			dailyReset: dayStart
		});
	});

	test('usage clears at most once per queue day, including across DST and the switchover', () => {
		const cap = 2;
		const runs: [string, string, number][] = [
			['2026-11-12T00:00:00.000Z', '2026-11-20T00:00:00.000Z', 15],
			['2027-03-10T00:00:00.000Z', '2027-03-18T00:00:00.000Z', 7],
			['2027-11-03T00:00:00.000Z', '2027-11-11T00:00:00.000Z', 11]
		];
		for (const [from, to, stepMinutes] of runs) {
			// Start from an old-style personal window mid-day.
			let row = { dailyUsed: cap, dailyReset: at(from) - 3 * 60 * 60 * 1000 };
			const granted = new Map<number, number>();
			for (let now = at(from); now < at(to); now += stepMinutes * 60 * 1000) {
				row = startQueueWindowIfNeeded(row, now);
				const period = queuePeriodStartMs(now);
				expect(row.dailyReset).toBeLessThanOrEqual(now);
				expect(now).toBeLessThan(queueResetAtMs(row.dailyReset));
				while (row.dailyUsed < cap) {
					row = { ...row, dailyUsed: row.dailyUsed + 1 };
					granted.set(period, (granted.get(period) ?? 0) + 1);
				}
			}
			for (const count of granted.values()) expect(count).toBeLessThanOrEqual(cap);
		}
	});

	test('the refill time shown to players is always a future 8 PM Central', () => {
		const now = at('2026-11-14T13:00:00.000Z');
		expect(queueRefillDisplayMs(0, now)).toBe(at('2026-11-15T02:00:00.000Z'));
		expect(queueRefillDisplayMs(at('2026-11-14T02:00:00.000Z'), now)).toBe(at('2026-11-15T02:00:00.000Z'));
		expect(queueRefillDisplayMs(at('2026-11-12T02:00:00.000Z'), now)).toBe(at('2026-11-15T02:00:00.000Z'));
	});
});
describe('refundUnstartedTrips', () => {
	test('returns unused remaining trips to the allowance', () => {
		const result = refundUnstartedTrips({
			trip: { activityId: 1470, type: 'MonsterKilling' },
			remaining: 5,
			dailyUsed: 5
		});
		expect(result.refunded).toBe(5);
		expect(result.state).toEqual({
			trip: { activityId: 1470, type: 'MonsterKilling' },
			remaining: 0,
			dailyUsed: 0
		});
	});

	test('does not drop the allowance below zero', () => {
		const result = refundUnstartedTrips({ remaining: 3, dailyUsed: 1 });
		expect(result.refunded).toBe(3);
		expect(result.state.remaining).toBe(0);
		expect(result.state.dailyUsed).toBe(0);
	});

	test('refunds nothing when the queue is empty', () => {
		const result = refundUnstartedTrips({ remaining: 0, dailyUsed: 2, trip: null });
		expect(result.refunded).toBe(0);
		expect(result.state.dailyUsed).toBe(2);
	});
});
