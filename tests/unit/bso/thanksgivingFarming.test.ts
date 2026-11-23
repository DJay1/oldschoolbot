import { describe, expect, test } from 'vitest';

import {
	FARMING_CORNUCOPIA_MIN_GROWTH_MINUTES,
	FARMING_CORNUCOPIA_ONE_IN,
	FARMING_CORNUCOPIA_SUCCESSES,
	type FarmingHarvestedPatch,
	farmingCornucopiaChance,
	farmingPatchQualifies,
	rollFarmingCornucopias
} from '@/lib/events/thanksgiving/core.js';

const win = { randInt: (min: number) => min };
const lose = { randInt: (_min: number, max: number) => max };
const herb: FarmingHarvestedPatch = { itemName: 'Torstol', alive: 9, growthMinutes: 80, fullyGrown: true };

describe('Straw Hat Harvest farming cornucopia (per patch)', () => {
	test('2 in 15 per patch, Harvest Blessing x1.15', () => {
		expect(FARMING_CORNUCOPIA_ONE_IN).toBe(15);
		expect(FARMING_CORNUCOPIA_SUCCESSES).toBe(2);
		expect(FARMING_CORNUCOPIA_MIN_GROWTH_MINUTES).toBe(60);
		expect(farmingCornucopiaChance(false)).toBeCloseTo(2 / 15);
		expect(farmingCornucopiaChance(true)).toBeCloseTo((2 / 15) * 1.15);
	});

	test('only fully grown, live, 60+ minute crops qualify', () => {
		expect(farmingPatchQualifies(herb)).toBe(true);
		expect(farmingPatchQualifies({ ...herb, growthMinutes: 60 })).toBe(true);
		expect(farmingPatchQualifies({ ...herb, growthMinutes: 59 })).toBe(false); // e.g. flowers (20 min)
		expect(farmingPatchQualifies({ ...herb, alive: 0 })).toBe(false); // all died
		expect(farmingPatchQualifies({ ...herb, fullyGrown: false })).toBe(false); // cleared early
		expect(farmingPatchQualifies({ ...herb, growthMinutes: Number.NaN })).toBe(false);
	});

	test('one roll per qualifying patch, not per plant', () => {
		const patches = [herb, { ...herb, alive: 50 }, { ...herb, growthMinutes: 20 }, { ...herb, alive: 0 }];
		expect(rollFarmingCornucopias({ patches, blessing: false, rng: win })).toEqual({ rolls: 2, cornucopias: 2 });
		expect(rollFarmingCornucopias({ patches, blessing: false, rng: lose })).toEqual({ rolls: 2, cornucopias: 0 });
		expect(rollFarmingCornucopias({ patches: undefined, blessing: true, rng: win })).toEqual({
			rolls: 0,
			cornucopias: 0
		});
	});

	test('drop rate matches 2/15 over many patches', () => {
		let seed = 99;
		const rng = {
			randInt: (min: number, max: number) => {
				seed = (seed * 1103515245 + 12345) % 2147483648;
				return min + (seed % (max - min + 1));
			}
		};
		const patches = Array.from({ length: 30000 }, () => herb);
		const { rolls, cornucopias } = rollFarmingCornucopias({ patches, blessing: false, rng });
		expect(rolls).toBe(30000);
		expect(cornucopias / rolls).toBeGreaterThan((2 / 15) * 0.9);
		expect(cornucopias / rolls).toBeLessThan((2 / 15) * 1.1);
	});
});
