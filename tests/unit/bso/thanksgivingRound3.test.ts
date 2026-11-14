import { Time } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import {
	CAPTAIN_LABOON_YIELD_PERCENT,
	OFFER_RATES,
	offerOddsDenominator,
	parseOfferQuantity,
	STRAW_HAT_YIELD_PERCENT,
	thanksgivingFishingBoosts
} from '@/lib/events/thanksgiving/core.js';
import {
	feastOverlapFraction,
	HARVEST_FEAST_MAX_MINUTES,
	HARVEST_FEAST_MIN_MINUTES,
	harvestFeastBonusLoot,
	rollHarvestFeast
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
		expect(captain.lines).toContain('+7% fishing yield (Captain Laboon)');
		// Plain Laboon with a worn Straw hat keeps the old 3%.
		const plain = thanksgivingFishingBoosts(gear(ThanksgivingItem.LABOON, [ThanksgivingItem.STRAW_HAT]));
		expect(plain.yieldPercent).toBe(STRAW_HAT_YIELD_PERCENT);
		expect(plain.speedMultiplier).toBeCloseTo(captain.speedMultiplier);
	});

	test('Harvest turkey odds: 1/50, Gobble Streak and Harvest Blessing both apply', () => {
		expect(OFFER_RATES.turkey).toBe(50);
		expect(offerOddsDenominator('turkey', { streak: false, blessing: false })).toBe(50);
		expect(offerOddsDenominator('turkey', { streak: true, blessing: false })).toBe(43);
		expect(offerOddsDenominator('turkey', { streak: false, blessing: true })).toBe(43);
		expect(offerOddsDenominator('turkey', { streak: true, blessing: true })).toBe(38);
	});

	test('feast roll: loot or XP, 15-60 minutes', () => {
		const a = rollHarvestFeast(minRng, 1_000_000);
		expect(a.kind).toBe('loot');
		expect(a.endMs - a.startMs).toBe(HARVEST_FEAST_MIN_MINUTES * Time.Minute);
		const b = rollHarvestFeast(maxRng, 1_000_000);
		expect(b.kind).toBe('xp');
		expect(b.endMs - b.startMs).toBe(HARVEST_FEAST_MAX_MINUTES * Time.Minute);
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
