import { Time } from '@oldschoolgg/toolkit';
import { expect, test } from 'vitest';

import {
	cachePatronDye,
	clearPatronDyeCache,
	parsePatronDyeMode,
	patronDyeByKey,
	PATRON_DYES,
	userHasPatronDyeLock
} from '@/lib/bsc/patronDyes.js';
import { sanitizePatronFlair } from '@/lib/bsc/patronFlair.js';
import { loyaltyTierForMonths } from '@/lib/bsc/patronLoyalty.js';
import { planMonthlyPatronGrant, pointsForPaidLevel, previousUtcMonthKey, utcMonthKey } from '@/lib/bsc/patronPoints.js';
import { parsePatronTitle, PATRON_TITLES } from '@/lib/bsc/patronTitles.js';
import { BSC_PATRON_TIERS, bscPatronTripBonusMs, bscTripBonusForPerkTier } from '@/lib/bsc/patronTiers.js';
import { BitField, PerkTier } from '@/lib/constants.js';
import itemIsTradeable from '@/lib/util/itemIsTradeable.js';
import { NEW_CL_GLOW_PERK_TIER } from '@/lib/util/newClGlowColour.js';

test('Pack Leader and Biggest of Dogs trip bonuses are +18 and +20', () => {
	expect(bscPatronTripBonusMs([BitField.PatronTier5])).toBe(Time.Minute * 18);
	expect(bscPatronTripBonusMs([BitField.PatronTier6])).toBe(Time.Minute * 20);
	expect(bscTripBonusForPerkTier(PerkTier.Six)).toBe(Time.Minute * 18);
	expect(bscTripBonusForPerkTier(PerkTier.Seven)).toBe(Time.Minute * 20);
});

test('monthly points equal the tier price and are idempotent per UTC month', () => {
	expect(BSC_PATRON_TIERS.map(tier => pointsForPaidLevel(tier.level))).toEqual([3, 5, 10, 15, 25, 50]);
	const now = Date.UTC(2026, 10, 10, 12); // 2026-11-10 UTC
	const monthKey = utcMonthKey(now);
	expect(monthKey).toBe('2026-11');
	expect(previousUtcMonthKey(monthKey)).toBe('2026-10');

	const first = planMonthlyPatronGrant({
		paidLevel: 3,
		lastCreditedMonth: null,
		monthsTotal: 0,
		monthsStreak: 0,
		now
	});
	expect(first).toMatchObject({
		shouldGrant: true,
		points: 10,
		nextMonthsTotal: 1,
		nextMonthsStreak: 1,
		reason: 'monthly_grant',
		monthKey: '2026-11'
	});

	const again = planMonthlyPatronGrant({
		paidLevel: 3,
		lastCreditedMonth: '2026-11',
		monthsTotal: 1,
		monthsStreak: 1,
		now
	});
	expect(again.shouldGrant).toBe(false);
	expect(again.reason).toBe('already_granted');

	const giftOnly = planMonthlyPatronGrant({
		paidLevel: 0,
		lastCreditedMonth: null,
		monthsTotal: 2,
		monthsStreak: 2,
		now
	});
	expect(giftOnly.shouldGrant).toBe(false);
	expect(giftOnly.reason).toBe('not_paying');

	const continueStreak = planMonthlyPatronGrant({
		paidLevel: 6,
		lastCreditedMonth: '2026-10',
		monthsTotal: 4,
		monthsStreak: 4,
		now
	});
	expect(continueStreak).toMatchObject({ shouldGrant: true, points: 50, nextMonthsTotal: 5, nextMonthsStreak: 5 });

	const brokenStreak = planMonthlyPatronGrant({
		paidLevel: 2,
		lastCreditedMonth: '2026-08',
		monthsTotal: 4,
		monthsStreak: 4,
		now
	});
	expect(brokenStreak).toMatchObject({ shouldGrant: true, points: 5, nextMonthsTotal: 5, nextMonthsStreak: 1 });
});

test('loyalty badges use total or streak months', () => {
	expect(loyaltyTierForMonths(0)?.months).toBeUndefined();
	expect(loyaltyTierForMonths(1)?.months).toBe(1);
	expect(loyaltyTierForMonths(3)?.months).toBe(3);
	expect(loyaltyTierForMonths(6)?.months).toBe(6);
	expect(loyaltyTierForMonths(12)?.months).toBe(12);
	expect(loyaltyTierForMonths(2, 6)?.months).toBe(6);
});

test('flair is sanitized and titles come from the locked list', () => {
	expect(sanitizePatronFlair('  Back from a treat run  ').ok).toBe(true);
	expect(sanitizePatronFlair('hello @everyone').ok).toBe(false);
	expect(sanitizePatronFlair('see https://evil.example').ok).toBe(false);
	expect(sanitizePatronFlair('<@123> hi').ok).toBe(false);
	expect(sanitizePatronFlair('a'.repeat(81)).ok).toBe(false);
	expect(sanitizePatronFlair('clear')).toEqual({ ok: true, flair: '' });
	expect(PATRON_TITLES).toHaveLength(10);
	expect(parsePatronTitle('Fetch Master')).toBe('Fetch Master');
	expect(parsePatronTitle('clear')).toBe('clear');
	expect(parsePatronTitle('Dragon Slayer')).toBeNull();
});

test('dyed item IDs are untradeable for that user until undyed, with no refund', () => {
	clearPatronDyeCache();
	const userId = '123';
	const itemID = 4587; // Dragon scimitar
	expect(userHasPatronDyeLock(userId, itemID)).toBe(false);
	expect(itemIsTradeable(itemID, true, userId)).toBe(true);

	cachePatronDye(userId, { itemID, dyeKey: 'golden', mode: 'recolour_glow' });
	expect(userHasPatronDyeLock(userId, itemID)).toBe(true);
	expect(itemIsTradeable(itemID, true, userId)).toBe(false);
	expect(itemIsTradeable(itemID, true, 'someone-else')).toBe(true);

	clearPatronDyeCache(userId);
	expect(userHasPatronDyeLock(userId, itemID)).toBe(false);
	expect(itemIsTradeable(itemID, true, userId)).toBe(true);
});

test('patron dye catalog matches the shop prices and sparkle rules', () => {
	expect(PATRON_DYES.map(dye => [dye.itemID, dye.points, dye.sparkles])).toEqual([
		[74_014, 5, false],
		[74_015, 8, false],
		[74_016, 12, false],
		[74_017, 18, true],
		[74_018, 25, true]
	]);
	expect(patronDyeByKey('Midnight Pup')?.key).toBe('midnight');
	expect(patronDyeByKey('golden corgo')?.sparkles).toBe(true);
	expect(parsePatronDyeMode('recolor+glow')).toBe('recolour_glow');
	expect(NEW_CL_GLOW_PERK_TIER).toBe(PerkTier.Five);
});
