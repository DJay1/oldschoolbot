import '../../src/lib/util/clientSettings.js';

import { inventionBoosts } from '@/lib/bso/skills/invention/inventions.js';

import { SeedableRNG } from 'node-rng';
import { describe, expect, test } from 'vitest';

import { createTfaRaids, type TfaTeamMember, tfaChincannonFactor, tfaSingleRaidDuration } from '@/lib/bsc/tfa/tfa.js';

const member = (id: string): TfaTeamMember => ({
	id,
	kc: 100,
	gear: { melee: 90, range: 90, mage: 90, total: 90 },
	boosts: [],
	deathReduction: 0
});

describe('TFA Chincannon', () => {
	test('same speed boost as CoX', () => {
		expect(inventionBoosts.chincannon.tfaPercentReduction).toBe(inventionBoosts.chincannon.coxPercentReduction);
		expect(tfaChincannonFactor(60)).toBeCloseTo(0.4);
		expect(tfaChincannonFactor(0)).toBe(1);
		expect(tfaChincannonFactor(150)).toBe(0);
	});

	test('makes the whole trip 60% faster without changing the raid outcomes', () => {
		const team = [member('a'), member('b')];
		const pct = inventionBoosts.chincannon.tfaPercentReduction;
		const normal = createTfaRaids({ team, quantity: 5, rng: new SeedableRNG(11) });
		const cc = createTfaRaids({ team, quantity: 5, rng: new SeedableRNG(11), chincannonPercent: pct });
		expect(cc.raids).toEqual(normal.raids);
		expect(cc.fakeDuration).toBeCloseTo(normal.fakeDuration * 0.4, -3);
		expect(cc.realDuration).toBeLessThanOrEqual(Math.ceil(normal.realDuration * 0.4));
		expect(cc.realDuration).toBeGreaterThanOrEqual(Math.floor(normal.realDuration * 0.4) - 5);
	});

	test('more raids fit in a trip (max quantity uses the faster raid time)', () => {
		const team = [member('a')];
		const pct = inventionBoosts.chincannon.tfaPercentReduction;
		expect(tfaSingleRaidDuration(team, pct)).toBeLessThan(tfaSingleRaidDuration(team) * 0.41);
	});
});
