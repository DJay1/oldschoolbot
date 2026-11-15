import { describe, expect, test } from 'vitest';

import { DRYSTREAK_COOLDOWN_MS, dryStreakCooldownLeft } from '../../../src/lib/bsc/dryStreakCooldown.js';

describe('drystreak cooldown', () => {
	test('first use is free, then waits, per user', () => {
		const t = 1_000_000;
		expect(dryStreakCooldownLeft('a', t)).toBe(0);
		expect(dryStreakCooldownLeft('a', t + 1000)).toBe(DRYSTREAK_COOLDOWN_MS - 1000);
		expect(dryStreakCooldownLeft('b', t + 1000)).toBe(0);
		// A blocked attempt does not restart the cooldown.
		expect(dryStreakCooldownLeft('a', t + DRYSTREAK_COOLDOWN_MS)).toBe(0);
	});
});
