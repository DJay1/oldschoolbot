import { Time } from '@oldschoolgg/toolkit';
import { afterEach, expect, test } from 'vitest';

import { parseBscPatreonMembers } from '@/lib/bsc/patronSync.js';
import {
	BSC_PATRON_ROLE_GRACE_MS,
	BSC_PATRON_TIERS,
	bscDailyCooldownMs,
	bscDoubleLootCooldownRemaining,
	bscDoubleLootDurationMs,
	bscGeSlotsForPerkTier,
	bscGiftCooldownRemaining,
	bscGiftLevelForDonor,
	bscPatronLevelFromBits,
	bscPatronLevelFromPatreonTierIds,
	bscPatronLevelFromRoles,
	bscPatronRoleChanges,
	bscPatronTiersMissingRoles,
	bscPatronTripBonusMs,
	bscTripBonusForPerkTier,
	decideBscPatronSync,
	formatBscPatronOverview,
	nextBscCustomBackground,
	parseBscPatronTierInput,
	patronBitsForLevel,
	planBscPatronGift
} from '@/lib/bsc/patronTiers.js';
import { BitField, PerkTier } from '@/lib/constants.js';
import { patronMaxTripBonus } from '@/lib/util/calcMaxTripLength.js';
import { makeBadgeString } from '@/lib/util/makeBadgeString.js';

const envKeys = [
	'PATRON_ROLE_PUP',
	'PATRON_ROLE_GOODBOY',
	'PATRON_ROLE_TOPDOG',
	'PATRON_ROLE_ALPHA',
	'PATRON_ROLE_PACKLEADER',
	'PATRON_ROLE_BIGGESTOFDOGS',
	'PATREON_TIER_PUP_ID',
	'PATREON_TIER_GOODBOY_ID',
	'PATREON_TIER_TOPDOG_ID',
	'PATREON_TIER_ALPHA_ID',
	'PATREON_TIER_PACKLEADER_ID',
	'PATREON_TIER_BIGGESTOFDOGS_ID'
] as const;
const previous = new Map(envKeys.map(key => [key, process.env[key]]));

afterEach(() => {
	for (const key of envKeys) {
		const value = previous.get(key);
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
});

test('the six tiers map onto the existing patron bits', () => {
	expect(BSC_PATRON_TIERS.map(tier => [tier.level, tier.name, tier.priceUsd, tier.bit, tier.perkTier])).toEqual([
		[1, 'Pup', 3, BitField.PatronTier1, PerkTier.Two],
		[2, 'Good Boy', 5, BitField.PatronTier2, PerkTier.Three],
		[3, 'Top Dog', 10, BitField.PatronTier3, PerkTier.Four],
		[4, 'Alpha', 15, BitField.PatronTier4, PerkTier.Five],
		[5, 'Pack Leader', 25, BitField.PatronTier5, PerkTier.Six],
		[6, 'Biggest of Dogs', 50, BitField.PatronTier6, PerkTier.Seven]
	]);
	expect(BitField.BSCEarlySupporter).toBe(199);
	expect(patronBitsForLevel(2)).toEqual([BitField.PatronTier2]);
	expect(patronBitsForLevel(6)).toEqual([BitField.PatronTier6]);
	expect(patronBitsForLevel(0)).toEqual([]);
	expect(bscPatronLevelFromBits([BitField.BSCEarlySupporter, BitField.PatronTier6])).toBe(6);
	expect(parseBscPatronTierInput('alpha')).toBe(4);
	expect(parseBscPatronTierInput('Biggest of Dogs')).toBe(6);
	expect(parseBscPatronTierInput('nope')).toBeNull();
});

test('the highest Discord role wins and a blank role is skipped', () => {
	process.env.PATRON_ROLE_PUP = '111';
	process.env.PATRON_ROLE_GOODBOY = '222';
	process.env.PATRON_ROLE_TOPDOG = '333';
	process.env.PATRON_ROLE_ALPHA = '444';
	process.env.PATRON_ROLE_PACKLEADER = '555';
	delete process.env.PATRON_ROLE_BIGGESTOFDOGS;
	expect(bscPatronLevelFromRoles(['111', '444', '555'])).toBe(5);
	expect(bscPatronLevelFromRoles(['999'])).toBe(0);
	expect(bscPatronLevelFromRoles(['biggest-unconfigured'])).toBe(0);
	expect(bscPatronTiersMissingRoles().map(tier => tier.key)).toEqual(['biggestofdogs']);
	expect(bscPatronRoleChanges(['111', '444', '555'], 5)).toEqual({ add: null, remove: ['111', '444'] });
	expect(bscPatronRoleChanges(['222'], 4)).toEqual({ add: '444', remove: ['222'] });
	expect(bscPatronRoleChanges(['444'], 0)).toEqual({ add: null, remove: ['444'] });
});

test('trip length and grand exchange slots follow the ladder totals', () => {
	expect(bscPatronTripBonusMs([BitField.PatronTier1])).toBe(Time.Minute * 3);
	expect(bscPatronTripBonusMs([BitField.PatronTier2])).toBe(Time.Minute * 6);
	expect(bscPatronTripBonusMs([BitField.PatronTier3])).toBe(Time.Minute * 10);
	expect(bscPatronTripBonusMs([BitField.PatronTier4])).toBe(Time.Minute * 15);
	expect(bscPatronTripBonusMs([BitField.PatronTier5])).toBe(Time.Minute * 15);
	expect(bscPatronTripBonusMs([BitField.PatronTier6])).toBe(Time.Minute * 15);
	expect(bscPatronTripBonusMs([BitField.BSCEarlySupporter])).toBe(0);
	for (const tier of BSC_PATRON_TIERS) {
		expect(bscTripBonusForPerkTier(tier.perkTier)).toBe(tier.tripBonusMs);
		expect(patronMaxTripBonus(tier.perkTier)).toBe(tier.tripBonusMs);
		expect(bscGeSlotsForPerkTier(tier.perkTier)).toBe(tier.geSlots);
	}
	expect(BSC_PATRON_TIERS.map(tier => tier.geSlots)).toEqual([0, 2, 4, 8, 8, 8]);
	expect(bscDailyCooldownMs([BitField.PatronTier2], Time.Hour * 4)).toBe(Time.Hour * 4);
});

test('role sync upgrades, downgrades, and waits out cancel grace', () => {
	const now = 1_000_000;
	const upgraded = decideBscPatronSync({
		roleLevel: 4,
		now,
		state: { manual: false, tier: 1, roleMissingSince: null, customBackground: false }
	});
	expect(upgraded).toMatchObject({ skip: false, level: 4, roleMissingSince: null, reconcileRoles: true });

	const downgraded = decideBscPatronSync({
		roleLevel: 2,
		now,
		state: { manual: false, tier: 4, roleMissingSince: null, customBackground: false }
	});
	expect(downgraded.level).toBe(2);

	const cancelled = decideBscPatronSync({
		roleLevel: 0,
		now,
		state: { manual: false, tier: 3, roleMissingSince: null, customBackground: false }
	});
	expect(cancelled).toMatchObject({
		level: 3,
		roleMissingSince: now,
		reconcileRoles: false
	});

	const duringGrace = decideBscPatronSync({
		roleLevel: 0,
		now: now + BSC_PATRON_ROLE_GRACE_MS - 1,
		state: { manual: false, tier: 3, roleMissingSince: now, customBackground: false }
	});
	expect(duringGrace.level).toBe(3);
	expect(duringGrace.roleMissingSince).toBe(now);

	const graceOver = decideBscPatronSync({
		roleLevel: 0,
		now: now + BSC_PATRON_ROLE_GRACE_MS,
		state: { manual: false, tier: 3, roleMissingSince: now, customBackground: false }
	});
	expect(graceOver).toMatchObject({
		level: 0,
		roleMissingSince: null,
		reconcileRoles: true,
		customBackground: false
	});

	const returned = decideBscPatronSync({
		roleLevel: 3,
		now: now + Time.Hour,
		state: { manual: false, tier: 3, roleMissingSince: now, customBackground: false }
	});
	expect(returned).toMatchObject({ level: 3, roleMissingSince: null, reconcileRoles: true });

	const manual = decideBscPatronSync({
		roleLevel: 1,
		now,
		state: { manual: true, tier: 6, roleMissingSince: null, customBackground: true }
	});
	expect(manual.skip).toBe(true);
	expect(manual.level).toBe(6);
});

test('custom backgrounds unlock at Biggest of Dogs and stay through Pack Leader', () => {
	expect(nextBscCustomBackground(6, false)).toBe(true);
	expect(nextBscCustomBackground(5, true)).toBe(true);
	expect(nextBscCustomBackground(5, false)).toBe(false);
	expect(nextBscCustomBackground(4, true)).toBe(false);
	const kept = decideBscPatronSync({
		roleLevel: 5,
		now: 1,
		state: { manual: false, tier: 6, roleMissingSince: null, customBackground: true }
	});
	expect(kept.customBackground).toBe(true);
	const dropped = decideBscPatronSync({
		roleLevel: 4,
		now: 1,
		state: { manual: false, tier: 6, roleMissingSince: null, customBackground: true }
	});
	expect(dropped.customBackground).toBe(false);
});

test('gifts and double loot each have a monthly cooldown', () => {
	expect(bscGiftLevelForDonor(6)).toBe(4);
	expect(bscGiftLevelForDonor(5)).toBe(2);
	expect(bscGiftLevelForDonor(4)).toBe(0);
	const now = 5_000_000;
	expect(bscGiftCooldownRemaining(null, now)).toBe(0);
	expect(bscGiftCooldownRemaining(now - Time.Day, now)).toBe(Time.Day * 29);
	expect(bscGiftCooldownRemaining(now - Time.Day * 30, now)).toBe(0);

	const ready = planBscPatronGift({
		donorLevel: 6,
		donorLastGiftAt: null,
		recipientLevel: 0,
		recipientGiftTier: null,
		recipientGiftUntil: null,
		sameUser: false,
		recipientName: 'Friend',
		now
	});
	expect(ready).toMatchObject({ ok: true, giftLevel: 4 });

	const cooling = planBscPatronGift({
		donorLevel: 5,
		donorLastGiftAt: now - Time.Hour,
		recipientLevel: 0,
		recipientGiftTier: null,
		recipientGiftUntil: null,
		sameUser: false,
		recipientName: 'Friend',
		now
	});
	expect(cooling.ok).toBe(false);

	const already = planBscPatronGift({
		donorLevel: 6,
		donorLastGiftAt: null,
		recipientLevel: 4,
		recipientGiftTier: null,
		recipientGiftUntil: null,
		sameUser: false,
		recipientName: 'Friend',
		now
	});
	expect(already.ok).toBe(false);

	expect(bscDoubleLootDurationMs(PerkTier.Five)).toBeNull();
	expect(bscDoubleLootDurationMs(PerkTier.Six)).toBe(Time.Minute * 40);
	expect(bscDoubleLootDurationMs(PerkTier.Seven)).toBe(Time.Minute * 90);
	expect(bscDoubleLootCooldownRemaining(null, now)).toBe(0);
	expect(bscDoubleLootCooldownRemaining(now - Time.Day, now)).toBe(Time.Day * 30);
	expect(bscDoubleLootCooldownRemaining(now - Time.Day * 31, now)).toBe(0);
});

test('Patreon entitled tier ids map by env, and the patron page stays centralized', () => {
	process.env.PATREON_TIER_PUP_ID = 'pup-id';
	process.env.PATREON_TIER_TOPDOG_ID = 'top-id';
	process.env.PATREON_TIER_BIGGESTOFDOGS_ID = 'big-id';
	expect(bscPatronLevelFromPatreonTierIds(['pup-id', 'big-id'])).toBe(6);
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
	expect(makeBadgeString([], false, false, false, [BitField.PatronTier6])).toBe('👑');
	const overview = formatBscPatronOverview({
		bits: [BitField.PatronTier4],
		giftTier: null,
		giftUntil: null,
		lastGiftAt: null,
		customBackground: false,
		lastDoubleLootAt: null,
		now: 1
	});
	expect(overview).toContain('Bark School Corgo');
	expect(overview).toContain('https://patreon.com/bscbot');
	expect(overview).toContain('Biggest of Dogs ($50)');
	expect(overview).toContain('You are Alpha ($15)');
	expect(overview).not.toMatch(/\bOSB\b|\bBSO\b|oldschoolgg|magnaboy/i);
});
