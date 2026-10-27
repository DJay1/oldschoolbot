import type { DeepPartial } from '@sapphire/utilities';
import type { Item } from 'oldschooljs';

import { setCustomItem, UN_EQUIPPABLE } from '@/lib/customItems/util.js';

/**
 * Tradeability of the seven shiny First Age (max) pieces.
 * DJ set this to true: they can be traded and listed on the GE.
 * Flip to false to make them super-untradeable again.
 * Shards, affinity tokens, and the max seal stay untradeable either way.
 */
export const FIRST_AGE_MAX_PIECES_TRADEABLE = true;

export const FirstAgeItem = {
	AFFINITY_SHARD: 74_100,
	LUMBERJACK_TOKEN: 74_101,
	PROSPECTOR_TOKEN: 74_102,
	ANGLER_TOKEN: 74_103,
	PYROMANCER_TOKEN: 74_104,
	FARMER_TOKEN: 74_105,
	MASTER_FARMER_TOKEN: 74_106,
	BLACKSMITH_TOKEN: 74_107,
	FLETCHER_TOKEN: 74_108,
	INVENTOR_TOKEN: 74_109,
	DIVINER_TOKEN: 74_110,
	ROGUE_TOKEN: 74_111,
	CARPENTER_TOKEN: 74_112,
	RAIMENTS_TOKEN: 74_113,
	ZEALOT_TOKEN: 74_114,
	MAX_SEAL: 74_115,
	TIARA_MAX: 74_116,
	AMULET_MAX: 74_117,
	CAPE_MAX: 74_118,
	BRACELET_MAX: 74_119,
	RING_MAX: 74_120,
	ROBE_TOP_MAX: 74_121,
	ROBE_BOTTOM_MAX: 74_122
} as const;

const untradeable = {
	tradeable: false,
	tradeable_on_ge: false,
	...UN_EQUIPPABLE,
	customItemData: {
		isSuperUntradeable: true,
		cantDropFromMysteryBoxes: true
	}
} satisfies DeepPartial<Item>;

function maxPieceData(): DeepPartial<Item> {
	if (!FIRST_AGE_MAX_PIECES_TRADEABLE) {
		return {
			tradeable: false,
			tradeable_on_ge: false,
			customItemData: {
				isSuperUntradeable: true,
				cantDropFromMysteryBoxes: true
			}
		};
	}
	return {
		tradeable: true,
		tradeable_on_ge: true,
		customItemData: {
			cantDropFromMysteryBoxes: true
		}
	};
}

function registerHeldItem(id: number, name: string) {
	setCustomItem(id, name, 'Coal', untradeable, 1);
}

registerHeldItem(FirstAgeItem.AFFINITY_SHARD, 'First age affinity shard');
registerHeldItem(FirstAgeItem.LUMBERJACK_TOKEN, 'Lumberjack affinity token');
registerHeldItem(FirstAgeItem.PROSPECTOR_TOKEN, 'Prospector affinity token');
registerHeldItem(FirstAgeItem.ANGLER_TOKEN, 'Angler affinity token');
registerHeldItem(FirstAgeItem.PYROMANCER_TOKEN, 'Pyromancer affinity token');
registerHeldItem(FirstAgeItem.FARMER_TOKEN, 'Farmer affinity token');
registerHeldItem(FirstAgeItem.MASTER_FARMER_TOKEN, 'Master farmer affinity token');
registerHeldItem(FirstAgeItem.BLACKSMITH_TOKEN, 'Blacksmith affinity token');
registerHeldItem(FirstAgeItem.FLETCHER_TOKEN, 'Fletcher affinity token');
registerHeldItem(FirstAgeItem.INVENTOR_TOKEN, 'Inventor affinity token');
registerHeldItem(FirstAgeItem.DIVINER_TOKEN, 'Diviner affinity token');
registerHeldItem(FirstAgeItem.ROGUE_TOKEN, 'Rogue affinity token');
registerHeldItem(FirstAgeItem.CARPENTER_TOKEN, 'Carpenter affinity token');
registerHeldItem(FirstAgeItem.RAIMENTS_TOKEN, 'Raiments affinity token');
registerHeldItem(FirstAgeItem.ZEALOT_TOKEN, 'Zealot affinity token');
registerHeldItem(FirstAgeItem.MAX_SEAL, 'First age max seal');

setCustomItem(FirstAgeItem.TIARA_MAX, 'First age tiara (max)', 'Rune full helm', maxPieceData(), 100_000_000);
setCustomItem(FirstAgeItem.AMULET_MAX, 'First age amulet (max)', 'Amulet of strength', maxPieceData(), 100_000_000);
setCustomItem(FirstAgeItem.CAPE_MAX, 'First age cape (max)', 'Fire cape', maxPieceData(), 100_000_000);
setCustomItem(FirstAgeItem.BRACELET_MAX, 'First age bracelet (max)', 'Barrows gloves', maxPieceData(), 100_000_000);
setCustomItem(FirstAgeItem.RING_MAX, 'First age ring (max)', 'Berserker ring', maxPieceData(), 100_000_000);
setCustomItem(
	FirstAgeItem.ROBE_TOP_MAX,
	'First age robe top (max)',
	'Proselyte hauberk',
	maxPieceData(),
	1_000_000_000
);
setCustomItem(
	FirstAgeItem.ROBE_BOTTOM_MAX,
	'First age robe bottom (max)',
	'Proselyte cuisse',
	maxPieceData(),
	1_000_000_000
);
