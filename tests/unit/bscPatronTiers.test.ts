import { Time } from '@oldschoolgg/toolkit';
import { afterEach, expect, test } from 'vitest';

import { parseBscPatreonMembers } from '@/lib/bsc/patronSync.js';
import {
	BSC_PATRON_TIERS,
	bscDailyCooldownMs,
	bscPatronLevelFromBits,
	bscPatronLevelFromPatreonTierIds,
	bscPatronLevelFromRoles,
	bscPatronTripBonusMs,
	patronBitsForLevel
} from '@/lib/bsc/patronTiers.js';
import { BitField } from '@/lib/constants.js';
import { makeBadgeString } from '@/lib/util/makeBadgeString.js';

const envKeys = [
	'PATRON_ROLE_PUP',
	'PATRON_ROLE_GOODBOY',
	'PATRON_ROLE_TOPDOG',
	'PATREON_TIER_PUP_ID',
	'PATREON_TIER_GOODBOY_ID',
	'PATREON_TIER_TOPDOG_ID'
] as const;
const previous = new Map(envKeys.map(key => [key, process.env[key]]));

afterEach(() => {
	for (const key of envKeys) {
		const value = previous.get(key);
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
});

test('the three tiers map onto the existing patron bits', () => {
	expect(BSC_PATRON_TIERS.map(tier => [tier.level, tier.name, tier.priceUsd, tier.bit])).toEqual([
		[1, 'Pup', 3, BitField.PatronTier1],
		[2, 'Good Boy', 7, BitField.PatronTier2],
		[3, 'Top Dog', 15, BitField.PatronTier3]
	]);
	expect(BitField.BSCEarlySupporter).toBe(199);
	expect(patronBitsForLevel(2)).toEqual([BitField.PatronTier2]);
	expect(patronBitsForLevel(0)).toEqual([]);
	expect(bscPatronLevelFromBits([BitField.BSCEarlySupporter, BitField.PatronTier3])).toBe(3);
});

test('the highest Discord role wins and trip length is a percent of 30 minutes', () => {
	process.env.PATRON_ROLE_PUP = '111';
	process.env.PATRON_ROLE_GOODBOY = '222';
	process.env.PATRON_ROLE_TOPDOG = '333';
	expect(bscPatronLevelFromRoles(['111', '333'])).toBe(3);
	expect(bscPatronLevelFromRoles(['999'])).toBe(0);
	expect(bscPatronTripBonusMs([BitField.PatronTier1])).toBe(Time.Minute * 3);
	expect(bscPatronTripBonusMs([BitField.PatronTier2])).toBe(Time.Minute * 6);
	expect(bscPatronTripBonusMs([BitField.PatronTier3])).toBe(Time.Minute * 6);
	expect(bscPatronTripBonusMs([BitField.BSCEarlySupporter])).toBe(0);
	expect(bscDailyCooldownMs([BitField.PatronTier1], Time.Hour * 4)).toBe(Time.Hour * 4);
	expect(bscDailyCooldownMs([BitField.PatronTier2], Time.Hour * 4)).toBe(Time.Hour * 3);
});

test('Patreon entitled tier ids map by env, and the badge is not an item', () => {
	process.env.PATREON_TIER_PUP_ID = 'pup-id';
	process.env.PATREON_TIER_TOPDOG_ID = 'top-id';
	expect(bscPatronLevelFromPatreonTierIds(['pup-id', 'top-id'])).toBe(3);
	expect(bscPatronLevelFromPatreonTierIds(['other'])).toBe(0);
	const members = parseBscPatreonMembers({
		included: [
			{
				type: 'user',
				id: 'pu1',
				attributes: { social_connections: { discord: { user_id: '42' } } }
			}
		],
		data: [
			{
				attributes: { patron_status: 'active_patron' },
				relationships: {
					user: { data: { id: 'pu1' } },
					currently_entitled_tiers: { data: [{ id: 'pup-id' }] }
				}
			},
			{
				attributes: { patron_status: 'former_patron' },
				relationships: {
					user: { data: { id: 'pu1' } },
					currently_entitled_tiers: { data: [{ id: 'top-id' }] }
				}
			}
		]
	});
	expect(members.get('42')).toBe(1);
	expect(makeBadgeString([], false, false, false, [BitField.PatronTier1])).toBe('🐾');
	expect(makeBadgeString([], false, true, false, [BitField.PatronTier3, BitField.BSCPatronCosmetic])).toContain('🐶');
});
