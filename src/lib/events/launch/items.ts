import { setCustomItem, UN_EQUIPPABLE } from '@/lib/customItems/util.js';

/**
 * Launch reward items. Registered even after the Launch event ends so owned
 * boxes, hats, and tokens keep their names and icons.
 */
export const LaunchItem = {
	LAUNCH_BOX: 74_200,
	CORGO_PARTY_HAT: 74_201,
	/**
	 * Tradeable token. A personal double XP boost is not wired up: there is no
	 * existing place to store an expiry without a schema change.
	 * TODO: use this for a personal XP boost once that can be stored.
	 */
	DOUBLE_XP_TOKEN: 74_202
} as const;

export const CORGO_PARTY_HAT_EXAMINE =
	"A special party hat awarded to players on the day of Bark School Corgo's launch.";

setCustomItem(
	LaunchItem.LAUNCH_BOX,
	'Launch box',
	'Mystery box',
	{
		tradeable: true,
		tradeable_on_ge: true,
		...UN_EQUIPPABLE,
		customItemData: {
			cantDropFromMysteryBoxes: true
		}
	},
	5_000_000
);

setCustomItem(
	LaunchItem.CORGO_PARTY_HAT,
	'Corgo party hat',
	'Blue partyhat',
	{
		tradeable: true,
		tradeable_on_ge: true,
		customItemData: {
			cantDropFromMysteryBoxes: true,
			examine: CORGO_PARTY_HAT_EXAMINE
		}
	},
	25_000_000
);

setCustomItem(
	LaunchItem.DOUBLE_XP_TOKEN,
	'Double XP token',
	'Coal',
	{
		tradeable: true,
		tradeable_on_ge: true,
		...UN_EQUIPPABLE,
		customItemData: {
			cantDropFromMysteryBoxes: true
		}
	},
	100_000_000
);
