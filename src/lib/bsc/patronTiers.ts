import { Time } from '@oldschoolgg/toolkit';

import { BitField, globalConfig, PerkTier } from '@/lib/constants.js';

/**
 * BSC patron tiers. Benefits stack: a higher tier includes the lower ones.
 * Nothing here grants GP, tradeable items, XP lamps, or drop-rate boosts.
 * BitField.BSCEarlySupporter (199) is not a patron tier.
 */
export interface BscPatronTier {
	level: 1 | 2 | 3;
	key: 'pup' | 'goodboy' | 'topdog';
	name: string;
	priceUsd: number;
	/** Existing patron bit. Pup = PatronTier1, Good Boy = PatronTier2, Top Dog = PatronTier3. */
	bit: BitField;
	/** Existing perk-tier number those bits already map to. */
	perkTier: PerkTier;
	/** Percent of the 30 minute base trip length. */
	tripLengthPercent: number;
	/** Multiplier on the normal daily cooldown. 1 means unchanged. */
	dailyCooldownMultiplier: number;
	roleEnv: 'PATRON_ROLE_PUP' | 'PATRON_ROLE_GOODBOY' | 'PATRON_ROLE_TOPDOG';
	patreonTierIdEnv: 'PATREON_TIER_PUP_ID' | 'PATREON_TIER_GOODBOY_ID' | 'PATREON_TIER_TOPDOG_ID';
	badge: string;
}

export const BSC_PATRON_TIERS: readonly BscPatronTier[] = [
	{
		level: 1,
		key: 'pup',
		name: 'Pup',
		priceUsd: 3,
		bit: BitField.PatronTier1,
		perkTier: PerkTier.Two,
		tripLengthPercent: 10,
		dailyCooldownMultiplier: 1,
		roleEnv: 'PATRON_ROLE_PUP',
		patreonTierIdEnv: 'PATREON_TIER_PUP_ID',
		badge: '🐾'
	},
	{
		level: 2,
		key: 'goodboy',
		name: 'Good Boy',
		priceUsd: 7,
		bit: BitField.PatronTier2,
		perkTier: PerkTier.Three,
		tripLengthPercent: 20,
		dailyCooldownMultiplier: 0.75,
		roleEnv: 'PATRON_ROLE_GOODBOY',
		patreonTierIdEnv: 'PATREON_TIER_GOODBOY_ID',
		badge: '🐾'
	},
	{
		level: 3,
		key: 'topdog',
		name: 'Top Dog',
		priceUsd: 15,
		bit: BitField.PatronTier3,
		perkTier: PerkTier.Four,
		tripLengthPercent: 20,
		dailyCooldownMultiplier: 0.75,
		roleEnv: 'PATRON_ROLE_TOPDOG',
		patreonTierIdEnv: 'PATREON_TIER_TOPDOG_ID',
		badge: '🐶'
	}
] as const;

export const BSC_PATRON_BITS: readonly BitField[] = BSC_PATRON_TIERS.map(tier => tier.bit);

/** Shown after a Good Boy or Top Dog claims the monthly cosmetic. Not an item. */
export const BSC_SUPPORTER_COSMETIC = '🎀';
export const BSC_COSMETIC_COOLDOWN = Time.Day * 30;

export function bscSupportServerId(): string {
	const fromEnv = process.env.SUPPORT_SERVER_ID?.trim();
	return fromEnv || globalConfig.supportServerID;
}

export function bscPatronRoleId(tier: BscPatronTier): string | null {
	const value = process.env[tier.roleEnv]?.trim();
	return value || null;
}

export function bscPatronRolesConfigured(): boolean {
	return BSC_PATRON_TIERS.some(tier => bscPatronRoleId(tier));
}

export function bscPatronTierByLevel(level: number): BscPatronTier | null {
	return BSC_PATRON_TIERS.find(tier => tier.level === level) ?? null;
}

export function bscPatronLevelFromBits(bits: readonly number[]): 0 | 1 | 2 | 3 {
	let level: 0 | 1 | 2 | 3 = 0;
	for (const tier of BSC_PATRON_TIERS) {
		if (bits.includes(tier.bit) && tier.level > level) level = tier.level;
	}
	return level;
}

export function bscPatronTierFromBits(bits: readonly number[]): BscPatronTier | null {
	return bscPatronTierByLevel(bscPatronLevelFromBits(bits));
}

/** Highest configured role wins. Unconfigured roles are ignored. */
export function bscPatronLevelFromRoles(roleIds: readonly string[]): 0 | 1 | 2 | 3 {
	let level: 0 | 1 | 2 | 3 = 0;
	for (const tier of BSC_PATRON_TIERS) {
		const roleId = bscPatronRoleId(tier);
		if (roleId && roleIds.includes(roleId) && tier.level > level) level = tier.level;
	}
	return level;
}

export function patronBitsForLevel(level: number): BitField[] {
	const tier = bscPatronTierByLevel(level);
	return tier ? [tier.bit] : [];
}

/** Percent of the 30 minute base. 0 when the user has no BSC patron bit. */
export function bscPatronTripBonusMs(bits: readonly number[], baseMs = Time.Minute * 30): number {
	const tier = bscPatronTierFromBits(bits);
	if (!tier) return 0;
	return Math.floor((baseMs * tier.tripLengthPercent) / 100);
}

export function bscDailyCooldownMs(bits: readonly number[], baseMs: number): number {
	const tier = bscPatronTierFromBits(bits);
	if (!tier) return baseMs;
	return Math.floor(baseMs * tier.dailyCooldownMultiplier);
}

export function bscPatreonTierId(tier: BscPatronTier): string | null {
	const value = process.env[tier.patreonTierIdEnv]?.trim();
	return value || null;
}

/** Map Patreon entitled-tier ids onto BSC levels. Unknown ids are ignored. Highest wins. */
export function bscPatronLevelFromPatreonTierIds(entitledTierIds: readonly string[]): 0 | 1 | 2 | 3 {
	let level: 0 | 1 | 2 | 3 = 0;
	for (const tier of BSC_PATRON_TIERS) {
		const id = bscPatreonTierId(tier);
		if (id && entitledTierIds.includes(id) && tier.level > level) level = tier.level;
	}
	return level;
}
