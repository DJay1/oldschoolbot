import '../../src/lib/util/clientSettings.js';

import { SeedableRNG } from 'node-rng';
import { describe, expect, test } from 'vitest';

import {
	createTfaRaids,
	TFA_PITY_CAP,
	type TfaTeamMember,
	tfaBossByID,
	tfaDeathChance,
	tfaNextWipeStreak,
	tfaPityPercent,
	tfaRaidWipeChance
} from '@/lib/bsc/tfa/tfa.js';

/** Records every death chance it's asked about, and kills everyone (always wipes at the first boss). */
class WipeRNG extends SeedableRNG {
	asked: number[] = [];
	constructor() {
		super(3);
	}
	override percentChance(p: number): boolean {
		this.asked.push(p);
		return true;
	}
}

const minReq = (wipeStreak = 0, id = '1'): TfaTeamMember => ({
	id,
	kc: 0,
	gear: { melee: 30, range: 30, mage: 30, total: 30 },
	boosts: [],
	deathReduction: 0,
	wipeStreak
});

describe('TFA wipe chance and pity', () => {
	test('min-req solo has a real chance, not a guaranteed wipe', () => {
		const wipe = tfaRaidWipeChance([minReq()]);
		expect(wipe).toBeGreaterThan(40);
		expect(wipe).toBeLessThan(65);
	});

	test('pity lowers death chance per wipe, capped, and floors still apply', () => {
		const boss = tfaBossByID(8);
		expect(tfaPityPercent(0)).toBe(0);
		expect(tfaPityPercent(3)).toBe(30);
		expect(tfaPityPercent(99)).toBe(TFA_PITY_CAP);
		expect(tfaPityPercent(-5)).toBe(0);
		const base = tfaDeathChance(minReq(), boss);
		expect(tfaDeathChance(minReq(2), boss)).toBeCloseTo(base * 0.8);
		expect(tfaDeathChance(minReq(50), boss)).toBeCloseTo(base * 0.5);
		const maxed: TfaTeamMember = {
			...minReq(10),
			kc: 500,
			gear: { melee: 100, range: 100, mage: 100, total: 100 }
		};
		expect(tfaDeathChance(maxed, tfaBossByID(1))).toBe(1);
		expect(tfaRaidWipeChance([minReq(5)])).toBeLessThan(tfaRaidWipeChance([minReq(0)]));
	});

	test('streak: +1 per wiped raid, reset on a completed raid', () => {
		expect(tfaNextWipeStreak(0, [{ w: 1 }, { w: 8 }])).toBe(2);
		expect(tfaNextWipeStreak(4, [{ w: 1 }, { w: null }])).toBe(0);
		expect(tfaNextWipeStreak(4, [{ w: null }, { w: 3 }])).toBe(1);
		expect(tfaNextWipeStreak(2, [])).toBe(2);
	});

	test('multi-raid trips carry the streak raid to raid', () => {
		const rng = new WipeRNG();
		const { raids } = createTfaRaids({ team: [minReq(0)], quantity: 3, rng });
		expect(raids.every(r => r.w === 1)).toBe(true);
		const first = tfaDeathChance(minReq(0), tfaBossByID(1));
		expect(rng.asked).toHaveLength(3);
		expect(rng.asked[0]).toBeCloseTo(first);
		expect(rng.asked[1]).toBeCloseTo(first * 0.9);
		expect(rng.asked[2]).toBeCloseTo(first * 0.8);
	});

	test('teams: each member uses their own streak, a team wipe needs everyone dead', () => {
		const team = [minReq(0, 'a'), minReq(5, 'b')];
		const solo = tfaRaidWipeChance([minReq(0)]);
		expect(tfaRaidWipeChance(team)).toBeLessThan(solo);
		const rng = new WipeRNG();
		createTfaRaids({ team, quantity: 1, rng });
		expect(rng.asked[0]).toBeGreaterThan(rng.asked[1]);
	});
});
