import { describe, expect, test } from 'vitest';

import { userCanAccessBankBg } from '../../src/lib/bsc/bankBgAccess.js';
import type { BankBackground } from '../../src/lib/minions/data/bankBackgrounds.js';

function bg(partial: Partial<BankBackground> & Pick<BankBackground, 'id' | 'name'>): BankBackground {
	return {
		image: null,
		available: false,
		...partial
	} as BankBackground;
}

describe('userCanAccessBankBg', () => {
	test('owner-locked backgrounds are only for owners', () => {
		const custom = bg({ id: 1025, name: 'DJ CustomBG', available: false, owners: ['290167629966999552'] });
		const owner = { id: '290167629966999552', isModOrAdmin: () => false, user: { store_bitfield: [] } } as any;
		const other = { id: '1', isModOrAdmin: () => false, user: { store_bitfield: [] } } as any;
		expect(userCanAccessBankBg(owner, custom)).toBe(true);
		expect(userCanAccessBankBg(other, custom)).toBe(false);
	});

	test('available public backgrounds are accessible', () => {
		const pub = bg({ id: 1, name: 'Default', available: true });
		const user = { id: '1', isModOrAdmin: () => false, user: { store_bitfield: [] } } as any;
		expect(userCanAccessBankBg(user, pub)).toBe(true);
	});
});
