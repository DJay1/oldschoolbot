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
	DOUBLE_XP_TOKEN: 74_202,
	/** Launch graceful: 1 set per 50 Launch boxes opened, never from the box itself. Discontinued. */
	LAUNCH_GRACEFUL_HOOD: 74_203,
	LAUNCH_GRACEFUL_TOP: 74_204,
	LAUNCH_GRACEFUL_LEGS: 74_205,
	LAUNCH_GRACEFUL_GLOVES: 74_206,
	LAUNCH_GRACEFUL_BOOTS: 74_207,
	LAUNCH_GRACEFUL_CAPE: 74_208
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

/** [id, name, base Graceful piece]. Same stats and set effect as Graceful / Spooky graceful. Tradeable. */
export const LAUNCH_GRACEFUL_PIECES = [
	[LaunchItem.LAUNCH_GRACEFUL_HOOD, 'Launch graceful hood', 'Graceful hood'],
	[LaunchItem.LAUNCH_GRACEFUL_TOP, 'Launch graceful top', 'Graceful top'],
	[LaunchItem.LAUNCH_GRACEFUL_LEGS, 'Launch graceful legs', 'Graceful legs'],
	[LaunchItem.LAUNCH_GRACEFUL_GLOVES, 'Launch graceful gloves', 'Graceful gloves'],
	[LaunchItem.LAUNCH_GRACEFUL_BOOTS, 'Launch graceful boots', 'Graceful boots'],
	[LaunchItem.LAUNCH_GRACEFUL_CAPE, 'Launch graceful cape', 'Graceful cape']
] as const;

for (const [id, name, base] of LAUNCH_GRACEFUL_PIECES) {
	setCustomItem(
		id,
		name,
		base,
		{
			tradeable: true,
			tradeable_on_ge: true,
			customItemData: {
				cantDropFromMysteryBoxes: true,
				examine: 'Awarded for opening Launch boxes during the Bark School Corgo launch.'
			}
		},
		100_000
	);
}
