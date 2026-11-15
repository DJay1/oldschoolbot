import { Bank, Items } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { discontinuedCollections } from '@/lib/data/Collections.js';
import { Eatables } from '@/lib/data/eatables.js';
import { rollThanksgivingOffers, thanksgivingCL, thanksgivingStaticPack } from '@/lib/events/thanksgiving/core.js';
import { ThanksgivingItem } from '@/lib/events/thanksgiving/items.js';
import { sellPriceOfItem } from '@/mahoji/commands/sell.js';

function seededRng(seed: number) {
	let s = seed >>> 0;
	return {
		randInt(min: number, max: number) {
			s = (Math.imul(s, 1_664_525) + 1_013_904_223) >>> 0;
			return min + (s % (max - min + 1));
		}
	};
}

describe('Thanksgiving offers without a per-command cap', () => {
	test('supply pack swaps Lobster for Raw karambwan', () => {
		const pack = thanksgivingStaticPack(false);
		expect(pack.amount('Lobster')).toBe(0);
		expect(pack.amount('Raw karambwan')).toBe(6);
		expect(thanksgivingStaticPack(true).amount('Raw karambwan')).toBe(6);
		// Turkey is a rare roll now, not part of the supply pack.
		expect(pack.amount(ThanksgivingItem.HARVEST_TURKEY)).toBe(0);
	});

	test('karambwan supplies are not worth more on /sell than the lobsters they replace', () => {
		const lobster = sellPriceOfItem(Items.getOrThrow('Lobster')).price * 15;
		const karambwan = sellPriceOfItem(Items.getOrThrow('Raw karambwan')).price * 6;
		expect(karambwan).toBeLessThanOrEqual(lobster);
	});

	test('batch pack equals one pack per offer', () => {
		for (const blessing of [false, true]) {
			const result = rollThanksgivingOffers({
				quantity: 37,
				offersBefore: 0,
				offersTodayBefore: 0,
				hasHadGobbles: true,
				blessing,
				rng: { randInt: (_min: number, max: number) => max }
			});
			const expected = new Bank();
			for (let i = 0; i < 37; i++) expected.add(thanksgivingStaticPack(blessing));
			expect(result.loot.equals(expected)).toBe(true);
		}
	});

	test('Harvest turkey is cheap on /sell, not food, tradeable, and not in any turkey/event log', () => {
		const turkey = Items.getOrThrow('Harvest turkey');
		expect(turkey.id).toBe(ThanksgivingItem.HARVEST_TURKEY);
		expect(sellPriceOfItem(turkey).price).toBeLessThanOrEqual(1000);
		expect(sellPriceOfItem(turkey).price).toBeLessThan(sellPriceOfItem(Items.getOrThrow('Raw turkey')).price / 50);
		expect(Eatables.find(e => e.id === turkey.id)).toBeUndefined();
		expect(turkey.tradeable).toBe(true);
		expect(thanksgivingCL).not.toContain(turkey.id);
		const old2021 = discontinuedCollections['Thanksgiving 2021'];
		expect(old2021.items).not.toContain(turkey.id);
	});

	test('Captain Laboon name and old alias', () => {
		expect(Items.itemNameFromId(ThanksgivingItem.LABOON_STRAW_HAT)).toBe('Captain Laboon');
		expect(Items.getOrThrow('Captain Laboon').id).toBe(ThanksgivingItem.LABOON_STRAW_HAT);
		expect(Items.getOrThrow('Laboon (straw hat)').id).toBe(ThanksgivingItem.LABOON_STRAW_HAT);
	});

	test('100,000 offers roll quickly and spend exactly 7 rolls per offer', () => {
		let calls = 0;
		const base = seededRng(42);
		const rng = {
			randInt(min: number, max: number) {
				calls++;
				return base.randInt(min, max);
			}
		};
		const start = performance.now();
		const result = rollThanksgivingOffers({
			quantity: 100_000,
			offersBefore: 0,
			offersTodayBefore: 0,
			hasHadGobbles: false,
			blessing: false,
			rng
		});
		const ms = performance.now() - start;
		expect(calls).toBe(700_000);
		expect(ms).toBeLessThan(5000);
		expect(result.loot.amount('Oak logs')).toBe(5_000_000);
		expect(result.loot.amount('Raw karambwan')).toBe(600_000);
		// About 1/50, x1.15 Gobble Streak from the 4th offer of the day: ~2,300 expected.
		const turkeys = result.loot.amount(ThanksgivingItem.HARVEST_TURKEY);
		expect(turkeys).toBe(result.rares.turkey.got);
		expect(turkeys).toBeGreaterThan(2_000);
		expect(turkeys).toBeLessThan(2_600);
		// Gobbles guarantee still fires once at most.
		expect(result.rares.gobbles.got).toBeGreaterThanOrEqual(1);
	});
});
