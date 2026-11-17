import '../../src/lib/util/clientSettings.js';

import { SeedableRNG } from 'node-rng';
import { Items } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { rollTfaTripLoot } from '@/lib/bsc/tfa/tfaActivity.js';
import { TfaItem, tfaFragmentIDs, tfaUniqueItems } from '@/lib/bsc/tfa/tfaItems.js';

// Tertiaries: elite clue, folio, fragments, Orion.
const tertiaries = [
	Items.getOrThrow('Clue scroll (elite)').id,
	TfaItem.ARCHIVISTS_FOLIO,
	TfaItem.ORION,
	...tfaFragmentIDs
];
const raid = (n: number) => ({ b: [1, 2, 4, 6, 8], w: null, u: Array.from({ length: n }, () => ({ d: [], p: 100 })) });

function run(flappy: Record<string, boolean>, seed: number) {
	return rollTfaTripLoot({
		userIDs: ['a', 'b'],
		raids: Array.from({ length: 30 }, () => raid(2)),
		ownsFolio: {},
		fragmentsObtained: {},
		petOdds: 3,
		flappy,
		rng: new SeedableRNG(seed)
	});
}

describe('TFA Flappy', () => {
	test('doubles the raid loot (uniques and standard) but never tertiaries, only for the Flappy user', () => {
		for (const seed of [1, 2, 3]) {
			const base = run({}, seed);
			const flap = run({ a: true }, seed);
			// Standard table quantities use their own RNG, so check structure: every raid-loot stack of the Flappy user is a
			// doubled roll (even), tertiaries match the same-seed run exactly, and the other player isn't doubled.
			for (const [item, qty] of flap.loot.get('a').items()) {
				if (tertiaries.includes(item.id)) expect(qty, item.name).toBe(base.loot.get('a').amount(item.id));
				else expect(qty % 2, item.name).toBe(0);
			}
			expect(
				flap.loot
					.get('b')
					.items()
					.some(([item, qty]) => !tertiaries.includes(item.id) && qty % 2 === 1)
			).toBe(true); // Fragments stay one each (they're one-time unlocks) and Orion isn't doubled.
			for (const frag of tfaFragmentIDs) expect(flap.loot.get('a').amount(frag)).toBeLessThanOrEqual(1);
			expect(flap.loot.get('a').amount(TfaItem.ORION)).toBe(base.loot.get('a').amount(TfaItem.ORION));
		}
	});

	test('a Flappy unique counts double, the same as CoX', () => {
		let found = false;
		for (let seed = 1; seed < 40 && !found; seed++) {
			const base = run({}, seed);
			const flap = run({ a: true }, seed);
			const uniques = tfaUniqueItems.filter(id => base.loot.get('a').has(id));
			if (uniques.length === 0) continue;
			found = true;
			for (const id of uniques) expect(flap.loot.get('a').amount(id)).toBe(base.loot.get('a').amount(id) * 2);
		}
		expect(found).toBe(true);
	});
});
