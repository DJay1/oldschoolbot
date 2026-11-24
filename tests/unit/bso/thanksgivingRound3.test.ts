import { Time } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import {
	CAPTAIN_LABOON_YIELD_PERCENT,
	LABOON_SPEED_MULTIPLIER,
	OFFER_RATES,
	offerOddsDenominator,
	parseOfferQuantity,
	STRAW_HAT_SPEED_PERCENT,
	STRAW_HAT_YIELD_PERCENT,
	thanksgivingFishingBoosts
} from '@/lib/events/thanksgiving/core.js';
import {
	feastOverlapFraction,
	HARVEST_FEAST_MAX_MINUTES,
	HARVEST_FEAST_MIN_MINUTES,
	harvestFeastBonusLoot,
	rollTurkeyOffer
} from '@/lib/events/thanksgiving/feast.js';
import { ThanksgivingItem } from '@/lib/events/thanksgiving/items.js';

const maxRng = { randInt: (_min: number, max: number) => max };
const minRng = { randInt: (min: number) => min };

function gear(pet: number | null, worn: number[] = []) {
	return {
		usingPet: (id: number) => id === pet,
		hasEquipped: (id: number) => worn.includes(id)
	};
}

describe('Straw Hat Harvest round 3', () => {
	test('Captain Laboon yield: 3% Straw hat + 7% Captain Laboon = 10%', () => {
		const captain = thanksgivingFishingBoosts(gear(ThanksgivingItem.LABOON_STRAW_HAT));
		expect(captain.yieldPercent).toBe(STRAW_HAT_YIELD_PERCENT + CAPTAIN_LABOON_YIELD_PERCENT);
		expect(captain.yieldPercent).toBe(10);
		expect(captain.speedMultiplier).toBeCloseTo(LABOON_SPEED_MULTIPLIER * (1 + STRAW_HAT_SPEED_PERCENT / 100));
		expect(captain.usingLaboon).toBe(true);
		expect(captain.yieldLabel).toBe('Captain Laboon and the Straw hat');
		expect(captain.lines).toEqual([
			`${LABOON_SPEED_MULTIPLIER}x faster, +${STRAW_HAT_SPEED_PERCENT}% fishing speed and +${STRAW_HAT_YIELD_PERCENT + CAPTAIN_LABOON_YIELD_PERCENT}% fishing yield (Captain Laboon)`
		]);
		// Plain Laboon with a worn Straw hat keeps the old 3%.
		const plain = thanksgivingFishingBoosts(gear(ThanksgivingItem.LABOON, [ThanksgivingItem.STRAW_HAT]));
		expect(plain.yieldPercent).toBe(STRAW_HAT_YIELD_PERCENT);
		expect(plain.speedMultiplier).toBeCloseTo(captain.speedMultiplier);
		expect(plain.usingLaboon).toBe(true);
		expect(plain.yieldLabel).toBe('the Straw hat');
		expect(plain.lines).toEqual([
			`${LABOON_SPEED_MULTIPLIER}x faster for Laboon`,
			`+${STRAW_HAT_SPEED_PERCENT}% fishing speed and +${STRAW_HAT_YIELD_PERCENT}% fishing yield (Straw hat)`
		]);
	});

	test('Captain Laboon fishing boost lines and numbers for every combination', () => {
		const none = thanksgivingFishingBoosts(gear(null));
		expect(none.speedMultiplier).toBe(1);
		expect(none.yieldPercent).toBe(0);
		expect(none.usingLaboon).toBe(false);
		expect(none.yieldLabel).toBe('the Straw hat');
		expect(none.lines).toEqual([]);

		const laboon = thanksgivingFishingBoosts(gear(ThanksgivingItem.LABOON));
		expect(laboon.speedMultiplier).toBe(LABOON_SPEED_MULTIPLIER);
		expect(laboon.yieldPercent).toBe(0);
		expect(laboon.usingLaboon).toBe(true);
		expect(laboon.yieldLabel).toBe('the Straw hat');
		expect(laboon.lines).toEqual([`${LABOON_SPEED_MULTIPLIER}x faster for Laboon`]);

		const hat = thanksgivingFishingBoosts(gear(null, [ThanksgivingItem.STRAW_HAT]));
		expect(hat.speedMultiplier).toBeCloseTo(1 + STRAW_HAT_SPEED_PERCENT / 100);
		expect(hat.yieldPercent).toBe(STRAW_HAT_YIELD_PERCENT);
		expect(hat.usingLaboon).toBe(false);
		expect(hat.yieldLabel).toBe('the Straw hat');
		expect(hat.lines).toEqual([
			`+${STRAW_HAT_SPEED_PERCENT}% fishing speed and +${STRAW_HAT_YIELD_PERCENT}% fishing yield (Straw hat)`
		]);

		const captain = thanksgivingFishingBoosts(gear(ThanksgivingItem.LABOON_STRAW_HAT));
		expect(captain.speedMultiplier).toBeCloseTo(LABOON_SPEED_MULTIPLIER * (1 + STRAW_HAT_SPEED_PERCENT / 100));
		expect(captain.yieldPercent).toBe(STRAW_HAT_YIELD_PERCENT + CAPTAIN_LABOON_YIELD_PERCENT);
		expect(captain.usingLaboon).toBe(true);
		expect(captain.yieldLabel).toBe('Captain Laboon and the Straw hat');
		expect(captain.lines).toEqual([
			`${LABOON_SPEED_MULTIPLIER}x faster, +${STRAW_HAT_SPEED_PERCENT}% fishing speed and +${STRAW_HAT_YIELD_PERCENT + CAPTAIN_LABOON_YIELD_PERCENT}% fishing yield (Captain Laboon)`
		]);

		const captainAndHat = thanksgivingFishingBoosts(
			gear(ThanksgivingItem.LABOON_STRAW_HAT, [ThanksgivingItem.STRAW_HAT])
		);
		expect(captainAndHat.speedMultiplier).toBeCloseTo(
			LABOON_SPEED_MULTIPLIER * (1 + (STRAW_HAT_SPEED_PERCENT / 100) * 2)
		);
		expect(captainAndHat.yieldPercent).toBe(STRAW_HAT_YIELD_PERCENT * 2 + CAPTAIN_LABOON_YIELD_PERCENT);
		expect(captainAndHat.usingLaboon).toBe(true);
		expect(captainAndHat.yieldLabel).toBe('Captain Laboon and the Straw hat');
		expect(captainAndHat.lines).toEqual([
			`${LABOON_SPEED_MULTIPLIER}x faster, +${STRAW_HAT_SPEED_PERCENT}% fishing speed and +${STRAW_HAT_YIELD_PERCENT + CAPTAIN_LABOON_YIELD_PERCENT}% fishing yield (Captain Laboon)`,
			`+${STRAW_HAT_SPEED_PERCENT}% fishing speed and +${STRAW_HAT_YIELD_PERCENT}% fishing yield (Straw hat)`
		]);

		// Fishing and aerial fishing both print these lines in a **Boosts:** join.
		const boostsText = `**Boosts:** ${captainAndHat.lines.join(', ')}.`;
		expect(boostsText.length).toBeLessThanOrEqual(2000 - 150);
	});

	test('Harvest turkey odds: 1/50, Gobble Streak and Harvest Blessing both apply', () => {
		expect(OFFER_RATES.turkey).toBe(50);
		expect(offerOddsDenominator('turkey', { streak: false, blessing: false })).toBe(50);
		expect(offerOddsDenominator('turkey', { streak: true, blessing: false })).toBe(43);
		expect(offerOddsDenominator('turkey', { streak: false, blessing: true })).toBe(43);
		expect(offerOddsDenominator('turkey', { streak: true, blessing: true })).toBe(38);
	});

	test('turkey feast roll: loot or XP, 10-30 minutes on a success', () => {
		const a = rollTurkeyOffer(minRng, null, 1_000_000);
		if (a.outcome !== 'new') throw new Error('expected new feast');
		expect(a.feast.kind).toBe('loot');
		expect(a.feast.endMs - a.feast.startMs).toBe(HARVEST_FEAST_MIN_MINUTES * Time.Minute);
		// maxRng fails the 1 in 3 roll, so check the max duration with a success-then-max rng.
		let first = true;
		const successThenMax = {
			randInt: (min: number, max: number) => {
				if (first) {
					first = false;
					return min;
				}
				return max;
			}
		};
		const b = rollTurkeyOffer(successThenMax, null, 1_000_000);
		if (b.outcome !== 'new') throw new Error('expected new feast');
		expect(b.feast.kind).toBe('xp');
		expect(b.feast.endMs - b.feast.startMs).toBe(HARVEST_FEAST_MAX_MINUTES * Time.Minute);
	});

	test('feast only boosts the part of the trip inside the window', () => {
		const feast = { kind: 'loot' as const, startMs: 0, endMs: 15 * Time.Minute };
		// Whole trip inside.
		expect(feastOverlapFraction(feast, 10 * Time.Minute, 10 * Time.Minute)).toBe(1);
		// 3 hour trip started at the feast start: only 15 of 180 minutes.
		expect(feastOverlapFraction(feast, 180 * Time.Minute, 180 * Time.Minute)).toBeCloseTo(15 / 180);
		// Long trip that started before the feast and returned 5 minutes in: 5 of 60 minutes.
		expect(feastOverlapFraction(feast, 5 * Time.Minute, 60 * Time.Minute)).toBeCloseTo(5 / 60);
		// Trip after the feast ended.
		expect(feastOverlapFraction(feast, 60 * Time.Minute, 20 * Time.Minute)).toBe(0);
		expect(feastOverlapFraction(null, 10, 10)).toBe(0);
		expect(feastOverlapFraction(feast, 10, 0)).toBe(0);
	});

	test('feast bonus loot skips event items and untradeables, scales by overlap', () => {
		const loot = new Bank()
			.add('Raw rocktail', 1000)
			.add('Coins', 500)
			.add(ThanksgivingItem.LABOON)
			.add(ThanksgivingItem.HARVEST_TURKEY, 3)
			.add(ThanksgivingItem.HARVEST_BUNDLE, 10)
			.add('Heron')
			.add('Fire cape');
		const full = harvestFeastBonusLoot(loot, 1, maxRng);
		expect(full.amount('Raw rocktail')).toBe(1000);
		expect(full.amount('Coins')).toBe(500);
		for (const id of [ThanksgivingItem.LABOON, ThanksgivingItem.HARVEST_TURKEY, ThanksgivingItem.HARVEST_BUNDLE]) {
			expect(full.amount(id)).toBe(0);
		}
		expect(full.amount('Heron')).toBe(0);
		expect(full.amount('Fire cape')).toBe(0);
		// Quarter overlap: 250 rocktail; remainder rolls never exceed the fraction.
		const quarter = harvestFeastBonusLoot(new Bank().add('Raw rocktail', 1001), 0.25, maxRng);
		expect(quarter.amount('Raw rocktail')).toBe(250);
		expect(harvestFeastBonusLoot(loot, 0, maxRng).length).toBe(0);
		// Never more than 2x total, even with a bad fraction.
		expect(harvestFeastBonusLoot(new Bank().add('Raw rocktail', 10), 5, maxRng).amount('Raw rocktail')).toBe(10);
	});

	test("offer quantity: blank or 'all' means everything, numbers are whole and positive", () => {
		expect(parseOfferQuantity(undefined)).toBe('all');
		expect(parseOfferQuantity(null)).toBe('all');
		expect(parseOfferQuantity('')).toBe('all');
		expect(parseOfferQuantity(' ALL ')).toBe('all');
		expect(parseOfferQuantity('25')).toBe(25);
		expect(parseOfferQuantity('1,000')).toBe(1000);
		expect(parseOfferQuantity(7)).toBe(7);
		for (const bad of ['0', '-3', '1.5', 'abc', '1e3', '99999999999999999999']) {
			expect(parseOfferQuantity(bad)).toBeNull();
		}
		expect(parseOfferQuantity(0)).toBeNull();
	});
});
