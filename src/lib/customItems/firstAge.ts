import type { DeepPartial } from '@sapphire/utilities';
import type { Item } from 'oldschooljs';

import { setCustomItem, UN_EQUIPPABLE } from '@/lib/customItems/util.js';

/**
 * Tradeability of the seven shiny First Age (max) pieces.
 * They can be traded and listed on the GE.
 * Flip to false to make them super-untradeable again.
 * The charged shard stays non-transferable either way.
 */
export const FIRST_AGE_MAX_PIECES_TRADEABLE = true;

/** Bank-value / sell guide for the tradeable uncharged shard. Easy to change. */
export const UNCHARGED_FIRST_AGE_SHARD_PRICE = 25_000_000;

export const FirstAgeItem = {
	UNCHARGED_SHARD: 74_100,
	CHARGED_SHARD: 74_123,
	TIARA_MAX: 74_116,
	AMULET_MAX: 74_117,
	CAPE_MAX: 74_118,
	BRACELET_MAX: 74_119,
	RING_MAX: 74_120,
	ROBE_TOP_MAX: 74_121,
	ROBE_BOTTOM_MAX: 74_122
} as const;

const chargedShardData = {
	tradeable: false,
	tradeable_on_ge: false,
	...UN_EQUIPPABLE,
	customItemData: {
		isSuperUntradeable: true,
		cantBeSacrificed: true,
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

setCustomItem(
	FirstAgeItem.UNCHARGED_SHARD,
	'Uncharged first age shard',
	'Coal',
	{
		tradeable: true,
		tradeable_on_ge: true,
		...UN_EQUIPPABLE,
		customItemData: {
			cantDropFromMysteryBoxes: true
		}
	},
	UNCHARGED_FIRST_AGE_SHARD_PRICE
);

setCustomItem(FirstAgeItem.CHARGED_SHARD, 'Charged first age shard', 'Coal', chargedShardData, 100_000_000);

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
