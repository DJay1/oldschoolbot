import { Time } from '@oldschoolgg/toolkit';
import { describe, expect, test } from 'vitest';

import {
	rollThanksgivingHarvestParts,
	THANKSGIVING_HARVEST_ACTIVITY,
	THANKSGIVING_HARVEST_DISCOUNT,
	thanksgivingExpectedOffersFromTrip,
	thanksgivingHarvestExpectedParts
} from '@/lib/events/thanksgiving/core.js';
import { ThanksgivingItem } from '@/lib/events/thanksgiving/items.js';

const neverRng = { randInt: (_min: number, max: number) => max };
const plain = { doubleLoot: false, blessing: false };

describe('/thanksgiving harvest focused trip', () => {
	test('pays 70% of a normal trip, all in the chosen part', () => {
		const hour = 60 * Time.Minute;
		const offers = thanksgivingExpectedOffersFromTrip(hour, plain);
		expect(THANKSGIVING_HARVEST_DISCOUNT).toBe(0.7);
		expect(thanksgivingHarvestExpectedParts(hour, 'bundles', plain)).toBeCloseTo(offers * 0.7 * 5);
		expect(thanksgivingHarvestExpectedParts(hour, 'baskets', plain)).toBeCloseTo(offers * 0.7);
		expect(thanksgivingHarvestExpectedParts(hour, 'bundles', plain)).toBeCloseTo(3.07, 1);
		expect(thanksgivingHarvestExpectedParts(9 * Time.Minute, 'bundles', plain)).toBe(0);
	});

	test('double loot doubles it and Harvest Blessing adds 15%, like normal trips', () => {
		const hour = 60 * Time.Minute;
		const base = thanksgivingHarvestExpectedParts(hour, 'baskets', plain);
		expect(thanksgivingHarvestExpectedParts(hour, 'baskets', { doubleLoot: true, blessing: false })).toBeCloseTo(
			base * 2
		);
		expect(thanksgivingHarvestExpectedParts(hour, 'baskets', { doubleLoot: false, blessing: true })).toBeCloseTo(
			base * 1.15
		);
	});

	test('only the chosen part drops', () => {
		const bundles = rollThanksgivingHarvestParts({
			durationMs: 120 * Time.Minute,
			focus: 'bundles',
			...plain,
			rng: neverRng
		});
		expect(bundles.amount(ThanksgivingItem.WICKER_BASKET)).toBe(0);
		expect(bundles.amount(ThanksgivingItem.HARVEST_BUNDLE)).toBe(
			Math.floor(thanksgivingHarvestExpectedParts(120 * Time.Minute, 'bundles', plain))
		);
		expect(bundles.length).toBe(1);
		const baskets = rollThanksgivingHarvestParts({
			durationMs: 120 * Time.Minute,
			focus: 'baskets',
			...plain,
			rng: neverRng
		});
		expect(baskets.amount(ThanksgivingItem.HARVEST_BUNDLE)).toBe(0);
		expect(baskets.length).toBe(1);
	});

	test('reuses the retired TrickOrTreat activity type (no schema change)', () => {
		expect(THANKSGIVING_HARVEST_ACTIVITY).toBe('TrickOrTreat');
	});
});
