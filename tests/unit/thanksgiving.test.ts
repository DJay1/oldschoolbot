import { Items } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import {
	GOBBLES_PITY_OFFERS,
	isThanksgivingActive,
	rollThanksgivingOffers,
	rollThanksgivingTripParts,
	thanksgivingBankBgCL,
	thanksgivingExpectedOffersFromTrip,
	thanksgivingStaticPack
} from '@/lib/events/thanksgiving/core.js';
import { ThanksgivingItem } from '@/lib/events/thanksgiving/items.js';

const neverRng = { randInt: (_min: number, max: number) => max };
const alwaysRng = { randInt: (min: number) => min };

describe('The Straw Hat Harvest', () => {
	test('off by default', () => {
		expect(isThanksgivingActive()).toBe(false);
	});

	test('trip parts follow ~1.5x Launch pace (halved in round 3)', () => {
		const perHour = thanksgivingExpectedOffersFromTrip(60 * 60_000, { doubleLoot: false, blessing: false });
		expect(perHour).toBeGreaterThan(0.75);
		expect(perHour).toBeLessThan(1.25);
		expect(thanksgivingExpectedOffersFromTrip(9 * 60_000, { doubleLoot: false, blessing: false })).toBe(0);
		const doubled = thanksgivingExpectedOffersFromTrip(60 * 60_000, { doubleLoot: true, blessing: false });
		expect(doubled).toBeCloseTo(perHour * 2);
		const parts = rollThanksgivingTripParts({
			durationMs: 60 * 60_000,
			doubleLoot: false,
			blessing: false,
			rng: neverRng
		});
		expect(parts.amount(ThanksgivingItem.HARVEST_BUNDLE)).toBe(Math.floor(perHour * 5));
	});

	test('offer always gives the static pack, and no rares on unlucky rolls', () => {
		const res = rollThanksgivingOffers({
			quantity: 2,
			offersBefore: 0,
			offersTodayBefore: 0,
			hasHadGobbles: false,
			blessing: false,
			rng: neverRng
		});
		expect(res.loot.equals(thanksgivingStaticPack(false).multiply(2))).toBe(true);
	});

	test('Gobbles guarantee fires once at 150 and not if already had', () => {
		const at = rollThanksgivingOffers({
			quantity: 3,
			offersBefore: GOBBLES_PITY_OFFERS - 2,
			offersTodayBefore: 0,
			hasHadGobbles: false,
			blessing: false,
			rng: neverRng
		});
		expect(at.gotPityGobbles).toBe(true);
		expect(at.loot.amount(ThanksgivingItem.GOBBLES)).toBe(1);
		const had = rollThanksgivingOffers({
			quantity: 3,
			offersBefore: GOBBLES_PITY_OFFERS - 2,
			offersTodayBefore: 0,
			hasHadGobbles: true,
			blessing: false,
			rng: neverRng
		});
		expect(had.loot.amount(ThanksgivingItem.GOBBLES)).toBe(0);
	});

	test('lucky rolls give every drop; streak counted from the 4th offer', () => {
		const res = rollThanksgivingOffers({
			quantity: 2,
			offersBefore: 0,
			offersTodayBefore: 2,
			hasHadGobbles: false,
			blessing: false,
			rng: alwaysRng
		});
		expect(res.streakOffers).toBe(1);
		expect(res.loot.amount(ThanksgivingItem.LABOON)).toBe(2);
		expect(res.loot.amount(ThanksgivingItem.CORNUCOPIA_2021)).toBe(2);
	});

	test('bank backgrounds do not need Laboon', () => {
		expect(thanksgivingBankBgCL).not.toContain(ThanksgivingItem.LABOON);
		expect(thanksgivingBankBgCL).not.toContain(ThanksgivingItem.LABOON_STRAW_HAT);
		expect(thanksgivingBankBgCL).toContain(ThanksgivingItem.GOBBLE_GOBBLE);
	});

	test('parts are tradeable, hats and pets are not', () => {
		for (const id of [
			ThanksgivingItem.HARVEST_BUNDLE,
			ThanksgivingItem.WICKER_BASKET,
			ThanksgivingItem.BOUNTIFUL_CORNUCOPIA
		]) {
			expect(Items.getOrThrow(id).tradeable).toBe(true);
		}
		for (const id of [ThanksgivingItem.PILGRIM_HAT, ThanksgivingItem.GOBBLES, ThanksgivingItem.LABOON]) {
			expect(Items.getOrThrow(id).tradeable).toBe(false);
		}
	});
});
