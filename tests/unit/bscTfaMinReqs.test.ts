import '../../src/lib/util/clientSettings.js';
import { Bank } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { TFA_MIN_GEAR_PERCENT, tfaSuppliesPerRaid } from '@/lib/bsc/tfa/tfa.js';
import { tfaMinReqsPlan } from '@/lib/bsc/tfa/tfaMinReqs.js';

describe('/testpotato tfa_min_reqs', () => {
	test('each setup just passes the TFA gear check', () => {
		const plan = tfaMinReqsPlan(new Bank());
		for (const style of ['melee', 'range', 'mage'] as const) {
			const { gear, percent } = plan.gear[style];
			console.log(style, percent.toFixed(2), gear.toString());
			expect(percent).toBeGreaterThanOrEqual(TFA_MIN_GEAR_PERCENT);
			expect(percent).toBeLessThan(TFA_MIN_GEAR_PERCENT + 15);
		}
	});

	test('supplies top up to exactly one raid', () => {
		expect(tfaMinReqsPlan(new Bank()).missingSupplies.equals(tfaSuppliesPerRaid)).toBe(true);
		const partial = new Bank().add('Saradomin brew(4)', 5).add('Super restore(4)', 50);
		const missing = tfaMinReqsPlan(partial).missingSupplies;
		expect(missing.amount('Saradomin brew(4)')).toBe(3);
		expect(missing.amount('Super restore(4)')).toBe(0);
		expect(partial.clone().add(missing).has(tfaSuppliesPerRaid)).toBe(true);
	});
});