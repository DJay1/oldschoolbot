import { describe, expect, test } from 'vitest';

import { BitField, BitFieldData } from '@/lib/constants.js';

describe('invention trip material totals toggle removed', () => {
	test('bitfield 251 is reserved and not user-configurable', () => {
		expect(BitField.ShowInventionTripMaterials).toEqual(251);
		expect(BitFieldData[BitField.ShowInventionTripMaterials].userConfigurable).toBe(false);
	});
});
