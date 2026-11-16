import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SeedableRNG } from 'node-rng';
import { describe, expect, test } from 'vitest';

import { createTfaRaids, TFA_TOTAL_POINTS, type TfaTeamMember } from '@/lib/bsc/tfa/tfa.js';
import { rollTfaTripLoot, tfaBossesKilled, tfaXPForBosses } from '@/lib/bsc/tfa/tfaActivity.js';
import { TfaItem, tfaCL, tfaFragmentIDs, tfaUniqueItems } from '@/lib/bsc/tfa/tfaItems.js';
import {
	pickTfaUniqueRecipient,
	rollTfaStandardLoot,
	rollTfaTertiaries,
	rollTfaUniqueItem,
	TfaStandardTable,
	tfaTeamUniqueOdds
} from '@/lib/bsc/tfa/tfaLoot.js';

/** Seeded RNG where chosen roll() calls can be forced. */
class ForcedRNG extends SeedableRNG {
	constructor(
		seed: number,
		private forceRoll: (max: number) => boolean | undefined = () => undefined,
		private forcePercent: boolean | undefined = undefined
	) {
		super(seed);
	}
	override roll(max: number): boolean {
		const forced = this.forceRoll(max);
		return forced === undefined ? super.roll(max) : forced;
	}
	override percentChance(percent: number): boolean {
		return this.forcePercent === undefined ? super.percentChance(percent) : this.forcePercent;
	}
}

function member(id: string, kc = 50): TfaTeamMember {
	return {
		id,
		kc,
		gear: { melee: 80, range: 80, mage: 80, total: 80 },
		boosts: [],
		deathReduction: 0
	};
}

describe('The Fractured Archive', () => {
	test('items: 17 CL items, 5 uniques, IDs in the BSC 746xx range', () => {
		expect(tfaCL.length).toBe(17);
		expect(new Set(tfaCL).size).toBe(17);
		expect(tfaUniqueItems.length).toBe(5);
		for (const id of tfaCL) {
			expect(id).toBeGreaterThanOrEqual(74600);
			expect(id).toBeLessThanOrEqual(74616);
		}
	});

	test('team unique odds by team size', () => {
		expect([1, 2, 3, 4, 5, 6, 7, 8].map(tfaTeamUniqueOdds)).toEqual([16, 16, 12.5, 10.5, 9.5, 8.5, 8, 7.5]);
		expect(tfaTeamUniqueOdds(0)).toBe(16);
		expect(tfaTeamUniqueOdds(20)).toBe(7.5);
	});

	test('unique table weights (5/4/3/2/1 out of 15)', () => {
		const rng = new SeedableRNG(1);
		const counts = new Map<number, number>();
		const n = 150_000;
		for (let i = 0; i < n; i++) {
			const id = rollTfaUniqueItem(rng);
			counts.set(id, (counts.get(id) ?? 0) + 1);
		}
		const expected: [number, number][] = [
			[TfaItem.RONDACHE, 5 / 15],
			[TfaItem.ZORYAS_TOME, 4 / 15],
			[TfaItem.HORN_OF_BRAN, 3 / 15],
			[TfaItem.ASCENSION_CROSSBOWS, 2 / 15],
			[TfaItem.OBLIGATOR, 1 / 15]
		];
		for (const [id, rate] of expected) {
			expect(Math.abs((counts.get(id) ?? 0) / n - rate)).toBeLessThan(0.006);
		}
	});

	test('standard loot: 3 rolls, 5x multiplier applies to every roll when hit', () => {
		const multiplied = new ForcedRNG(2, max => (max === 51 ? true : undefined));
		for (let i = 0; i < 500; i++) {
			const loot = rollTfaStandardLoot(multiplied);
			for (const [, qty] of loot.items()) expect(qty % 5).toBe(0);
		}
		const normal = new ForcedRNG(3, max => (max === 51 ? false : undefined));
		for (let i = 0; i < 500; i++) {
			const loot = rollTfaStandardLoot(normal);
			expect(loot.length).toBeGreaterThanOrEqual(1);
			expect(loot.length).toBeLessThanOrEqual(3);
		}
		for (const item of TfaStandardTable.allItems) expect(tfaUniqueItems.includes(item as never)).toBe(false);
	});

	test('unique recipient is weighted by contribution points', () => {
		const rng = new SeedableRNG(4);
		let a = 0;
		const n = 70_000;
		for (let i = 0; i < n; i++) {
			if (
				pickTfaUniqueRecipient(
					[
						{ id: 'a', points: 600 },
						{ id: 'b', points: 100 }
					],
					rng
				) === 'a'
			)
				a++;
		}
		expect(Math.abs(a / n - 6 / 7)).toBeLessThan(0.01);
		let zero = 0;
		for (let i = 0; i < 20_000; i++) {
			if (
				pickTfaUniqueRecipient(
					[
						{ id: 'a', points: 0 },
						{ id: 'b', points: 0 }
					],
					rng
				) === 'a'
			)
				zero++;
		}
		expect(Math.abs(zero / 20_000 - 0.5)).toBeLessThan(0.02);
	});

	test('tertiaries: no folio if owned, no duplicate fragments', () => {
		const always = new ForcedRNG(5, () => true);
		const owned = rollTfaTertiaries({ ownsFolio: true, fragmentsObtained: [], rng: always });
		expect(owned.has(TfaItem.ARCHIVISTS_FOLIO)).toBe(false);
		expect(owned.has('Clue scroll (elite)')).toBe(true);

		const allFrags = rollTfaTertiaries({ ownsFolio: false, fragmentsObtained: [...tfaFragmentIDs], rng: always });
		expect(allFrags.has(TfaItem.ARCHIVISTS_FOLIO)).toBe(true);
		for (const id of tfaFragmentIDs) expect(allFrags.has(id)).toBe(false);

		const missingOne = tfaFragmentIDs.slice(0, 3);
		const oneLeft = rollTfaTertiaries({ ownsFolio: false, fragmentsObtained: missingOne, rng: always });
		expect(oneLeft.has(tfaFragmentIDs[3])).toBe(true);
		for (const id of missingOne) expect(oneLeft.has(id)).toBe(false);
	});

	test('raids: boss order, contribution points capped, wipes recorded', () => {
		const rng = new SeedableRNG(6);
		for (const size of [1, 2, 5, 8]) {
			const team = Array.from({ length: size }, (_, i) => member(`u${i}`));
			const { raids, realDuration, fakeDuration } = createTfaRaids({ team, quantity: 10, rng });
			expect(raids.length).toBe(10);
			expect(realDuration).toBeGreaterThan(0);
			expect(realDuration).toBeLessThanOrEqual(fakeDuration);
			for (const raid of raids) {
				expect(raid.b.length).toBe(5);
				expect(raid.b[0]).toBe(1);
				expect(raid.b[4]).toBe(8);
				expect([2, 3]).toContain(raid.b[1]);
				expect([4, 5]).toContain(raid.b[2]);
				expect([6, 7]).toContain(raid.b[3]);
				expect(raid.u.length).toBe(size);
				const total = raid.u.reduce((acc, u) => acc + u.p, 0);
				expect(total).toBeLessThanOrEqual(TFA_TOTAL_POINTS + size);
				for (const u of raid.u) expect(u.p).toBeGreaterThanOrEqual(0);
			}
		}

		const wipe = createTfaRaids({
			team: [member('a'), member('b')],
			quantity: 3,
			rng: new ForcedRNG(7, undefined, true)
		});
		for (const raid of wipe.raids) {
			expect(raid.w).toBe(1);
			expect(tfaBossesKilled(raid)).toBe(0);
		}
	});

	test('trip loot: wipes give nothing, unique recipient gets no standard loot, loot not doubled', () => {
		const userIDs = ['a', 'b'];
		const wiped = rollTfaTripLoot({
			userIDs,
			raids: [
				{
					b: [1, 2, 4, 6, 8],
					w: 6,
					u: [
						{ d: [6], p: 0 },
						{ d: [6], p: 0 }
					]
				}
			],
			ownsFolio: {},
			fragmentsObtained: {},
			rng: new ForcedRNG(8, () => true)
		});
		expect(wiped.loot.totalLoot().length).toBe(0);

		// Force only the team unique roll (1 in 16 for a duo); everything else fails.
		const rng = new ForcedRNG(9, max => max === 16);
		const raids = Array.from({ length: 4 }, () => ({
			b: [1, 2, 4, 6, 8],
			w: null,
			u: [
				{ d: [], p: 700 },
				{ d: [], p: 0 }
			]
		}));
		const { loot, purples } = rollTfaTripLoot({ userIDs, raids, ownsFolio: {}, fragmentsObtained: {}, rng });
		const aLoot = loot.get('a');
		expect(purples.length).toBe(4);
		expect(aLoot.amount(TfaItem.ASCENSION_SHARDS)).toBe(0);
		expect(aLoot.items().reduce((acc, [, q]) => acc + q, 0)).toBe(4);
		for (const [item] of aLoot.items()) expect(tfaUniqueItems.includes(item.id as never)).toBe(true);
		for (const [item] of loot.get('b').items()) expect(tfaUniqueItems.includes(item.id as never)).toBe(false);
		expect(loot.get('b').length).toBeGreaterThan(0);
	});

	test('XP: per boss killed, melee split across styles', () => {
		const xp = tfaXPForBosses(5, ['attack', 'strength', 'defence']);
		expect(xp.amount('hitpoints')).toBe(9000);
		expect(xp.amount('ranged')).toBe(7000);
		expect(xp.amount('magic')).toBe(7000);
		expect(xp.amount('attack')).toBe(6000);
		expect(xp.amount('strength')).toBe(6000);
		expect(xp.amount('defence')).toBe(6000);
		expect(tfaXPForBosses(0, ['attack']).length).toBe(0);
		expect(tfaXPForBosses(2, ['strength']).amount('strength')).toBe(7200);
	});

	test('Double XP / double-add guards in the activity', () => {
		const src = readFileSync(path.join(process.cwd(), 'src/lib/bsc/tfa/tfaActivity.ts'), 'utf8');
		const task = src.slice(src.indexOf('export const tfaTask'));
		// XP is added once per user, with the trip duration.
		expect(task.match(/addXPCounter\(/g)?.length).toBe(1);
		expect(task).toMatch(/addXPCounter\(\{[^}]*duration[^}]*\}\)/);
		expect(task).not.toMatch(/\.addXP\(/);
		// Loot is added once per user, and handleTripFinish is not given loot to add again.
		expect(task.match(/transactItems\(/g)?.length).toBe(1);
		const finish = task.slice(task.indexOf('handleTripFinish({'));
		expect(finish.slice(0, finish.indexOf('})'))).not.toMatch(/loot/);
		// No global double loot.
		expect(task).not.toMatch(/doubleLoot|DoubleLoot|double_loot/);
	});
});
