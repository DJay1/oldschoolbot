import {
	formatInventionTripMaterialTotal,
	INVENTION_TRIP_TOTAL_PREFIX,
	takeInventionTripMaterialTotal
} from '@/lib/bso/skills/invention/inventionBoostNotice.js';
import { MaterialBank } from '@/lib/bso/skills/invention/MaterialBank.js';

import { describe, expect, test } from 'vitest';

import { BitField } from '@/lib/constants.js';

describe('invention trip material totals', () => {
	test('formats a single clear line under the Discord length limit', () => {
		const cost = new MaterialBank().add('organic' as any, 12).add('swift' as any, 4);

		const line = formatInventionTripMaterialTotal(cost);

		expect(line.startsWith(INVENTION_TRIP_TOTAL_PREFIX)).toBe(true);

		expect(line.length).toBeLessThanOrEqual(2000 - 150);

		expect(line).not.toMatch(/<@/);
	});

	test('the opt-in toggle is off by default', () => {
		expect(takeInventionTripMaterialTotal({ bitfield: [] })).toBeNull();

		expect(takeInventionTripMaterialTotal({ bitfield: [BitField.ShowInventionTripMaterials] })).toBeNull();
	});
});
