import '../../src/lib/util/clientSettings.js';

import { Bank } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { TFA_SUPPLY_KC_STEP, tfaSuppliesForKc, tfaSuppliesPerRaid } from '@/lib/bsc/tfa/tfa.js';

const brews = (kc: number) => tfaSuppliesForKc(kc).amount('Saradomin brew(4)');
const restores = (kc: number) => tfaSuppliesForKc(kc).amount('Super restore(4)');

describe('TFA supplies scale with KC', () => {
	test('0 KC is unchanged from before', () => {
		expect(
			tfaSuppliesPerRaid.equals(
				new Bank({
					'Saradomin brew(4)': 8,
					'Super restore(4)': 6,
					'Super combat potion(4)': 1,
					'Ranging potion(4)': 1
				})
			)
		).toBe(true);
		expect(tfaSuppliesForKc(0).equals(tfaSuppliesPerRaid)).toBe(true);
	});

	test('one less brew every 50 KC, down to 4 at 200 KC', () => {
		expect(TFA_SUPPLY_KC_STEP).toBe(50);
		expect([0, 49, 50, 99, 100, 150, 199, 200, 5000].map(brews)).toEqual([8, 8, 7, 7, 6, 5, 5, 4, 4]);
		expect([0, 50, 100, 150, 200].map(restores)).toEqual([6, 6, 5, 4, 3]);
	});

	test('combat and ranging potions never change', () => {
		for (const kc of [0, 75, 300]) {
			expect(tfaSuppliesForKc(kc).amount('Super combat potion(4)')).toBe(1);
			expect(tfaSuppliesForKc(kc).amount('Ranging potion(4)')).toBe(1);
		}
	});

	test('never more than 0 KC needs, never less than the floor, bad input is treated as 0 KC', () => {
		for (let kc = 0; kc <= 1000; kc += 7) {
			expect(tfaSuppliesPerRaid.has(tfaSuppliesForKc(kc))).toBe(true);
			expect(brews(kc)).toBeGreaterThanOrEqual(4);
			expect(restores(kc)).toBeGreaterThanOrEqual(3);
		}
		expect(tfaSuppliesForKc(-10).equals(tfaSuppliesPerRaid)).toBe(true);
		expect(tfaSuppliesForKc(Number.NaN).equals(tfaSuppliesPerRaid)).toBe(true);
	});
});
