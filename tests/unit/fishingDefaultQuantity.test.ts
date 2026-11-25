import { Time } from '@oldschoolgg/toolkit';
import { SeedableRNG } from 'node-rng';
import { describe, expect, test } from 'vitest';

import { Fishing } from '@/lib/skilling/skills/fishing/fishing.js';
import { calcFishingTripStart } from '@/lib/skilling/skills/fishing/fishingTripStart.js';
import { makeGearBank } from './utils.js';

describe('fishing default quantity', () => {
	const karambwanji = Fishing.Fishes.find(f => f.name === 'Karambwanji')!;
	const gearBank = makeGearBank({ skillsAsLevels: { fishing: 99 } });
	const maxTripLength = Time.Hour * 4;
	const rng = new SeedableRNG(1);

	test('omitting quantity fills the max trip instead of stopping at 3000 fish', async () => {
		const result = await calcFishingTripStart({
			gearBank,
			fish: karambwanji,
			maxTripLength,
			quantityInput: undefined,
			wantsToUseFlakes: false,
			powerfish: false,
			hasWildyEliteDiary: false,
			rng
		});
		expect(typeof result).not.toBe('string');
		if (typeof result === 'string') return;
		expect(result.quantity).toBeGreaterThan(3000);
		expect(result.duration).toBeGreaterThan(Time.Hour * 3);
		expect(result.duration).toBeLessThanOrEqual(maxTripLength + Time.Second * 10);
	});

	test('an explicit quantity still stops at that many fish', async () => {
		const result = await calcFishingTripStart({
			gearBank,
			fish: karambwanji,
			maxTripLength,
			quantityInput: 3000,
			wantsToUseFlakes: false,
			powerfish: false,
			hasWildyEliteDiary: false,
			rng: new SeedableRNG(1)
		});
		expect(typeof result).not.toBe('string');
		if (typeof result === 'string') return;
		expect(result.quantity).toBe(3000);
		expect(result.duration).toBeLessThan(Time.Hour * 3.2);
	});
});
