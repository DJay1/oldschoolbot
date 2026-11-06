import { Bank, itemID } from 'oldschooljs';

import { FirstAgeItem } from '@/lib/customItems/firstAge.js';

/**
 * Chance, per Elder casket, to receive an Uncharged first age shard.
 * Rolled once per casket opened (not once per loot roll inside the casket).
 */
export const UNCHARGED_FIRST_AGE_SHARD_DROP_RATE = 300;

export interface FirstAgeMaxUpgrade {
	key: string;
	baseName: string;
	baseId: number;
	maxId: number;
	maxName: string;
}

/** The seven First Age (max) pieces. One charged shard upgrades one of these. */
export const firstAgeMaxUpgrades: readonly FirstAgeMaxUpgrade[] = [
	{
		key: 'tiara',
		baseName: 'First age tiara',
		baseId: 47_503,
		maxId: FirstAgeItem.TIARA_MAX,
		maxName: 'First age tiara (max)'
	},
	{
		key: 'amulet',
		baseName: 'First age amulet',
		baseId: 47_504,
		maxId: FirstAgeItem.AMULET_MAX,
		maxName: 'First age amulet (max)'
	},
	{
		key: 'cape',
		baseName: 'First age cape',
		baseId: 47_505,
		maxId: FirstAgeItem.CAPE_MAX,
		maxName: 'First age cape (max)'
	},
	{
		key: 'bracelet',
		baseName: 'First age bracelet',
		baseId: 47_506,
		maxId: FirstAgeItem.BRACELET_MAX,
		maxName: 'First age bracelet (max)'
	},
	{
		key: 'ring',
		baseName: 'First age ring',
		baseId: 47_507,
		maxId: FirstAgeItem.RING_MAX,
		maxName: 'First age ring (max)'
	},
	{
		key: 'robe_top',
		baseName: 'First age robe top',
		baseId: 73_126,
		maxId: FirstAgeItem.ROBE_TOP_MAX,
		maxName: 'First age robe top (max)'
	},
	{
		key: 'robe_bottom',
		baseName: 'First age robe bottom',
		baseId: 73_127,
		maxId: FirstAgeItem.ROBE_BOTTOM_MAX,
		maxName: 'First age robe bottom (max)'
	}
];

/** Coins spent, with one uncharged shard, to create one charged shard. */
export const FIRST_AGE_CHARGED_SHARD_GP_COST = 100_000_000_000;

/**
 * 1/15. Zippy uses this same roll to double clue-trip loot.
 * The First Age (max) set rolls it on its own, and only doubles the trip's reward caskets.
 */
export const CLUE_CASKET_DOUBLE_RATE = 15;

const firstAgeMaxPieceIds = firstAgeMaxUpgrades.map(piece => piece.maxId);

const originalFirstAgeKeys = new Set(['tiara', 'amulet', 'cape', 'bracelet', 'ring']);
const robeFirstAgeKeys = new Set(['robe_top', 'robe_bottom']);

type ExactEquipped = {
	hasEquipped(item: number | string | (string | number)[], every?: boolean, includeSimilar?: boolean): boolean;
};

/**
 * Gear, GearBank, and MUser all expose equipped items, but GearBank/MUser drop the
 * `includeSimilar` argument. Always ask each setup for the exact item id.
 */
function eachEquippedSetup(source: ExactEquipped | { gear: Record<string, ExactEquipped> }): ExactEquipped[] {
	if ('gear' in source && source.gear && typeof source.gear === 'object') {
		return Object.values(source.gear);
	}
	return [source as ExactEquipped];
}

function setupHasExactItem(setup: ExactEquipped, id: number): boolean {
	return setup.hasEquipped(id, false, false);
}

/**
 * True only when one gear setup has every First Age (max) piece.
 * Six pieces, or the base First Age pieces, do not count. Similar-items are ignored
 * so a base piece, or a different cape, cannot stand in for a missing (max) piece.
 */
export function isWearingFullFirstAgeMaxSet(source: ExactEquipped | { gear: Record<string, ExactEquipped> }): boolean {
	return eachEquippedSetup(source).some(setup => firstAgeMaxPieceIds.every(id => setupHasExactItem(setup, id)));
}

/**
 * XP percent for the pieces worn together on one gear setup.
 * Tiara, amulet, cape, bracelet and ring are 1% each, plus 1% when all five are worn.
 * Robe top and robe bottom are 1.5% each, plus 1% when both are worn. A full set is 10%.
 * A (max) piece counts as its base piece. Fire cape, Max cape, and the other pieces do not
 * fill an empty slot. Setups are scored separately: a cape left on a different setup does
 * not complete a set it was removed from. The highest setup is used.
 */
export function firstAgeXpBonusPercent(source: ExactEquipped | { gear: Record<string, ExactEquipped> }): number {
	let best = 0;
	for (const setup of eachEquippedSetup(source)) {
		let originalPieces = 0;
		let robePieces = 0;
		for (const piece of firstAgeMaxUpgrades) {
			if (!setupHasExactItem(setup, piece.baseId) && !setupHasExactItem(setup, piece.maxId)) continue;
			if (originalFirstAgeKeys.has(piece.key)) originalPieces++;
			else if (robeFirstAgeKeys.has(piece.key)) robePieces++;
		}
		let bonus = originalPieces + robePieces * 1.5;
		if (originalPieces === originalFirstAgeKeys.size) bonus += 1;
		if (robePieces === robeFirstAgeKeys.size) bonus += 1;
		if (bonus > best) best = bonus;
	}
	return best;
}

/**
 * Skilling pieces that must already be in the sacrificed bank before a shard can be charged.
 * Each slot is filled by sacrificing any one of its items. Edit this list to change the requirement.
 */
export const FIRST_AGE_REQUIRED_SACRIFICES = [
	{
		outfit: 'Lumberjack',
		slots: [
			['Lumberjack hat', 'Forestry hat'],
			['Lumberjack top', 'Forestry top'],
			['Lumberjack legs', 'Forestry legs'],
			['Lumberjack boots', 'Forestry boots']
		]
	},
	{
		outfit: 'Prospector',
		slots: [
			['Prospector helmet', 'Golden prospector helmet'],
			['Prospector jacket', 'Golden prospector jacket'],
			['Prospector legs', 'Golden prospector legs'],
			['Prospector boots', 'Golden prospector boots']
		]
	},
	{
		outfit: 'Angler',
		slots: [
			['Angler hat', 'Spirit angler headband'],
			['Angler top', 'Spirit angler top'],
			['Angler waders', 'Spirit angler waders'],
			['Angler boots', 'Spirit angler boots']
		]
	},
	{
		outfit: 'Pyromancer',
		slots: [['Pyromancer hood'], ['Pyromancer garb'], ['Pyromancer robe'], ['Pyromancer boots']]
	},
	{
		outfit: 'Farmer',
		slots: [
			["Farmer's strawhat"],
			["Farmer's jacket", "Farmer's shirt"],
			["Farmer's boro trousers"],
			["Farmer's boots"]
		]
	},
	{
		outfit: 'Master farmer',
		slots: [
			['Master farmer hat'],
			['Master farmer jacket'],
			['Master farmer pants'],
			['Master farmer gloves'],
			['Master farmer boots']
		]
	},
	{
		outfit: 'Blacksmith',
		slots: [
			['Blacksmith helmet'],
			['Blacksmith top'],
			['Blacksmith apron'],
			['Blacksmith gloves'],
			['Blacksmith boots']
		]
	},
	{
		outfit: 'Fletcher',
		slots: [
			["Fletcher's hat"],
			["Fletcher's top"],
			["Fletcher's legs"],
			["Fletcher's boots"],
			["Fletcher's gloves"]
		]
	},
	{
		outfit: 'Inventor',
		slots: [
			["Inventors' helmet"],
			["Inventors' torso"],
			["Inventors' legs"],
			["Inventors' gloves"],
			["Inventors' boots"],
			["Inventors' backpack"]
		]
	},
	{
		outfit: 'Diviner',
		slots: [
			["Diviner's headwear"],
			["Diviner's robe"],
			["Diviner's legwear"],
			["Diviner's handwear"],
			["Diviner's footwear"]
		]
	},
	{
		outfit: 'Rogue',
		slots: [['Rogue mask'], ['Rogue top'], ['Rogue trousers'], ['Rogue gloves'], ['Rogue boots']]
	},
	{
		outfit: 'Carpenter',
		slots: [["Carpenter's helmet"], ["Carpenter's shirt"], ["Carpenter's trousers"], ["Carpenter's boots"]]
	},
	{
		outfit: 'Raiments of the Eye',
		slots: [['Hat of the eye'], ['Robe top of the eye'], ['Robe bottoms of the eye'], ['Boots of the eye']]
	},
	{
		outfit: 'Zealot',
		slots: [["Zealot's helm"], ["Zealot's robe top"], ["Zealot's robe bottom"], ["Zealot's boots"]]
	}
] as const;

export interface ResolvedSacrificeSlot {
	outfit: string;
	label: string;
	ids: number[];
}

let cachedSlots: ResolvedSacrificeSlot[] | null = null;

export function getFirstAgeSacrificeSlots(): ResolvedSacrificeSlot[] {
	if (cachedSlots) return cachedSlots;
	cachedSlots = FIRST_AGE_REQUIRED_SACRIFICES.flatMap(group =>
		group.slots.map(items => ({
			outfit: group.outfit,
			label: items.join(' or '),
			ids: items.map(name => itemID(name))
		}))
	);
	return cachedSlots;
}

export function missingFirstAgeSacrifices(sacrificed: Bank): ResolvedSacrificeSlot[] {
	return getFirstAgeSacrificeSlots().filter(slot => !slot.ids.some(id => sacrificed.amount(id) > 0));
}

export function firstAgeSacrificeProgress(sacrificed: Bank): { done: number; total: number } {
	const slots = getFirstAgeSacrificeSlots();
	const missing = missingFirstAgeSacrifices(sacrificed).length;
	return { done: slots.length - missing, total: slots.length };
}

export function formatMissingSacrifices(missing: readonly ResolvedSacrificeSlot[]): string {
	const byOutfit = new Map<string, string[]>();
	for (const slot of missing) {
		const list = byOutfit.get(slot.outfit) ?? [];
		list.push(slot.label);
		byOutfit.set(slot.outfit, list);
	}
	return [...byOutfit.entries()].map(([outfit, labels]) => `${outfit}: ${labels.join(', ')}`).join('\n');
}

export type ChargePlan = { ok: true } | { ok: false; message: string };

/**
 * One uncharged shard and 100b coins become one charged shard, after every required
 * skilling outfit piece has been sacrificed. One charged shard upgrades one piece.
 */
export function planChargedShardCreate(input: { sacrificed: Bank; unchargedOwned: number; gp: number }): ChargePlan {
	const missing = missingFirstAgeSacrifices(input.sacrificed);
	if (missing.length > 0) {
		const progress = firstAgeSacrificeProgress(input.sacrificed);
		return {
			ok: false,
			message: `You have sacrificed ${progress.done}/${progress.total} required skilling pieces. Still missing:\n${formatMissingSacrifices(missing)}`
		};
	}
	if (input.unchargedOwned < 1) {
		return {
			ok: false,
			message: `Your sacrifices are complete, but you need an Uncharged first age shard (1/${UNCHARGED_FIRST_AGE_SHARD_DROP_RATE} from an Elder casket).`
		};
	}
	if (input.gp < FIRST_AGE_CHARGED_SHARD_GP_COST) {
		return {
			ok: false,
			message: `You need ${FIRST_AGE_CHARGED_SHARD_GP_COST.toLocaleString()} coins to create a Charged first age shard.`
		};
	}
	return { ok: true };
}

/** Trip-message line for an outfit XP bonus. The percent is applied once, not stacked. */
export function namedOutfitXpLine(input: {
	outfit: string;
	percent: number | null;
	xp: number;
	fromMaxSet: boolean;
}): string {
	const via = input.fromMaxSet
		? `your First Age (max) set, same as the ${input.outfit} outfit`
		: `your ${input.outfit} outfit`;
	if (input.percent == null) {
		return `**${input.outfit} bonus:** ${input.xp.toLocaleString()} XP from ${via}.`;
	}
	const pct = Number.isInteger(input.percent) ? String(input.percent) : input.percent.toFixed(1);
	return `**${input.outfit} bonus:** ${pct}% (${input.xp.toLocaleString()} XP) from ${via}.`;
}

export function firstAgeMaxCreateCost(upgrade: FirstAgeMaxUpgrade): Bank {
	return new Bank().add(upgrade.baseId).add(FirstAgeItem.CHARGED_SHARD);
}

export type UpgradePlan = { error: string } | { upgrade: FirstAgeMaxUpgrade; remove: Bank; add: Bank };

export function planMaxUpgrade(bank: Bank, pieceKey: string): UpgradePlan {
	const upgrade = firstAgeMaxUpgrades.find(piece => piece.key === pieceKey);
	if (!upgrade) return { error: 'That is not a First Age piece.' };
	if (bank.amount(FirstAgeItem.CHARGED_SHARD) < 1) {
		return {
			error: 'You need a Charged first age shard. Create one with /create item:Charged first age shard (1 uncharged shard and 100b coins, after every required sacrifice).'
		};
	}
	if (bank.amount(upgrade.baseId) < 1) {
		return {
			error: `You need an unequipped ${upgrade.baseName} in your bank. One charged shard and that piece become ${upgrade.maxName}.`
		};
	}
	return {
		upgrade,
		remove: firstAgeMaxCreateCost(upgrade),
		add: new Bank().add(upgrade.maxId)
	};
}

/** Rolls the Elder-casket shard drop once per casket and adds any hits to `loot`. */
export function addUnchargedFirstAgeShards(
	loot: Bank,
	casketCount: number,
	rngRoll: (rate: number) => boolean
): number {
	let dropped = 0;
	for (let i = 0; i < casketCount; i++) {
		if (rngRoll(UNCHARGED_FIRST_AGE_SHARD_DROP_RATE)) {
			loot.add(FirstAgeItem.UNCHARGED_SHARD);
			dropped++;
		}
	}
	return dropped;
}

export function firstAgeStatus(input: {
	sacrificed: Bank;
	uncharged: number;
	charged: number;
	ownedMaxNames: string[];
}): string {
	const progress = firstAgeSacrificeProgress(input.sacrificed);
	const missing = missingFirstAgeSacrifices(input.sacrificed);
	const lines = [
		`**First Age** sacrifices: ${progress.done}/${progress.total}.`,
		`Uncharged first age shards: ${input.uncharged.toLocaleString()}. Charged first age shards: ${input.charged.toLocaleString()}.`,
		`/create item:Charged first age shard spends 1 uncharged shard and ${FIRST_AGE_CHARGED_SHARD_GP_COST.toLocaleString()} coins, after every required sacrifice. One charged shard upgrades one piece.`,
		'/create spends 1 Charged first age shard and the matching base piece to make the tradeable (max) piece.',
		input.ownedMaxNames.length > 0
			? `Max pieces you have: ${input.ownedMaxNames.join(', ')}.`
			: 'You do not currently hold a (max) piece.'
	];
	if (missing.length > 0) {
		lines.push('', `Still missing:`, formatMissingSacrifices(missing));
	}
	return lines.join('\n');
}
