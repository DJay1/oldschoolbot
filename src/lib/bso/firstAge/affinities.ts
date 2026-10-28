import { Bank, itemID } from 'oldschooljs';

import { FirstAgeItem } from '@/lib/customItems/firstAge.js';

/** Shards spent to create one First age max seal. One seal upgrades one piece. */
export const FIRST_AGE_MAX_SEAL_SHARD_COST = 30;

export const FIRST_AGE_PIECE_NAMES = [
	'First age tiara',
	'First age amulet',
	'First age cape',
	'First age bracelet',
	'First age ring',
	'First age robe top',
	'First age robe bottom'
] as const;

export type FirstAgeAffinityId =
	| 'lumberjack'
	| 'prospector'
	| 'angler'
	| 'pyromancer'
	| 'farmer'
	| 'master_farmer'
	| 'blacksmith'
	| 'fletcher'
	| 'inventor'
	| 'diviner'
	| 'rogue'
	| 'carpenter'
	| 'raiments'
	| 'zealot';

export interface AffinitySlot {
	label: string;
	/** Any one of these item names fills the slot. */
	items: readonly string[];
}

export interface FirstAgeAffinity {
	id: FirstAgeAffinityId;
	name: string;
	skill: string;
	/** Bonus granted while First Age is worn. Replaces the outfit; it does not stack with it. */
	bonus: string;
	slots: readonly AffinitySlot[];
	/** Shards granted for absorbing one full outfit from the bank. */
	shardValue: number;
	/** Shards spent to unlock this affinity on the user. */
	unlockCost: number;
	/** Stored on the user. Not added to the bank. */
	tokenId: number;
}

export interface FirstAgeMaxUpgrade {
	key: string;
	baseName: string;
	baseId: number;
	maxId: number;
	maxName: string;
}

/**
 * Outfit → shard payout → bonus → token id.
 * Add a row here to register another affinity. Also hook `isAffinityActive` at that outfit's bonus.
 */
export const firstAgeAffinities: readonly FirstAgeAffinity[] = [
	{
		id: 'lumberjack',
		name: 'Lumberjack',
		skill: 'Woodcutting',
		bonus: '2.5% Woodcutting XP',
		shardValue: 40,
		unlockCost: 25,
		tokenId: FirstAgeItem.LUMBERJACK_TOKEN,
		slots: [
			{ label: 'Lumberjack hat', items: ['Lumberjack hat', 'Forestry hat'] },
			{ label: 'Lumberjack top', items: ['Lumberjack top', 'Forestry top'] },
			{ label: 'Lumberjack legs', items: ['Lumberjack legs', 'Forestry legs'] },
			{ label: 'Lumberjack boots', items: ['Lumberjack boots', 'Forestry boots'] }
		]
	},
	{
		id: 'prospector',
		name: 'Prospector',
		skill: 'Mining',
		bonus: '2.5% Mining XP',
		shardValue: 40,
		unlockCost: 25,
		tokenId: FirstAgeItem.PROSPECTOR_TOKEN,
		slots: [
			{ label: 'Prospector helmet', items: ['Prospector helmet', 'Golden prospector helmet'] },
			{ label: 'Prospector jacket', items: ['Prospector jacket', 'Golden prospector jacket'] },
			{ label: 'Prospector legs', items: ['Prospector legs', 'Golden prospector legs'] },
			{ label: 'Prospector boots', items: ['Prospector boots', 'Golden prospector boots'] }
		]
	},
	{
		id: 'angler',
		name: 'Angler',
		skill: 'Fishing',
		bonus: '2.5% Fishing XP',
		shardValue: 40,
		unlockCost: 25,
		tokenId: FirstAgeItem.ANGLER_TOKEN,
		slots: [
			{ label: 'Angler hat', items: ['Angler hat', 'Spirit angler headband'] },
			{ label: 'Angler top', items: ['Angler top', 'Spirit angler top'] },
			{ label: 'Angler waders', items: ['Angler waders', 'Spirit angler waders'] },
			{ label: 'Angler boots', items: ['Angler boots', 'Spirit angler boots'] }
		]
	},
	{
		id: 'pyromancer',
		name: 'Pyromancer',
		skill: 'Firemaking',
		bonus: '2.5% Firemaking XP',
		shardValue: 40,
		unlockCost: 25,
		tokenId: FirstAgeItem.PYROMANCER_TOKEN,
		slots: [
			{ label: 'Pyromancer hood', items: ['Pyromancer hood'] },
			{ label: 'Pyromancer garb', items: ['Pyromancer garb'] },
			{ label: 'Pyromancer robe', items: ['Pyromancer robe'] },
			{ label: 'Pyromancer boots', items: ['Pyromancer boots'] }
		]
	},
	{
		id: 'farmer',
		name: 'Farmer',
		skill: 'Farming',
		bonus: '2.5% Farming XP',
		shardValue: 40,
		unlockCost: 25,
		tokenId: FirstAgeItem.FARMER_TOKEN,
		slots: [
			{ label: "Farmer's strawhat", items: ["Farmer's strawhat"] },
			{ label: "Farmer's jacket or shirt", items: ["Farmer's jacket", "Farmer's shirt"] },
			{ label: "Farmer's boro trousers", items: ["Farmer's boro trousers"] },
			{ label: "Farmer's boots", items: ["Farmer's boots"] }
		]
	},
	{
		id: 'master_farmer',
		name: 'Master farmer',
		skill: 'Farming',
		bonus: '+3 farming patches',
		shardValue: 50,
		unlockCost: 30,
		tokenId: FirstAgeItem.MASTER_FARMER_TOKEN,
		slots: [
			{ label: 'Master farmer hat', items: ['Master farmer hat'] },
			{ label: 'Master farmer jacket', items: ['Master farmer jacket'] },
			{ label: 'Master farmer pants', items: ['Master farmer pants'] },
			{ label: 'Master farmer gloves', items: ['Master farmer gloves'] },
			{ label: 'Master farmer boots', items: ['Master farmer boots'] }
		]
	},
	{
		id: 'blacksmith',
		name: 'Blacksmith',
		skill: 'Smithing',
		bonus: '10% Smithing XP',
		shardValue: 50,
		unlockCost: 30,
		tokenId: FirstAgeItem.BLACKSMITH_TOKEN,
		slots: [
			{ label: 'Blacksmith helmet', items: ['Blacksmith helmet'] },
			{ label: 'Blacksmith top', items: ['Blacksmith top'] },
			{ label: 'Blacksmith apron', items: ['Blacksmith apron'] },
			{ label: 'Blacksmith gloves', items: ['Blacksmith gloves'] },
			{ label: 'Blacksmith boots', items: ['Blacksmith boots'] }
		]
	},
	{
		id: 'fletcher',
		name: 'Fletcher',
		skill: 'Fletching',
		bonus: '3% Fletching XP',
		shardValue: 50,
		unlockCost: 30,
		tokenId: FirstAgeItem.FLETCHER_TOKEN,
		slots: [
			{ label: "Fletcher's hat", items: ["Fletcher's hat"] },
			{ label: "Fletcher's top", items: ["Fletcher's top"] },
			{ label: "Fletcher's legs", items: ["Fletcher's legs"] },
			{ label: "Fletcher's boots", items: ["Fletcher's boots"] },
			{ label: "Fletcher's gloves", items: ["Fletcher's gloves"] }
		]
	},
	{
		id: 'inventor',
		name: 'Inventor',
		skill: 'Invention',
		bonus: '4% Invention XP',
		shardValue: 60,
		unlockCost: 35,
		tokenId: FirstAgeItem.INVENTOR_TOKEN,
		slots: [
			{ label: "Inventors' helmet", items: ["Inventors' helmet"] },
			{ label: "Inventors' torso", items: ["Inventors' torso"] },
			{ label: "Inventors' legs", items: ["Inventors' legs"] },
			{ label: "Inventors' gloves", items: ["Inventors' gloves"] },
			{ label: "Inventors' boots", items: ["Inventors' boots"] },
			{ label: "Inventors' backpack", items: ["Inventors' backpack"] }
		]
	},
	{
		id: 'diviner',
		name: 'Diviner',
		skill: 'Divination',
		bonus: '4% Divination XP',
		shardValue: 50,
		unlockCost: 30,
		tokenId: FirstAgeItem.DIVINER_TOKEN,
		slots: [
			{ label: "Diviner's headwear", items: ["Diviner's headwear"] },
			{ label: "Diviner's robe", items: ["Diviner's robe"] },
			{ label: "Diviner's legwear", items: ["Diviner's legwear"] },
			{ label: "Diviner's handwear", items: ["Diviner's handwear"] },
			{ label: "Diviner's footwear", items: ["Diviner's footwear"] }
		]
	},
	{
		id: 'rogue',
		name: 'Rogue',
		skill: 'Thieving',
		bonus: '100% chance of double Thieving loot',
		shardValue: 50,
		unlockCost: 30,
		tokenId: FirstAgeItem.ROGUE_TOKEN,
		slots: [
			{ label: 'Rogue mask', items: ['Rogue mask'] },
			{ label: 'Rogue top', items: ['Rogue top'] },
			{ label: 'Rogue trousers', items: ['Rogue trousers'] },
			{ label: 'Rogue gloves', items: ['Rogue gloves'] },
			{ label: 'Rogue boots', items: ['Rogue boots'] }
		]
	},
	{
		id: 'carpenter',
		name: 'Carpenter',
		skill: 'Construction',
		bonus: '2.5% Construction XP',
		shardValue: 40,
		unlockCost: 25,
		tokenId: FirstAgeItem.CARPENTER_TOKEN,
		slots: [
			{ label: "Carpenter's helmet", items: ["Carpenter's helmet"] },
			{ label: "Carpenter's shirt", items: ["Carpenter's shirt"] },
			{ label: "Carpenter's trousers", items: ["Carpenter's trousers"] },
			{ label: "Carpenter's boots", items: ["Carpenter's boots"] }
		]
	},
	{
		id: 'raiments',
		name: 'Raiments of the Eye',
		skill: 'Runecraft',
		bonus: '60% extra runes',
		shardValue: 40,
		unlockCost: 25,
		tokenId: FirstAgeItem.RAIMENTS_TOKEN,
		slots: [
			{ label: 'Hat of the eye', items: ['Hat of the eye'] },
			{ label: 'Robe top of the eye', items: ['Robe top of the eye'] },
			{ label: 'Robe bottoms of the eye', items: ['Robe bottoms of the eye'] },
			{ label: 'Boots of the eye', items: ['Boots of the eye'] }
		]
	},
	{
		id: 'zealot',
		name: 'Zealot',
		skill: 'Prayer',
		bonus: "Full Zealot's robes bone-save chance",
		shardValue: 40,
		unlockCost: 25,
		tokenId: FirstAgeItem.ZEALOT_TOKEN,
		slots: [
			{ label: "Zealot's helm", items: ["Zealot's helm"] },
			{ label: "Zealot's robe top", items: ["Zealot's robe top"] },
			{ label: "Zealot's robe bottom", items: ["Zealot's robe bottom"] },
			{ label: "Zealot's boots", items: ["Zealot's boots"] }
		]
	}
];

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

const affinityById = new Map(firstAgeAffinities.map(affinity => [affinity.id, affinity]));

export function getAffinity(id: string): FirstAgeAffinity | undefined {
	return affinityById.get(id as FirstAgeAffinityId);
}

export interface AffinityGearView {
	firstAgeAffinities: readonly number[];
	hasEquipped(item: number | string | (string | number)[], every?: boolean): boolean;
}

export function isWearingFirstAge(gear: Pick<AffinityGearView, 'hasEquipped'>): boolean {
	return FIRST_AGE_PIECE_NAMES.some(name => gear.hasEquipped(name));
}

/** True when this affinity is unlocked and any First Age piece (including a max piece) is worn. */
export function isAffinityActive(gear: AffinityGearView, id: FirstAgeAffinityId): boolean {
	const affinity = getAffinity(id);
	if (!affinity) return false;
	const unlocked = gear.firstAgeAffinities ?? [];
	if (!unlocked.includes(affinity.tokenId)) return false;
	return isWearingFirstAge(gear);
}

export function missingAffinities(unlocked: readonly number[]): FirstAgeAffinity[] {
	return firstAgeAffinities.filter(affinity => !unlocked.includes(affinity.tokenId));
}

export type AffinityPlan<T> = { error: string } | T;

export function selectAbsorbPieces(bank: Bank, affinity: FirstAgeAffinity): AffinityPlan<{ remove: Bank }> {
	const remove = new Bank();
	for (const slot of affinity.slots) {
		const found = slot.items.map(name => itemID(name)).find(id => bank.amount(id) - remove.amount(id) > 0);
		if (!found) {
			return {
				error: `You need ${slot.label} in your bank (unequipped) to absorb a full ${affinity.name} outfit.`
			};
		}
		remove.add(found);
	}
	return { remove };
}

export function planAbsorb(bank: Bank, affinityId: string): AffinityPlan<{ remove: Bank; affinity: FirstAgeAffinity }> {
	const affinity = getAffinity(affinityId);
	if (!affinity) return { error: 'That is not a First Age affinity.' };
	const selected = selectAbsorbPieces(bank, affinity);
	if ('error' in selected) return selected;
	return { remove: selected.remove, affinity };
}

export function planUnlock(
	bank: Bank,
	unlocked: readonly number[],
	affinityId: string
): AffinityPlan<{ affinity: FirstAgeAffinity }> {
	const affinity = getAffinity(affinityId);
	if (!affinity) return { error: 'That is not a First Age affinity.' };
	if (unlocked.includes(affinity.tokenId)) return { error: `You already unlocked the ${affinity.name} affinity.` };
	if (bank.amount(FirstAgeItem.AFFINITY_SHARD) < affinity.unlockCost) {
		return {
			error: `Unlocking ${affinity.name} costs ${affinity.unlockCost} First age affinity shards. You have ${bank.amount(FirstAgeItem.AFFINITY_SHARD)}.`
		};
	}
	return { affinity };
}

export function planSeal(
	bank: Bank,
	unlocked: readonly number[],
	quantity: number
): AffinityPlan<{ quantity: number; cost: number }> {
	if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
		return { error: 'Choose between 1 and 100 First age max seals.' };
	}
	const missing = missingAffinities(unlocked);
	if (missing.length > 0) {
		return {
			error: `The First age max seal is the end of the affinity path. Still locked: ${missing.map(affinity => affinity.name).join(', ')}.`
		};
	}
	const cost = quantity * FIRST_AGE_MAX_SEAL_SHARD_COST;
	if (bank.amount(FirstAgeItem.AFFINITY_SHARD) < cost) {
		return {
			error: `${quantity}x First age max seal costs ${cost} shards (${FIRST_AGE_MAX_SEAL_SHARD_COST} each). You have ${bank.amount(FirstAgeItem.AFFINITY_SHARD)}.`
		};
	}
	return { quantity, cost };
}

export function planUpgrade(bank: Bank, pieceKey: string): AffinityPlan<{ upgrade: FirstAgeMaxUpgrade }> {
	const upgrade = firstAgeMaxUpgrades.find(piece => piece.key === pieceKey);
	if (!upgrade) return { error: 'That is not a First Age piece.' };
	if (bank.amount(FirstAgeItem.MAX_SEAL) < 1) {
		return {
			error: 'You need a First age max seal. Create one with `/firstage seal` after every affinity is unlocked.'
		};
	}
	if (bank.amount(upgrade.baseId) < 1) {
		return {
			error: `You need an unequipped ${upgrade.baseName} in your bank. One seal and that piece become a tradeable ${upgrade.maxName}.`
		};
	}
	return { upgrade };
}

export function affinityStatus(input: {
	unlocked: readonly number[];
	shards: number;
	seals: number;
	wearingFirstAge: boolean;
	ownedMaxNames: string[];
}): string {
	const unlockedCount = firstAgeAffinities.length - missingAffinities(input.unlocked).length;
	const lines = [
		`**First Age affinities** ${unlockedCount}/${firstAgeAffinities.length}. Wearing First Age: ${input.wearingFirstAge ? 'yes' : 'no'}.`,
		`Shards: ${input.shards.toLocaleString()}. Max seals: ${input.seals.toLocaleString()}.`,
		'Absorb a full outfit for shards, then spend shards to unlock that affinity. Affinities apply only while a First Age piece is worn, and they replace the outfit bonus (they do not stack with it).',
		''
	];
	for (const affinity of firstAgeAffinities) {
		const state = input.unlocked.includes(affinity.tokenId) ? 'unlocked' : 'locked';
		lines.push(
			`${affinity.name} (${state}) — absorb ${affinity.shardValue} shards, unlock ${affinity.unlockCost}. ${affinity.bonus}.`
		);
	}
	lines.push(
		'',
		`Max seal: unlock every affinity, then spend ${FIRST_AGE_MAX_SEAL_SHARD_COST} shards per seal. Each seal consumes one base First Age piece and creates the tradeable (max) version.`,
		input.ownedMaxNames.length > 0
			? `Max pieces you have: ${input.ownedMaxNames.join(', ')}.`
			: 'You do not currently hold a (max) piece.'
	);
	return lines.join('\n');
}
