import { customEmoji, Time } from '@oldschoolgg/toolkit';

import { BitField, globalConfig, PerkTier } from '@/lib/constants.js';
import { patreonUrl, withPatreonLink } from '@/lib/patreonLink.js';

/**
 * Bark School Corgo patron ladder. Higher tiers include every lower perk.
 * The six levels use the six existing patron bits (PatronTier1 through PatronTier6),
 * which already map onto PerkTier Two through Seven.
 * BitField.BSCEarlySupporter (199) is not a patron tier.
 */
export type BscPatronLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface BscPatronTier {
	level: Exclude<BscPatronLevel, 0>;
	key: 'pup' | 'goodboy' | 'topdog' | 'alpha' | 'packleader' | 'biggestofdogs';
	name: string;
	priceUsd: number;
	/** Existing patron bit. One bit per tier, highest only. */
	bit: BitField;
	/** Perk tier that bit already grants in getUsersPerkTier. */
	perkTier: PerkTier;
	/** Added to the 30 minute base. Totals, not stacked on the tier below. */
	tripBonusMs: number;
	/** Extra Grand Exchange slots at this tier. Totals, not stacked on the tier below. */
	geSlots: number;
	roleEnv:
	| 'PATRON_ROLE_PUP'
	| 'PATRON_ROLE_GOODBOY'
	| 'PATRON_ROLE_TOPDOG'
	| 'PATRON_ROLE_ALPHA'
	| 'PATRON_ROLE_PACKLEADER'
	| 'PATRON_ROLE_BIGGESTOFDOGS';
	patreonTierIdEnv:
	| 'PATREON_TIER_PUP_ID'
	| 'PATREON_TIER_GOODBOY_ID'
	| 'PATREON_TIER_TOPDOG_ID'
	| 'PATREON_TIER_ALPHA_ID'
	| 'PATREON_TIER_PACKLEADER_ID'
	| 'PATREON_TIER_BIGGESTOFDOGS_ID';
	badge: string;
	/** New perks at this tier, with trip/GE/queue/points totals. */
	adds: string;
	/** Full cumulative perks for denial messages. */
	summary: string;
}

export const BSC_PATRON_TIERS: readonly BscPatronTier[] = [
	{
		level: 1,
		key: 'pup',
		name: 'Pup',
		priceUsd: 3,
		bit: BitField.PatronTier1,
		perkTier: PerkTier.Two,
		tripBonusMs: Time.Minute * 3,
		geSlots: 0,
		roleEnv: 'PATRON_ROLE_PUP',
		patreonTierIdEnv: 'PATREON_TIER_PUP_ID',
		badge: customEmoji('patron_pup'),
		adds: '+3 min trips, full scrollable bank (show_all) and bank page buttons, queue 3 trips everyday, 3 pts/mo, loyalty badges (1-month as soon as you are a patron; 3/6/12 from a continuous paid streak), /tools patron purple_glow, /patron profile, patron dye shop, Barrows bank background (night normally, bright day sky on a good drop)',
		summary:
			'+3 min trips, full scrollable bank (show_all) and bank page buttons, queue 3 trips everyday, 3 pts/mo, loyalty badges (1-month as soon as you are a patron; 3/6/12 from a continuous paid streak), /tools patron purple_glow, /patron profile, patron dye shop, Barrows bank background (night normally, bright day sky on a good drop)'
	},
	{
		level: 2,
		key: 'goodboy',
		name: 'Good Boy',
		priceUsd: 5,
		bit: BitField.PatronTier2,
		perkTier: PerkTier.Three,
		tripBonusMs: Time.Minute * 6,
		geSlots: 2,
		roleEnv: 'PATRON_ROLE_GOODBOY',
		patreonTierIdEnv: 'PATREON_TIER_GOODBOY_ID',
		badge: customEmoji('patron_goodboy'),
		adds: 'All Pup perks, plus +6 min trips, +2 Grand Exchange slots, 5 pts/mo, queue 4 trips everyday, Good Boy bank background (normal and celebratory), Corgo collar badge, Discord role, higher sim caps',
		summary:
			'+6 min trips, full scrollable bank (show_all) and bank page buttons, queue 4 trips everyday, +2 Grand Exchange slots, 5 pts/mo, loyalty badges (1-month as soon as you are a patron; 3/6/12 from a continuous paid streak), /tools patron purple_glow, /patron profile, patron dye shop, Barrows bank background (night normally, bright day sky on a good drop), Good Boy bank background (normal and celebratory), Corgo collar badge, Discord role, higher sim caps'
	},
	{
		level: 3,
		key: 'topdog',
		name: 'Top Dog',
		priceUsd: 10,
		bit: BitField.PatronTier3,
		perkTier: PerkTier.Four,
		tripBonusMs: Time.Minute * 10,
		geSlots: 4,
		roleEnv: 'PATRON_ROLE_TOPDOG',
		patreonTierIdEnv: 'PATREON_TIER_TOPDOG_ID',
		badge: customEmoji('patron_topdog'),
		adds: 'All Good Boy perks, plus +10 min trips, +4 Grand Exchange slots, 10 pts/mo, queue 5 trips everyday, give a mystery box (23.5 hour cooldown), full trip-repeat buttons, custom minion icon, custom tame image, /patron title, /patron flair, Transparent bank background',
		summary:
			'+10 min trips, full scrollable bank (show_all) and bank page buttons, queue 5 trips everyday, +4 Grand Exchange slots, 10 pts/mo, loyalty badges (1-month as soon as you are a patron; 3/6/12 from a continuous paid streak), /tools patron purple_glow, /patron profile, patron dye shop, Barrows bank background (night normally, bright day sky on a good drop), Good Boy bank background (normal and celebratory), Corgo collar badge, Discord role, higher sim caps, give a mystery box (23.5 hour cooldown), full trip-repeat buttons, custom minion icon, custom tame image, /patron title, /patron flair, Transparent bank background'
	},
	{
		level: 4,
		key: 'alpha',
		name: 'Alpha',
		priceUsd: 15,
		bit: BitField.PatronTier4,
		perkTier: PerkTier.Five,
		tripBonusMs: Time.Minute * 15,
		geSlots: 8,
		roleEnv: 'PATRON_ROLE_ALPHA',
		patreonTierIdEnv: 'PATREON_TIER_ALPHA_ID',
		badge: customEmoji('patron_alpha'),
		adds: 'All Top Dog perks, plus +15 min trips, +8 Grand Exchange slots, 15 pts/mo, queue 6 trips everyday, every paid bank background plus custom bank colour, spawn lamp and spawn box, unlimited giveaways',
		summary:
			'+15 min trips, full scrollable bank (show_all) and bank page buttons, queue 6 trips everyday, +8 Grand Exchange slots, 15 pts/mo, loyalty badges (1-month as soon as you are a patron; 3/6/12 from a continuous paid streak), /tools patron purple_glow, /patron profile, patron dye shop, Barrows bank background (night normally, bright day sky on a good drop), Good Boy bank background (normal and celebratory), Corgo collar badge, Discord role, higher sim caps, give a mystery box (23.5 hour cooldown), full trip-repeat buttons, custom minion icon, custom tame image, /patron title, /patron flair, every paid bank background plus custom bank colour, spawn lamp and spawn box, unlimited giveaways'
	},
	{
		level: 5,
		key: 'packleader',
		name: 'Pack Leader',
		priceUsd: 25,
		bit: BitField.PatronTier5,
		perkTier: PerkTier.Six,
		tripBonusMs: Time.Minute * 18,
		geSlots: 8,
		roleEnv: 'PATRON_ROLE_PACKLEADER',
		patreonTierIdEnv: 'PATREON_TIER_PACKLEADER_ID',
		badge: customEmoji('patron_packleader'),
		adds: 'All Alpha perks, plus +18 min trips, 25 pts/mo, queue 7 trips everyday, Verzik bank background (the fight normally, the purple chest on a good drop), 40 min server double loot once every 31 days, gift 1 week of Good Boy once a month',
		summary:
			'+18 min trips, full scrollable bank (show_all) and bank page buttons, queue 7 trips everyday, +8 Grand Exchange slots, 25 pts/mo, loyalty badges (1-month as soon as you are a patron; 3/6/12 from a continuous paid streak), /tools patron purple_glow, /patron profile, patron dye shop, Barrows bank background (night normally, bright day sky on a good drop), Good Boy bank background (normal and celebratory), Corgo collar badge, Discord role, higher sim caps, give a mystery box (23.5 hour cooldown), full trip-repeat buttons, custom minion icon, custom tame image, /patron title, /patron flair, every paid bank background plus custom bank colour, spawn lamp and spawn box, unlimited giveaways, Verzik bank background (the fight normally, the purple chest on a good drop), 40 min server double loot once every 31 days, gift 1 week of Good Boy once a month'
	},
	{
		level: 6,
		key: 'biggestofdogs',
		name: 'Biggest of Dogs',
		priceUsd: 50,
		bit: BitField.PatronTier6,
		perkTier: PerkTier.Seven,
		tripBonusMs: Time.Minute * 20,
		geSlots: 8,
		roleEnv: 'PATRON_ROLE_BIGGESTOFDOGS',
		patreonTierIdEnv: 'PATREON_TIER_BIGGESTOFDOGS_ID',
		badge: customEmoji('patron_biggestofdogs'),
		adds: 'All Pack Leader perks, plus +20 min trips, 50 pts/mo, queue 8 trips everyday, fully custom bank background while you stay Pack Leader or higher, 90 min server double loot once every 31 days, gift 1 week of Alpha once a month',
		summary:
			'+20 min trips, full scrollable bank (show_all) and bank page buttons, queue 8 trips everyday, +8 Grand Exchange slots, 50 pts/mo, loyalty badges (1-month as soon as you are a patron; 3/6/12 from a continuous paid streak), /tools patron purple_glow, /patron profile, patron dye shop, Barrows bank background (night normally, bright day sky on a good drop), Good Boy bank background (normal and celebratory), Corgo collar badge, Discord role, higher sim caps, give a mystery box (23.5 hour cooldown), full trip-repeat buttons, custom minion icon, custom tame image, /patron title, /patron flair, every paid bank background plus custom bank colour, spawn lamp and spawn box, unlimited giveaways, Verzik bank background (the fight normally, the purple chest on a good drop), 40 min server double loot once every 31 days, gift 1 week of Good Boy once a month, fully custom bank background while you stay Pack Leader or higher, 90 min server double loot once every 31 days, gift 1 week of Alpha once a month'
	}
] as const;

export const BSC_PATRON_BITS: readonly BitField[] = BSC_PATRON_TIERS.map(tier => tier.bit);

/**
 * Extra Grand Exchange slots from patron perk tiers.
 * Amounts stack so the totals match the ladder: Good Boy 2, Top Dog 4, Alpha and above 8.
 */
export const BSC_GE_SLOT_BOOSTS = [
	{ minPerk: PerkTier.Three, amount: 2, name: 'Good Boy' },
	{ minPerk: PerkTier.Four, amount: 2, name: 'Top Dog' },
	{ minPerk: PerkTier.Five, amount: 4, name: 'Alpha' }
] as const;

/** Shown after a Good Boy or higher claims the monthly cosmetic. Not an item. */
export const BSC_SUPPORTER_COSMETIC = '🎀';
export const BSC_COSMETIC_COOLDOWN = Time.Day * 30;

/** Perks stay for this long after the Discord tier role disappears. */
export const BSC_PATRON_ROLE_GRACE_MS = Time.Day * 3;

export const BSC_PATRON_GIFT_COOLDOWN_MS = Time.Day * 30;
export const BSC_PATRON_GIFT_DURATION_MS = Time.Week;

/** Same monthly window the existing double-loot command already used. */
export const PATRON_DOUBLE_LOOT_COOLDOWN = Time.Day * 31;

export function bscSupportServerId(): string {
	const fromEnv = process.env.SUPPORT_SERVER_ID?.trim();
	return fromEnv || globalConfig.supportServerID;
}

export function bscPatronRoleId(tier: BscPatronTier): string | null {
	const value = process.env[tier.roleEnv]?.trim();
	return value || null;
}

export function bscPatronTiersMissingRoles(): BscPatronTier[] {
	return BSC_PATRON_TIERS.filter(tier => !bscPatronRoleId(tier));
}

export function bscPatronRolesConfigured(): boolean {
	return BSC_PATRON_TIERS.some(tier => bscPatronRoleId(tier));
}

let warnedBlankPatronRoles = false;

/** One warning for every blank role env. A blank tier is skipped. The process keeps running. */
export function warnBlankBscPatronRoles() {
	if (warnedBlankPatronRoles || process.env.TEST || process.env.VITEST) return;
	warnedBlankPatronRoles = true;
	const missing = bscPatronTiersMissingRoles();
	if (missing.length === 0) return;
	const message = `BSC patron: no Discord role id for ${missing
		.map(tier => `${tier.name} (${tier.roleEnv})`)
		.join(', ')}. Those tiers are skipped. The bot will keep running.`;
	console.warn(message);
	Logging.logDebug(message);
}

export function bscPatronTierByLevel(level: number): BscPatronTier | null {
	return BSC_PATRON_TIERS.find(tier => tier.level === level) ?? null;
}

export function bscPatronTierByKey(key: string): BscPatronTier | null {
	const normalized = key
		.trim()
		.toLowerCase()
		.replace(/[\s_-]+/g, '');
	return BSC_PATRON_TIERS.find(tier => tier.key === normalized) ?? null;
}

export function bscPatronNameForPerkTier(perkTier: number): string | null {
	return BSC_PATRON_TIERS.find(tier => tier.perkTier === perkTier)?.name ?? null;
}

/** Player-facing denial: names the required BSC tier and its current perks. */
export function formatBscPatronRequirement(perkTierNeeded: number): string {
	const tier = BSC_PATRON_TIERS.find(entry => entry.perkTier === perkTierNeeded);
	if (!tier) {
		return 'You need to be a Bark School Corgo patron to use this.';
	}
	return `This needs ${tier.name} or higher. ${tier.name} ($${tier.priceUsd}) includes: ${tier.summary}.`;
}

function clampLevel(level: number): BscPatronLevel {
	if (!Number.isInteger(level) || level <= 0) return 0;
	if (level >= 6) return 6;
	return level as BscPatronLevel;
}

export function parseBscPatronTierInput(input: string): BscPatronLevel | null {
	const key = input
		.trim()
		.toLowerCase()
		.replace(/[\s_-]+/g, '');
	const table: Record<string, BscPatronLevel> = {
		'0': 0,
		none: 0,
		clear: 0,
		'1': 1,
		pup: 1,
		'2': 2,
		goodboy: 2,
		'3': 3,
		topdog: 3,
		'4': 4,
		alpha: 4,
		'5': 5,
		packleader: 5,
		'6': 6,
		biggestofdogs: 6,
		biggest: 6
	};
	return key in table ? table[key]! : null;
}

export function bscPatronLevelFromBits(bits: readonly number[]): BscPatronLevel {
	let level: BscPatronLevel = 0;
	for (const tier of BSC_PATRON_TIERS) {
		if (bits.includes(tier.bit) && tier.level > level) level = tier.level;
	}
	return level;
}

export function bscPatronTierFromBits(bits: readonly number[]): BscPatronTier | null {
	return bscPatronTierByLevel(bscPatronLevelFromBits(bits));
}

/** Staff roles (DJ, Owner, Admin, Head Mod, Mod) get Top Dog perks for free. STAFF_ROLE_IDS overrides. */
export const BSC_STAFF_PATRON_LEVEL: BscPatronLevel = 3;
const DEFAULT_STAFF_ROLE_IDS = [
	'1385684584976482374',
	'1456110293825355819',
	'1353916725086785646',
	'1325179339641458749',
	'1496337775560232970'
];

export function bscStaffRoleIds(): string[] {
	const raw = process.env.STAFF_ROLE_IDS?.trim();
	if (!raw) return DEFAULT_STAFF_ROLE_IDS;
	return raw
		.split(',')
		.map(id => id.trim())
		.filter(Boolean);
}

export function bscStaffLevelFromRoles(roleIds: readonly string[]): BscPatronLevel {
	return bscStaffRoleIds().some(id => roleIds.includes(id)) ? BSC_STAFF_PATRON_LEVEL : 0;
}

/** Highest configured role wins. Unconfigured roles are ignored. */
export function bscPatronLevelFromRoles(roleIds: readonly string[]): BscPatronLevel {
	let level: BscPatronLevel = 0;
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

export function bscPatronTripBonusMs(bits: readonly number[]): number {
	return bscPatronTierFromBits(bits)?.tripBonusMs ?? 0;
}

/** Trip minutes for a perk tier, including a gifted tier that has no patron bit yet. */
export function bscTripBonusForPerkTier(perkTier: number): number {
	const tier = [...BSC_PATRON_TIERS].reverse().find(entry => perkTier >= entry.perkTier);
	return tier?.tripBonusMs ?? 0;
}

export function bscGeSlotsForPerkTier(perkTier: number): number {
	return BSC_GE_SLOT_BOOSTS.reduce((sum, boost) => (perkTier >= boost.minPerk ? sum + boost.amount : sum), 0);
}

export function bscDailyCooldownMs(bits: readonly number[], baseMs: number): number {
	void bscPatronTierFromBits(bits);
	return baseMs;
}

export function bscPatreonTierId(tier: BscPatronTier): string | null {
	const value = process.env[tier.patreonTierIdEnv]?.trim();
	return value || null;
}

/** Map Patreon entitled-tier ids onto BSC levels. Unknown ids are ignored. Highest wins. */
export function bscPatronLevelFromPatreonTierIds(entitledTierIds: readonly string[]): BscPatronLevel {
	let level: BscPatronLevel = 0;
	for (const tier of BSC_PATRON_TIERS) {
		const id = bscPatreonTierId(tier);
		if (id && entitledTierIds.includes(id) && tier.level > level) level = tier.level;
	}
	return level;
}

export interface BscPatronRoleChange {
	add: string | null;
	remove: string[];
}

/** Keep the highest tier role and drop the other configured tier roles. */
export function bscPatronRoleChanges(currentRoleIds: readonly string[], level: number): BscPatronRoleChange {
	const target = bscPatronTierByLevel(level);
	const addId = target ? bscPatronRoleId(target) : null;
	const remove: string[] = [];
	for (const tier of BSC_PATRON_TIERS) {
		const roleId = bscPatronRoleId(tier);
		if (!roleId || !currentRoleIds.includes(roleId)) continue;
		if (roleId === addId) continue;
		remove.push(roleId);
	}
	const add = addId && !currentRoleIds.includes(addId) ? addId : null;
	return { add, remove };
}

/**
 * Biggest of Dogs unlocks a custom background. It stays while they are Pack Leader or higher.
 */
export function nextBscCustomBackground(level: number, currentlyEntitled: boolean): boolean {
	if (level >= 6) return true;
	if (level >= 5) return currentlyEntitled;
	return false;
}

export interface BscPatronSyncState {
	manual: boolean;
	tier: number;
	roleMissingSince: number | null;
	customBackground: boolean;
}

export interface BscPatronSyncDecision {
	skip: boolean;
	level: BscPatronLevel;
	roleMissingSince: number | null;
	reconcileRoles: boolean;
	customBackground: boolean;
}

/**
 * Discord roles are the source of truth.
 * Losing every tier role starts a grace window instead of clearing perks immediately.
 */
export function decideBscPatronSync(input: {
	roleLevel: number;
	now: number;
	state: BscPatronSyncState | null;
	graceMs?: number;
}): BscPatronSyncDecision {
	const graceMs = input.graceMs ?? BSC_PATRON_ROLE_GRACE_MS;
	const state = input.state;
	if (state?.manual) {
		return {
			skip: true,
			level: clampLevel(state.tier),
			roleMissingSince: state.roleMissingSince,
			reconcileRoles: false,
			customBackground: state.customBackground
		};
	}

	const roleLevel = clampLevel(input.roleLevel);
	if (roleLevel > 0) {
		return {
			skip: false,
			level: roleLevel,
			roleMissingSince: null,
			reconcileRoles: true,
			customBackground: nextBscCustomBackground(roleLevel, state?.customBackground ?? false)
		};
	}

	const current = clampLevel(state?.tier ?? 0);
	if (current === 0) {
		return {
			skip: false,
			level: 0,
			roleMissingSince: null,
			reconcileRoles: true,
			customBackground: false
		};
	}

	const missingSince = state?.roleMissingSince ?? null;
	if (missingSince === null || input.now - missingSince < graceMs) {
		return {
			skip: false,
			level: current,
			roleMissingSince: missingSince ?? input.now,
			reconcileRoles: false,
			customBackground: nextBscCustomBackground(current, state?.customBackground ?? false)
		};
	}

	return {
		skip: false,
		level: 0,
		roleMissingSince: null,
		reconcileRoles: true,
		customBackground: false
	};
}

/** Pack Leader gifts Good Boy. Biggest of Dogs gifts Alpha. 0 means they cannot gift. */
export function bscGiftLevelForDonor(donorLevel: number): BscPatronLevel {
	if (donorLevel >= 6) return 4;
	if (donorLevel >= 5) return 2;
	return 0;
}

export function bscGiftCooldownRemaining(lastGiftAt: number | null, now: number): number {
	if (!lastGiftAt) return 0;
	const remaining = BSC_PATRON_GIFT_COOLDOWN_MS - (now - lastGiftAt);
	return remaining > 0 ? remaining : 0;
}

export interface BscGiftPlan {
	ok: true;
	giftLevel: Exclude<BscPatronLevel, 0>;
	until: number;
	message: string;
}

export function planBscPatronGift(input: {
	donorLevel: number;
	donorLastGiftAt: number | null;
	recipientLevel: number;
	recipientGiftTier: number | null;
	recipientGiftUntil: number | null;
	sameUser: boolean;
	recipientName: string;
	now: number;
}): BscGiftPlan | { ok: false; message: string } {
	if (input.sameUser) return { ok: false, message: "You can't gift patron time to yourself." };
	const giftLevel = bscGiftLevelForDonor(input.donorLevel);
	const giftTier = bscPatronTierByLevel(giftLevel);
	if (!giftTier) {
		return {
			ok: false,
			message: withPatreonLink(
				'Gifting patron time is a Pack Leader perk. Biggest of Dogs gifts 1 week of Alpha.'
			)
		};
	}
	const cooldown = bscGiftCooldownRemaining(input.donorLastGiftAt, input.now);
	if (cooldown > 0) {
		const days = Math.ceil(cooldown / Time.Day);
		return {
			ok: false,
			message: `You already gifted patron time this month. You can gift again in ${days} day${days === 1 ? '' : 's'}.`
		};
	}
	const activeGift = bscActiveGiftLevel(input.recipientGiftTier, input.recipientGiftUntil, input.now);
	if (input.recipientLevel >= giftLevel || activeGift >= giftLevel) {
		return {
			ok: false,
			message: `${input.recipientName} already has ${giftTier.name} or higher.`
		};
	}
	const until = input.now + BSC_PATRON_GIFT_DURATION_MS;
	return {
		ok: true,
		giftLevel: giftTier.level,
		until,
		message: `Gifted 1 week of ${giftTier.name} to ${input.recipientName}. You can gift again in 30 days.`
	};
}

export function bscActiveGiftLevel(giftTier: number | null, giftUntil: number | null, now: number): BscPatronLevel {
	if (!giftTier || !giftUntil || giftUntil <= now) return 0;
	return clampLevel(giftTier);
}

export function bscActiveGiftPerkTier(giftTier: number | null, giftUntil: number | null, now: number): number {
	return bscPatronTierByLevel(bscActiveGiftLevel(giftTier, giftUntil, now))?.perkTier ?? 0;
}

export function bscDoubleLootDurationMs(perkTier: number): number | null {
	if (perkTier >= PerkTier.Seven) return Time.Minute * 90;
	if (perkTier >= PerkTier.Six) return Time.Minute * 40;
	return null;
}

export function bscDoubleLootCooldownRemaining(lastTriggerAt: number | null, now: number): number {
	if (!lastTriggerAt) return 0;
	const remaining = PATRON_DOUBLE_LOOT_COOLDOWN - (now - lastTriggerAt);
	return remaining > 0 ? remaining : 0;
}

export function formatBscPatronOverview(input: {
	bits: readonly number[];
	giftTier: number | null;
	giftUntil: number | null;
	lastGiftAt: number | null;
	customBackground: boolean;
	lastDoubleLootAt: number | null;
	now?: number;
	title?: string | null;
	flair?: string | null;
	points?: number | null;
	monthsTotal?: number | null;
	monthsStreak?: number | null;
	loyaltyLabel?: string | null;
}): string {
	const now = input.now ?? Date.now();
	const bitLevel = bscPatronLevelFromBits(input.bits);
	const giftLevel = bscActiveGiftLevel(input.giftTier, input.giftUntil, now);
	const effective = clampLevel(Math.max(bitLevel, giftLevel));
	const tier = bscPatronTierByLevel(effective);
	const lines = [
		'Bark School Corgo patrons. Each tier includes every perk below it. Trip minutes and Grand Exchange slots are the totals for that tier.',
		patreonUrl(),
		''
	];
	if (!tier) {
		lines.push('You do not have a patron tier.');
	} else {
		const giftNote =
			giftLevel > bitLevel ? ` This includes a gifted ${bscPatronTierByLevel(giftLevel)?.name ?? 'tier'}.` : '';
		lines.push(
			`You are ${tier.name} ($${tier.priceUsd}). Trip bonus: +${tier.tripBonusMs / Time.Minute} min. Extra Grand Exchange slots: ${tier.geSlots}.${giftNote}`
		);
		if (input.title) lines.push(`Title: ${input.title}`);
		if (input.flair) lines.push(`Trip flair: ${input.flair}`);
		if (input.loyaltyLabel) lines.push(`Loyalty: ${input.loyaltyLabel}`);
		if (typeof input.points === 'number') lines.push(`Patron points: ${input.points}`);
	}
	if (input.customBackground && effective >= 5) {
		lines.push('Your custom bank background is active while you stay Pack Leader or higher.');
	}
	const giftOffer = bscGiftLevelForDonor(bitLevel);
	const giftTier = bscPatronTierByLevel(giftOffer);
	if (giftTier) {
		const cooldown = bscGiftCooldownRemaining(input.lastGiftAt, now);
		lines.push(
			cooldown > 0
				? `Gift cooldown: ${Math.ceil(cooldown / Time.Day)} days left on 1 week of ${giftTier.name}.`
				: `You can gift 1 week of ${giftTier.name} with /patron gift.`
		);
	}
	if (tier && tier.perkTier >= PerkTier.Six) {
		const cooldown = bscDoubleLootCooldownRemaining(input.lastDoubleLootAt, now);
		const duration = bscDoubleLootDurationMs(tier.perkTier)! / Time.Minute;
		lines.push(
			cooldown > 0
				? `Double loot cooldown: ${Math.ceil(cooldown / Time.Day)} days left (${duration} min when it is ready).`
				: `You can start ${duration} min of server double loot with /patron double_loot.`
		);
	}
	lines.push('');
	for (const entry of BSC_PATRON_TIERS) {
		lines.push(`${entry.name} ($${entry.priceUsd}) — ${entry.adds}`);
	}
	lines.push('');
	lines.push(
		'Commands: /patron info, /patron title, /patron flair, /patron profile, /patron dyes, /patron dye, /patron dyeclaim, /patron dye_preview, /patron undye, /patron double_loot, /patron gift user:@friend'
	);
	return lines.join('\n');
}
