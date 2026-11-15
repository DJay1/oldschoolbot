import { describe, expect, test } from 'vitest';

import { Fishing } from '@/lib/skilling/skills/fishing/fishing.js';

describe('leechfin powerfishing', () => {
	const leech = Fishing.Fishes.find(f => f.name === 'Leechfin')!;
	const barbarian = Fishing.Fishes.find(f => f.name === 'Barbarian fishing')!;
	const secondsPerRoll = (ticks: number, lost: number) => ticks * (1 + lost) * 0.6;

	test('dropping is faster than keeping', () => {
		expect(leech.canPowerfish).toBe(true);
		expect(secondsPerRoll(leech.powerfishTicks!, leech.powerfishLostTicks!)).toBeLessThan(
			secondsPerRoll(leech.ticksPerRoll!, leech.lostTicks!)
		);
	});

	test('stays below barbarian powerfishing XP at 99', () => {
		const xpPerHour = (fish: typeof leech, ticks: number, lost: number) => {
			let remaining = 1;
			let xp = 0;
			for (let i = fish.subfishes!.length - 1; i >= 0; i--) {
				const s = fish.subfishes![i];
				const p = Math.min(1, s.intercept + 98 * s.slope);
				xp += remaining * p * s.xp;
				remaining *= 1 - p;
			}
			return (xp * 3600) / secondsPerRoll(ticks, lost);
		};
		const leechPower = xpPerHour(leech, leech.powerfishTicks!, leech.powerfishLostTicks!);
		const leechKeep = xpPerHour(leech, leech.ticksPerRoll!, leech.lostTicks!);
		expect(leechPower).toBeGreaterThan(leechKeep * 1.4);
		expect(leechPower).toBeLessThan(xpPerHour(barbarian, barbarian.powerfishTicks!, barbarian.powerfishLostTicks!));
	});
});
