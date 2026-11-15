import { describe, expect, test } from 'vitest';

import { administratorRoleIds, BSC_STAFF_ROLE_BITS, staffBitChanges } from '../../src/lib/bsc/staffRoleBits.js';
import { resolveStaffTier, staffBoostWeeklyCap } from '../../src/lib/bsc/staffTiers.js';
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

describe('Discord Administrator gives Moderator only', () => {
	const guildId = '1';
	const roles = [
		{ id: guildId, permissions: '8' },
		{ id: 'owner', permissions: String(8n | 2048n) },
		{ id: 'admin', permissions: '8' },
		{ id: 'dyno', permissions: '8', managed: true },
		{ id: 'adminish', permissions: '2048' },
		{ id: 'bad', permissions: 'nope' }
	];

	test('finds Administrator roles, ignoring @everyone, bot roles and bad data', () => {
		expect(administratorRoleIds(roles, guildId)).toEqual(['owner', 'admin']);
	});

	test('Administrator adds and removes only the Moderator bit', () => {
		const adminRoles = ['owner', 'admin'];
		expect(staffBitChanges([], ['admin'], adminRoles)).toEqual({ add: [BitField.Moderator], remove: [] });
		expect(staffBitChanges([BitField.Moderator], ['admin'], adminRoles)).toEqual({ add: [], remove: [] });
		expect(staffBitChanges([BitField.Moderator], ['adminish'], adminRoles)).toEqual({
			add: [],
			remove: [BitField.Moderator]
		});
		expect(staffBitChanges([BitField.Moderator], [modRole], adminRoles)).toEqual({ add: [], remove: [] });
		expect(staffBitChanges([], ['admin', developerRole], adminRoles)).toEqual({
			add: [BitField.Developer, BitField.Moderator],
			remove: []
		});
	});

	test('unknown role list keeps an existing Moderator bit but adds nothing from Administrator', () => {
		expect(staffBitChanges([BitField.Moderator], ['admin'], null)).toEqual({ add: [], remove: [] });
		expect(staffBitChanges([], ['admin'], null)).toEqual({ add: [], remove: [] });
		expect(staffBitChanges([BitField.Developer], [], null)).toEqual({ add: [], remove: [BitField.Developer] });
	});

	test('a Discord admin who is not in ADMIN_USER_IDS is a Moderator with 2 boosts', () => {
		const tier = resolveStaffTier({ isAdmin: false, isDeveloper: false, isMod: true, isProduction: true });
		expect(tier).toBe('moderator');
		expect(staffBoostWeeklyCap(tier)).toBe(2);
	});
});

describe('Head Mod', () => {
	const headModRole = '1353916725086785646';
	test('Head Mod is mapped to the Moderator bit', () => {
		expect(BSC_STAFF_ROLE_BITS.some(r => r.bit === BitField.Moderator && r.roleId === headModRole)).toBe(true);
		expect(staffBitChanges([], [headModRole])).toEqual({ add: [BitField.Moderator], remove: [] });
	});
	test('a bit stays while any role that grants it is held', () => {
		expect(staffBitChanges([BitField.Moderator], [headModRole])).toEqual({ add: [], remove: [] });
		expect(staffBitChanges([BitField.Moderator], [modRole])).toEqual({ add: [], remove: [] });
		expect(staffBitChanges([BitField.Moderator], [modRole, headModRole])).toEqual({ add: [], remove: [] });
		expect(staffBitChanges([], [modRole, headModRole])).toEqual({ add: [BitField.Moderator], remove: [] });
		expect(staffBitChanges([BitField.Moderator], [])).toEqual({ add: [], remove: [BitField.Moderator] });
	});
	test('Head Mod gives no other staff bits', () => {
		const { add } = staffBitChanges([], [headModRole]);
		expect(add).not.toContain(BitField.Developer);
		expect(add).not.toContain(BitField.Contributor);
		expect(add).toEqual([BitField.Moderator]);
	});
});
