import { describe, expect, test } from 'vitest';

import {
	applyQueueDailyReset,
	dailyQueueAllowance,
	F2P_QUEUE_LIMIT,
	maxQueuedTripsForPerkTier,
	QUEUE_RESET_MS,
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

	test('queueResetAtMs is the personal window start plus the reset interval', () => {
		const start = Date.parse('2026-11-08T15:41:00.000Z');
		expect(queueResetAtMs(start)).toBe(start + QUEUE_RESET_MS);
		expect(queueResetAtMs(0)).toBe(0);
	});

	test('applyQueueDailyReset honors a stored personal window and clears it when it expires', () => {
		const start = Date.parse('2026-11-08T15:41:00.000Z');
		const stale = { dailyUsed: 2, dailyReset: start };
		expect(applyQueueDailyReset(stale, start + QUEUE_RESET_MS - 1)).toEqual(stale);
		expect(applyQueueDailyReset(stale, start + QUEUE_RESET_MS)).toEqual({
			dailyUsed: 0,
			dailyReset: 0
		});
	});

	test('applyQueueDailyReset does not start a new window just by viewing', () => {
		const now = Date.parse('2026-11-09T12:00:00.000Z');
		expect(applyQueueDailyReset({ dailyUsed: 0, dailyReset: 0 }, now)).toEqual({
			dailyUsed: 0,
			dailyReset: 0
		});
		expect(applyQueueDailyReset({ dailyUsed: 3, dailyReset: 0 }, now)).toEqual({
			dailyUsed: 0,
			dailyReset: 0
		});
	});

	test('startQueueWindowIfNeeded starts a personal window on use', () => {
		const now = Date.parse('2026-11-09T12:00:00.000Z');
		expect(startQueueWindowIfNeeded({ dailyUsed: 0, dailyReset: 0 }, now)).toEqual({
			dailyUsed: 0,
			dailyReset: now
		});
		const start = now - 1000;
		expect(startQueueWindowIfNeeded({ dailyUsed: 2, dailyReset: start }, now)).toEqual({
			dailyUsed: 2,
			dailyReset: start
		});
		const expired = now - QUEUE_RESET_MS;
		expect(startQueueWindowIfNeeded({ dailyUsed: 2, dailyReset: expired }, now)).toEqual({
			dailyUsed: 0,
			dailyReset: now
		});
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
