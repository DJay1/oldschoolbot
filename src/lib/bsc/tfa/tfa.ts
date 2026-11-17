import { calcWhatPercent, formatDuration, Time } from '@oldschoolgg/toolkit';
import { MathRNG, type RNGProvider } from 'node-rng';
import { Bank, Items } from 'oldschooljs';

import { tfaFragmentsUsed } from '@/lib/bsc/tfa/tfaFragments.js';
import { TfaItem, tfaAscensionBoltIDs } from '@/lib/bsc/tfa/tfaItems.js';
import { type TfaRoomBoosts, tfaRoomBoostsFor, tfaTeamRoomPercent } from '@/lib/bsc/tfa/tfaRooms.js';
import { BitField } from '@/lib/constants.js';
import { calcTOBRangePercent, calculateTOBUserGearPercents } from '@/lib/data/tob.js';
import { QuestID } from '@/lib/minions/data/quests.js';
import { Gear } from '@/lib/structures/Gear.js';
import type { Skills } from '@/lib/types/index.js';
import { formatSkillRequirements } from '@/lib/util/smallUtils.js';

export type TfaStyle = 'melee' | 'range' | 'mage' | 'hybrid';

export interface TfaBoss {
	id: number;
	name: string;
	style: TfaStyle;
	baseTime: number;
	points: number;
	deathMultiplier: number;
}

export const TFA_BOSSES: TfaBoss[] = [
	{ id: 1, name: 'Archive Guardian', style: 'range', baseTime: Time.Minute * 7, points: 100, deathMultiplier: 1 },
	{ id: 2, name: 'Ezekiel', style: 'melee', baseTime: Time.Minute * 6, points: 100, deathMultiplier: 1 },
	{ id: 3, name: 'Bork and the Smorks', style: 'melee', baseTime: Time.Minute * 6, points: 100, deathMultiplier: 1 },
	{ id: 4, name: 'Moia', style: 'mage', baseTime: Time.Minute * 6, points: 100, deathMultiplier: 1 },
	{
		id: 5,
		name: 'Dreadnoth the Jellied',
		style: 'range',
		baseTime: Time.Minute * 6,
		points: 100,
		deathMultiplier: 1
	},
	{ id: 6, name: "The Dagon'hai", style: 'mage', baseTime: Time.Minute * 7, points: 100, deathMultiplier: 1.1 },
	{ id: 7, name: 'Xarth', style: 'melee', baseTime: Time.Minute * 7, points: 100, deathMultiplier: 1.1 },
	{ id: 8, name: 'Ocellus', style: 'hybrid', baseTime: Time.Minute * 12, points: 300, deathMultiplier: 1.5 }
];

export const TFA_TOTAL_POINTS = 700;
const LOBBY_TIME = Time.Minute * 3;

export function tfaBossByID(id: number): TfaBoss {
	const boss = TFA_BOSSES.find(b => b.id === id);
	if (!boss) throw new Error(`Invalid Fractured Archive boss ${id}`);
	return boss;
}

/** Archive Guardian first, one boss from each pair, Ocellus last (5 bosses). */
export function pickTfaBosses(rng: RNGProvider = MathRNG): number[] {
	return [1, rng.roll(2) ? 2 : 3, rng.roll(2) ? 4 : 5, rng.roll(2) ? 6 : 7, 8];
}

export const minTfaStats: Skills = {
	attack: 90,
	strength: 90,
	defence: 90,
	ranged: 90,
	magic: 90,
	hitpoints: 90,
	prayer: 77
};

/** Every this many KC, one less Saradomin brew(4) is needed per raid (like CoX and DoA). */
export const TFA_SUPPLY_KC_STEP = 50;
const TFA_BASE_BREWS = 8;
const TFA_MIN_BREWS = 4;
const TFA_MIN_RESTORES = 3;

/**
 * Supplies used per raid for a player with this KC (lost even if the team wipes).
 * Brews: 8 at 0-49 KC, then one fewer every 50 KC, down to 4 at 200+ KC. Restores: 3/4 of the brews (rounded up, min 3).
 * Combat and ranging potions don't change.
 */
export function tfaSuppliesForKc(kc: number): Bank {
	const safeKc = Number.isFinite(kc) ? Math.max(0, kc) : 0;
	const brews = Math.max(TFA_MIN_BREWS, TFA_BASE_BREWS - Math.floor(safeKc / TFA_SUPPLY_KC_STEP));
	const restores = Math.max(TFA_MIN_RESTORES, Math.ceil((brews * 3) / 4));
	return new Bank({
		'Saradomin brew(4)': brews,
		'Super restore(4)': restores,
		'Super combat potion(4)': 1,
		'Ranging potion(4)': 1
	});
}

/** Supplies per raid at 0 KC (the most anyone needs). */
export const tfaSuppliesPerRaid = tfaSuppliesForKc(0);

export const TFA_MIN_GEAR_PERCENT = 30;
export const TFA_MAX_QUANTITY = 10;

/** Time reduction caps (percent). */
const GEAR_REDUCTION = 20;
const KC_REDUCTION = 25;
const ITEM_REDUCTION_CAP = 12;
const KC_FOR_MAX_SPEED = 200;

const TEAM_SIZE_TIME_FACTOR: Record<number, number> = {
	1: 1.15,
	2: 1,
	3: 0.92,
	4: 0.86,
	5: 0.82,
	6: 0.79,
	7: 0.77,
	8: 0.75
};

export interface TfaGearPercents {
	melee: number;
	range: number;
	mage: number;
	total: number;
}

export interface TfaBoost {
	name: string;
	percent: number;
}

export interface TfaTeamMember {
	id: string;
	kc: number;
	gear: TfaGearPercents;
	boosts: TfaBoost[];
	/** Relative reduction to death chance from items (0-100). */
	deathReduction: number;
	/** Room-only speed boosts, applied only to that boss's room when it's rolled. */
	roomBoosts?: TfaRoomBoosts;
}

function stylePercent(gear: TfaGearPercents, style: TfaStyle) {
	if (style === 'hybrid') return gear.total;
	return gear[style];
}

export function tfaKcEffectiveness(kc: number) {
	return Math.min(100, calcWhatPercent(kc, KC_FOR_MAX_SPEED));
}

export function tfaUserSpeedReduction(member: TfaTeamMember) {
	const gear = (member.gear.total / 100) * GEAR_REDUCTION;
	const kc = (tfaKcEffectiveness(member.kc) / 100) * KC_REDUCTION;
	const items = Math.min(
		ITEM_REDUCTION_CAP,
		member.boosts.reduce((acc, b) => acc + b.percent, 0)
	);
	return gear + kc + items;
}

/** Death chance (percent) for one player at one boss. */
export function tfaDeathChance(member: TfaTeamMember, boss: TfaBoss) {
	const base = Math.max(1.5, 8 - member.kc * 0.035);
	const gearPenalty = (100 - stylePercent(member.gear, boss.style)) * 0.08;
	let chance = (base + gearPenalty) * boss.deathMultiplier;
	chance *= 1 - member.deathReduction / 100;
	return Math.min(60, Math.max(1, chance));
}

export interface TfaStoredRaid {
	/** Bosses fought this raid, in order. */
	b: number[];
	/** Boss ID the team wiped at, or null if the raid was completed. */
	w: number | null;
	/** Per user (same order as the trip's users): boss IDs died at, and contribution points. */
	u: { d: number[]; p: number }[];
}

/** Whole-raid time multiplier from a Chincannon (percent off, like CoX: 60 means 60% faster). */
export function tfaChincannonFactor(chincannonPercent = 0) {
	return 1 - Math.min(100, Math.max(0, chincannonPercent)) / 100;
}

export function createTfaRaids({
	team,
	quantity,
	rng = MathRNG,
	chincannonPercent = 0
}: {
	team: TfaTeamMember[];
	quantity: number;
	rng?: RNGProvider;
	/** Set when someone in the team has a Chincannon equipped: the whole raid is this % faster, but all loot is destroyed. */
	chincannonPercent?: number;
}) {
	const size = team.length;
	if (size < 1 || size > 8) throw new Error('Team must be 1-8 players');
	const sizeFactor = TEAM_SIZE_TIME_FACTOR[size];
	const ccFactor = tfaChincannonFactor(chincannonPercent);
	const avgReduction = team.reduce((acc, m) => acc + tfaUserSpeedReduction(m), 0) / size;
	const speedFactor = (1 - avgReduction / 100) * sizeFactor;
	const expectedPerPlayer = TFA_TOTAL_POINTS / size;

	const raids: TfaStoredRaid[] = [];
	let realDuration = 0;
	let fakeDuration = 0;

	for (let q = 0; q < quantity; q++) {
		const bosses = pickTfaBosses(rng);
		const deaths: number[][] = team.map(() => []);
		const points: number[] = team.map(() => 0);
		let wipedAt: number | null = null;

		const roomTime = (id: number) =>
			tfaBossByID(id).baseTime * speedFactor * (1 - tfaTeamRoomPercent(team, id) / 100);
		const raidFullTime = LOBBY_TIME + bosses.reduce((acc, id) => acc + roomTime(id), 0);
		fakeDuration += raidFullTime * ccFactor;
		let raidTime = LOBBY_TIME;

		for (const bossID of bosses) {
			const boss = tfaBossByID(bossID);
			const bossTime = roomTime(boss.id);
			let diedHere = 0;
			const weights: number[] = [];
			for (let i = 0; i < size; i++) {
				const member = team[i];
				const died = rng.percentChance(tfaDeathChance(member, boss));
				if (died) {
					deaths[i].push(boss.id);
					diedHere++;
				}
				const kcFactor = 1 + Math.min(member.kc, KC_FOR_MAX_SPEED) / 400;
				let weight = (stylePercent(member.gear, boss.style) + 20) * kcFactor * rng.randFloat(0.8, 1.2);
				if (died) weight *= 0.5;
				weights.push(weight);
			}
			if (diedHere >= size) {
				wipedAt = boss.id;
				raidTime += rng.randInt(Math.floor(bossTime * 0.2), Math.floor(bossTime));
				break;
			}
			const totalWeight = weights.reduce((a, b) => a + b, 0);
			for (let i = 0; i < size; i++) {
				points[i] += (boss.points * weights[i]) / totalWeight;
			}
			raidTime += bossTime;
		}

		realDuration += Math.floor(raidTime * ccFactor);
		raids.push({
			b: bosses,
			w: wipedAt,
			u: team.map((_, i) => ({
				d: deaths[i],
				p: Math.max(0, Math.round(points[i] - deaths[i].length * expectedPerPlayer * 0.1))
			}))
		});
	}

	return { raids, realDuration: Math.floor(realDuration), fakeDuration: Math.floor(fakeDuration) };
}

/** Per-raid duration estimate for this team, used to work out max quantity. */
export function tfaSingleRaidDuration(team: TfaTeamMember[], chincannonPercent = 0) {
	const size = team.length;
	const avgReduction = team.reduce((acc, m) => acc + tfaUserSpeedReduction(m), 0) / size;
	const speedFactor = (1 - avgReduction / 100) * TEAM_SIZE_TIME_FACTOR[size];
	// Worst case boss picks
	return Math.floor(
		(LOBBY_TIME + (7 + 6 + 6 + 7 + 12) * Time.Minute * speedFactor) * tfaChincannonFactor(chincannonPercent)
	);
}

/**
 * BSC raid boosts from TFA items and unlocks. These are adapted from the OSRS effects.
 */
export function tfaItemBoosts(user: MUser): { boosts: TfaBoost[]; deathReduction: number; messages: string[] } {
	const boosts: TfaBoost[] = [];
	// Charged weapons only. Charges are checked in checkTfaUser and used when the trip starts.
	if (user.gear.melee.hasEquipped(TfaItem.OBLIGATOR_CHARGED)) boosts.push({ name: 'Obligator', percent: 4 });
	if (user.gear.mage.hasEquipped(TfaItem.ZORYAS_TOME_CHARGED)) boosts.push({ name: "Zorya's tome", percent: 3 });
	if (user.gear.range.hasEquipped(TfaItem.ASCENSION_CROSSBOWS))
		boosts.push({ name: 'Ascension crossbows', percent: 3 });
	// Owning either version of the folio counts (the charges only power a teleport in OSRS).
	if (user.allItemsOwned.has(TfaItem.ARCHIVISTS_FOLIO) || user.allItemsOwned.has(TfaItem.ARCHIVISTS_FOLIO_CHARGED)) {
		boosts.push({ name: "Archivist's folio", percent: 2 });
	}
	if (user.bitfield.includes(BitField.HasZeal) && user.skillsAsLevels.prayer >= 84) {
		boosts.push({ name: 'Zeal', percent: 2 });
	}
	const fragments = tfaFragmentsUsed(user);
	if (fragments > 0) boosts.push({ name: `${fragments}/4 elemental fragments`, percent: fragments * 0.5 });
	let deathReduction = 0;
	const messages: string[] = [];
	if (user.gear.melee.hasEquipped(TfaItem.RONDACHE)) {
		deathReduction = 20;
		messages.push('Rondache: 20% lower death chance');
	}
	return { boosts, deathReduction, messages };
}

/**
 * The raid's range score counts Ascension crossbows as a Bow of faerdhinen (c): a mid-tier bow, kept 2 points under a Twisted bow.
 * Uses whichever is higher, so equipping them never lowers the score. Only the TFA score; ToB and item stats are unchanged.
 */
const TFA_CROSSBOW_EQUIVALENT = 'Bow of faerdhinen (c)';
const TFA_CROSSBOW_BELOW_TBOW = 2;

export function tfaRangePercent(range: Gear): number {
	const actual = calcTOBRangePercent(range.stats);
	if (!range.hasEquipped(TfaItem.ASCENSION_CROSSBOWS)) return actual;
	const swapped = (weapon: string, ammo: string | null) => {
		const setup = range.clone().raw();
		setup['2h'] = { item: Items.getOrThrow(weapon).id, quantity: 1 };
		setup.weapon = null;
		setup.shield = null;
		if (setup.ammo && tfaAscensionBoltIDs.includes(setup.ammo.item)) setup.ammo = null;
		if (ammo) setup.ammo = { item: Items.getOrThrow(ammo).id, quantity: 1 };
		return calcTOBRangePercent(new Gear(setup).stats);
	};
	// The Bow of faerdhinen needs no ammo, so Ascension bolts don't add to it.
	const asBofa = swapped(TFA_CROSSBOW_EQUIVALENT, null);
	// ToB's stat math rates a Bofa (c) above a Twisted bow, so cap it just under the same setup with a Twisted bow.
	const asTbow = swapped('Twisted bow', 'Dragon arrow');
	return Math.max(actual, Math.min(asBofa, asTbow - TFA_CROSSBOW_BELOW_TBOW));
}

/**
 * Same middle-score idea for the charged Obligator (melee) and Zorya's tome (mage): in the raid score they count as a
 * strong weapon kept 2 points under the same setup with the best-in-slot pair (Drygore longsword + offhand, Virtus wand +
 * book). Uses whichever is higher, so equipping them never lowers the score. Only the TFA score; ToB and item stats unchanged.
 */
export const TFA_UNIQUE_WEAPON_BELOW_BIS = 2;

function swapMainHand(setup: Gear, weapon: string, shield: string) {
	const raw = setup.clone().raw();
	raw['2h'] = null;
	raw.weapon = { item: Items.getOrThrow(weapon).id, quantity: 1 };
	raw.shield = { item: Items.getOrThrow(shield).id, quantity: 1 };
	return new Gear(raw);
}

function tobStylePercent(style: 'melee' | 'mage', setup: Gear): number {
	const empty = new Gear();
	const gear = { melee: empty, range: empty, mage: empty, [style]: setup };
	return calculateTOBUserGearPercents({ gear } as unknown as MUser)[style];
}

export function tfaMeleePercent(melee: Gear, actual = tobStylePercent('melee', melee)): number {
	if (!melee.hasEquipped(TfaItem.OBLIGATOR_CHARGED)) return actual;
	const asBis = tobStylePercent('melee', swapMainHand(melee, 'Drygore longsword', 'Offhand drygore longsword'));
	return Math.max(actual, asBis - TFA_UNIQUE_WEAPON_BELOW_BIS);
}

export function tfaMagePercent(mage: Gear, actual = tobStylePercent('mage', mage)): number {
	if (!mage.hasEquipped(TfaItem.ZORYAS_TOME_CHARGED)) return actual;
	const asBis = tobStylePercent('mage', swapMainHand(mage, 'Virtus wand', 'Virtus book'));
	return Math.max(actual, asBis - TFA_UNIQUE_WEAPON_BELOW_BIS);
}

/** TFA gear score: ToB's score, with the TFA crossbow, Obligator and Zorya's tome rules above. */
export function calculateTfaGearPercents(user: MUser) {
	const base = calculateTOBUserGearPercents(user);
	const melee = tfaMeleePercent(user.gear.melee, base.melee);
	const range = tfaRangePercent(user.gear.range);
	const mage = tfaMagePercent(user.gear.mage, base.mage);
	return { melee, range, mage, total: (melee + range + mage) / 3 };
}

export function tfaTeamMemberFromUser(user: MUser, kc: number): TfaTeamMember {
	const { boosts, deathReduction } = tfaItemBoosts(user);
	return {
		id: user.id,
		kc,
		gear: calculateTfaGearPercents(user),
		boosts,
		deathReduction,
		roomBoosts: tfaRoomBoostsFor(user.gear, id => user.hasEquippedOrInBank(id))
	};
}

export function checkTfaUser(user: MUser, quantity = 1, kc = 0): string | null {
	if (!user.user.finished_quest_ids.includes(QuestID.WhileGuthixSleeps)) {
		return `${user.usernameOrMention} needs to complete While Guthix Sleeps.`;
	}
	if (!user.hasSkillReqs(minTfaStats)) {
		return `${user.usernameOrMention} needs these stats: ${formatSkillRequirements(minTfaStats)}.`;
	}
	const gear = calculateTfaGearPercents(user);
	for (const style of ['melee', 'range', 'mage'] as const) {
		if (gear[style] < TFA_MIN_GEAR_PERCENT) {
			return `${user.usernameOrMention}'s ${style} gear is too weak (${gear[style].toFixed(1)}%, needs ${TFA_MIN_GEAR_PERCENT}%).`;
		}
	}
	const supplies = tfaSuppliesForKc(kc).multiply(quantity);
	if (!user.bank.has(supplies)) {
		return `${user.usernameOrMention} needs ${supplies} for ${quantity}x raid${quantity === 1 ? '' : 's'}.`;
	}
	for (const charge of tfaChargesNeeded(user, quantity)) {
		const current = user.user[charge.settingsKey];
		if (current < charge.charges) {
			return `${user.usernameOrMention}'s ${charge.name} has ${current.toLocaleString()} charges but needs ${charge.charges.toLocaleString()} for ${quantity}x raid${quantity === 1 ? '' : 's'}. Charge it with /minion charge or unequip it.`;
		}
	}
	return null;
}

/** Charges used per raid by equipped charged TFA weapons (adapted, OSRS uses one per attack). */
export const TFA_CHARGES_PER_RAID = {
	obligator: 50,
	zoryasTome: 100
} as const;

export function tfaChargesNeeded(
	user: MUser,
	quantity: number
): { itemID: number; name: string; settingsKey: 'obligator_charges' | 'zorya_tome_charges'; charges: number }[] {
	const needed: {
		itemID: number;
		name: string;
		settingsKey: 'obligator_charges' | 'zorya_tome_charges';
		charges: number;
	}[] = [];
	if (user.gear.melee.hasEquipped(TfaItem.OBLIGATOR_CHARGED)) {
		needed.push({
			itemID: TfaItem.OBLIGATOR_CHARGED,
			name: 'Obligator',
			settingsKey: 'obligator_charges',
			charges: TFA_CHARGES_PER_RAID.obligator * quantity
		});
	}
	if (user.gear.mage.hasEquipped(TfaItem.ZORYAS_TOME_CHARGED)) {
		needed.push({
			itemID: TfaItem.ZORYAS_TOME_CHARGED,
			name: "Zorya's tome",
			settingsKey: 'zorya_tome_charges',
			charges: TFA_CHARGES_PER_RAID.zoryasTome * quantity
		});
	}
	return needed;
}

export function tfaHelpBoostsText() {
	return [
		`Obligator (charged) in melee setup: 4% faster, uses ${TFA_CHARGES_PER_RAID.obligator} charges per raid`,
		`Zorya's tome (charged) in mage setup: 3% faster, uses ${TFA_CHARGES_PER_RAID.zoryasTome} charges per raid`,
		'Ascension crossbows in range setup: 3% faster',
		"Owning an Archivist's folio (either version): 2% faster",
		'Zeal prayer unlocked (use Horn of Bran) and 84 Prayer: 2% faster',
		'Rondache in melee setup: 20% lower death chance'
	];
}

export function formatTfaDuration(ms: number) {
	return formatDuration(ms);
}
