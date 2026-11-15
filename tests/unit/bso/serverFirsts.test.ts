import { Bank, EMonster, Items, itemID } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { knownKillRates, THANKSGIVING_FIRST_ITEMS } from '@/lib/bsc/serverFirsts.js';
import {
	BAD_LUCK_MULTIPLIER,
	badLuckText,
	findBadLuckDrops,
	planScan,
	serverFirstBossText,
	serverFirstItemText,
	serverFirstLogText
} from '@/lib/bsc/serverFirstsCore.js';
import { ThanksgivingItem } from '@/lib/events/thanksgiving/items.js';
import killableMonsters from '@/lib/minions/data/killableMonsters/index.js';

describe('server firsts', () => {
	test('texts', () => {
		expect(serverFirstBossText(['Bob'], 'Zulrah')).toBe(
			'🏆 **Server first!** Bob is the first player to kill **Zulrah**!'
		);
		expect(serverFirstBossText(['Bob', 'Amy'], 'Zulrah')).toBe(
			'🏆 **Server first!** Bob and Amy are the first players to kill **Zulrah**!'
		);
		expect(serverFirstItemText(['Bob'], 'Bountiful cornucopia')).toBe(
			'🏆 **Server first!** Bob is the first player to get **Bountiful cornucopia**!'
		);
		expect(serverFirstLogText(['Bob'], 'The Straw Hat Harvest')).toBe(
			'🏆 **Server first!** Bob is the first player to complete **The Straw Hat Harvest** collection log!'
		);
		expect(serverFirstLogText(['Bob'], 'Barrows Chests')).toBe(
			'🏆 **Server first!** Bob is the first player to complete the **Barrows Chests** collection log!'
		);
	});

	test('first scan only seeds, never announces', () => {
		const rows = [{ key: '2042', userIDs: ['1'] }];
		expect(planScan({ seeded: false, rows, canAnnounce: () => true })).toEqual([{ type: 'seed', keys: ['2042'] }]);
	});

	test('after seeding: claim + announce, quiet when many share it or it has no name', () => {
		const actions = planScan({
			seeded: true,
			rows: [
				{ key: 'a', userIDs: ['1'] },
				{ key: 'b', userIDs: ['1', '2', '3', '4'] },
				{ key: 'c', userIDs: ['1'] }
			],
			canAnnounce: key => key !== 'c'
		});
		expect(actions.map(a => a.type === 'claim' && a.announce)).toEqual([true, false, false]);
	});

	test('event firsts are the exact event items', () => {
		expect(THANKSGIVING_FIRST_ITEMS.map(id => Items.itemNameFromId(id))).toEqual([
			'Bountiful cornucopia',
			'Gobbles',
			'Gobble gobble',
			'Laboon',
			'Captain Laboon'
		]);
		expect(THANKSGIVING_FIRST_ITEMS).toContain(ThanksgivingItem.LABOON_STRAW_HAT);
	});
});

describe('bad luck', () => {
	const rates = new Map([[1, 1000]]);
	const base = { rates, amountBefore: () => 0, added: [[1, 1]] as [number, number][] };

	test('announces at 3x the rate, using the earliest possible kill of the trip', () => {
		expect(findBadLuckDrops({ ...base, kcAfter: 3049, quantity: 50 })).toEqual([
			{ itemID: 1, rate: 1000, kc: 3000, multiple: 3 }
		]);
		expect(findBadLuckDrops({ ...base, kcAfter: 3048, quantity: 50 })).toEqual([]);
	});

	test('only the first one ever, only known rates, only rare rates', () => {
		expect(findBadLuckDrops({ ...base, amountBefore: () => 1, kcAfter: 9999, quantity: 1 })).toEqual([]);
		expect(findBadLuckDrops({ ...base, added: [[2, 1]], kcAfter: 9999, quantity: 1 })).toEqual([]);
		expect(findBadLuckDrops({ ...base, rates: new Map([[1, 50]]), kcAfter: 9999, quantity: 1 })).toEqual([]);
	});

	test('text', () => {
		expect(
			badLuckText('Bob', 'Pet snakeling', 'Zulrah', {
				itemID: 1,
				rate: 4000,
				kc: 13_402,
				multiple: 13_402 / 4000
			})
		).toBe(
			'😬 **Bad luck!** Bob got their first **Pet snakeling** at **13,402** Zulrah KC, 3.3x the 1/4,000 drop rate.'
		);
	});

	test('rates come straight from the monster loot table (Zulrah pet is 1/4000)', () => {
		const zulrah = killableMonsters.find(m => m.id === EMonster.ZULRAH)!;
		const r = knownKillRates(zulrah);
		expect(r.get(itemID('Pet snakeling'))).toBe(4000);
		expect(r.get(itemID('Jar of swamp'))).toBe(3000);
		// Clue scrolls never count.
		expect(r.has(itemID('Clue scroll (elite)'))).toBe(false);
		expect(BAD_LUCK_MULTIPLIER).toBe(3);
	});

	test('a trip with the pet at 3x reports it; with plenty of luck it does not', () => {
		const zulrah = killableMonsters.find(m => m.id === EMonster.ZULRAH)!;
		const added = new Bank().add('Pet snakeling');
		const run = (kcAfter: number) =>
			findBadLuckDrops({
				added: added.items().map(([i, q]) => [i.id, q] as [number, number]),
				amountBefore: () => 0,
				rates: knownKillRates(zulrah),
				kcAfter,
				quantity: 10
			});
		expect(run(12_009)).toHaveLength(1);
		expect(run(500)).toHaveLength(0);
	});
});
