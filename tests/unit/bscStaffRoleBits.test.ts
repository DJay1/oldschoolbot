import { describe, expect, test } from 'vitest';

import { BSC_STAFF_ROLE_BITS, staffBitChanges } from '../../src/lib/bsc/staffRoleBits.js';
import { BitField } from '../../src/lib/constants.js';

const developerRole = BSC_STAFF_ROLE_BITS.find(r => r.bit === BitField.Developer)!.roleId;
const contributorRole = BSC_STAFF_ROLE_BITS.find(r => r.bit === BitField.Contributor)!.roleId;
const modRole = BSC_STAFF_ROLE_BITS.find(r => r.bit === BitField.Moderator)!.roleId;

describe('staffBitChanges', () => {
	test('having the role adds the bit', () => {
		expect(staffBitChanges([], [developerRole, contributorRole, modRole])).toEqual({
			add: [BitField.Developer, BitField.Contributor, BitField.Moderator],
			remove: []
		});
	});

	test('losing the role removes the bit', () => {
		expect(staffBitChanges([BitField.Developer, BitField.Contributor, BitField.Moderator], [])).toEqual({
			add: [],
			remove: [BitField.Developer, BitField.Contributor, BitField.Moderator]
		});
	});

	test('nothing changes when roles and bits already match', () => {
		expect(staffBitChanges([BitField.Developer, BitField.Moderator], [developerRole, modRole, 'other'])).toEqual({
			add: [],
			remove: []
		});
	});

	test('other bits are never touched', () => {
		const { add, remove } = staffBitChanges([BitField.ServerSupport, BitField.PatronTier3], []);
		expect(add).toEqual([]);
		expect(remove).toEqual([]);
	});
});
