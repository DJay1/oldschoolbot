import { describe, expect, test } from 'vitest';

import {
	applyQueueDailyReset,
	dailyQueueAllowance,
	F2P_DAILY_QUEUE_LIMIT,
	maxQueuedTripsForPerkTier,
	utcDayStartMs
} from '@/lib/bsc/tripQueueLimits.js';
import { PerkTier } from '@/lib/constants.js';

describe('trip queue limits', () => {
	test('F2P and booster perk tiers can queue 2 trips', () => {
		expect(maxQueuedTripsForPerkTier(0)).toBe(2);
		expect(maxQueuedTripsForPerkTier(PerkTier.One)).toBe(2);
		expect(F2P_DAILY_QUEUE_LIMIT).toBe(2);
	});

	test('patron tiers match the approved trip counts', () => {
		expect(maxQueuedTripsForPerkTier(PerkTier.Two)).toBe(3);
		expect(maxQueuedTripsForPerkTier(PerkTier.Three)).toBe(6);
		expect(maxQueuedTripsForPerkTier(PerkTier.Four)).toBe(9);
		expect(maxQueuedTripsForPerkTier(PerkTier.Five)).toBe(12);
		expect(maxQueuedTripsForPerkTier(PerkTier.Six)).toBe(15);
		expect(maxQueuedTripsForPerkTier(PerkTier.Seven)).toBe(18);
	});

	test('higher numeric perk values use the top cap', () => {
		expect(maxQueuedTripsForPerkTier(99)).toBe(18);
	});

	test('only F2P has a daily allowance, reset at UTC midnight', () => {
		expect(dailyQueueAllowance(0)).toBe(2);
		expect(dailyQueueAllowance(PerkTier.One)).toBe(2);
		expect(dailyQueueAllowance(PerkTier.Two)).toBeNull();
		expect(dailyQueueAllowance(PerkTier.Seven)).toBeNull();
	});

	test('utcDayStartMs is midnight UTC of that calendar day', () => {
		expect(utcDayStartMs(Date.parse('2026-11-08T15:41:00.000Z'))).toBe(Date.parse('2026-11-08T00:00:00.000Z'));
		expect(utcDayStartMs(Date.parse('2026-11-08T00:00:00.000Z'))).toBe(Date.parse('2026-11-08T00:00:00.000Z'));
		expect(utcDayStartMs(Date.parse('2026-11-07T23:59:59.000Z'))).toBe(Date.parse('2026-11-07T00:00:00.000Z'));
	});

	test('applyQueueDailyReset clears usage after UTC midnight', () => {
		const monday = Date.parse('2026-11-09T00:00:00.000Z');
		const sundayEvening = Date.parse('2026-11-08T23:00:00.000Z');
		const stale = { dailyUsed: 2, dailyReset: utcDayStartMs(sundayEvening) };
		expect(applyQueueDailyReset(stale, sundayEvening)).toEqual(stale);
		expect(applyQueueDailyReset(stale, monday)).toEqual({ dailyUsed: 0, dailyReset: monday });
	});
});
