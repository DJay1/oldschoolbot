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
const alwaysRng = { randInt: (min: number) => min };
const plain = { doubleLoot: false, blessing: false };

describe('/thanksgiving harvest focused trip', () => {
	test('pays 70% of a normal trip in bundle-equivalents (1 basket = 5 bundles), all in the chosen part', () => {
		const hour = 60 * Time.Minute;
		const offers = thanksgivingExpectedOffersFromTrip(hour, plain);
		expect(THANKSGIVING_HARVEST_DISCOUNT).toBe(0.7);
		expect(thanksgivingHarvestExpectedParts(hour, 'bundles', plain)).toBeCloseTo(offers * 0.7 * 10);
		expect(thanksgivingHarvestExpectedParts(hour, 'baskets', plain)).toBeCloseTo(offers * 0.7 * 2);
		// More of the chosen part than a normal trip gives (5 bundles / 1 basket per offer-worth).
		expect(thanksgivingHarvestExpectedParts(hour, 'bundles', plain)).toBeGreaterThan(offers * 5);
		expect(thanksgivingHarvestExpectedParts(hour, 'baskets', plain)).toBeGreaterThan(offers);
		// But less total value than a normal trip (10 bundle-equivalents per offer-worth).
		expect(thanksgivingHarvestExpectedParts(hour, 'bundles', plain)).toBeLessThan(offers * 10);
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

	test('only the chosen part drops; amount is random 50%-150% of expected, never negative', () => {
		const d = 120 * Time.Minute;
		const expected = thanksgivingHarvestExpectedParts(d, 'bundles', plain);
		// max rng: 150% spread, remainder roll fails -> floor(1.5x)
		const high = rollThanksgivingHarvestParts({ durationMs: d, focus: 'bundles', ...plain, rng: neverRng });
		expect(high.amount(ThanksgivingItem.WICKER_BASKET)).toBe(0);
		expect(high.amount(ThanksgivingItem.HARVEST_BUNDLE)).toBe(Math.floor(expected * 1.5));
		expect(high.length).toBe(1);
		// min rng: 50% spread, remainder roll succeeds -> ceil(0.5x)
		const low = rollThanksgivingHarvestParts({ durationMs: d, focus: 'bundles', ...plain, rng: alwaysRng });
		expect(low.amount(ThanksgivingItem.HARVEST_BUNDLE)).toBe(Math.ceil(expected * 0.5));
		const baskets = rollThanksgivingHarvestParts({ durationMs: d, focus: 'baskets', ...plain, rng: neverRng });
		expect(baskets.amount(ThanksgivingItem.HARVEST_BUNDLE)).toBe(0);
		expect(baskets.length).toBe(1);
		expect(
			rollThanksgivingHarvestParts({ durationMs: 9 * Time.Minute, focus: 'baskets', ...plain, rng: alwaysRng })
				.length
		).toBe(0);
	});

	test('the mean of the random amount equals the expectation', () => {
		const d = 45 * Time.Minute;
		for (const focus of ['bundles', 'baskets'] as const) {
			const expected = thanksgivingHarvestExpectedParts(d, focus, plain);
			let seed = 12345;
			const rng = {
				randInt: (min: number, max: number) => {
					seed = (seed * 1103515245 + 12345) % 2147483648;
					return min + (seed % (max - min + 1));
				}
			};
			let total = 0;
			const n = 20000;
			for (let i = 0; i < n; i++) {
				const loot = rollThanksgivingHarvestParts({ durationMs: d, focus, ...plain, rng });
				total += loot.amount(
					focus === 'bundles' ? ThanksgivingItem.HARVEST_BUNDLE : ThanksgivingItem.WICKER_BASKET
				);
			}
			expect(total / n).toBeGreaterThan(expected * 0.97);
			expect(total / n).toBeLessThan(expected * 1.03);
		}
	});

	test('reuses the retired TrickOrTreat activity type (no schema change)', () => {
		expect(THANKSGIVING_HARVEST_ACTIVITY).toBe('TrickOrTreat');
	});
});
