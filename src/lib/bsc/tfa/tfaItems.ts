import { EquipmentSlot } from '@oldschoolgg/gear';
import type { ItemEquipment, ItemRequirements } from 'oldschooljs';

import { setCustomItem, UN_EQUIPPABLE } from '@/lib/customItems/util.js';

/**
 * The Fractured Archive (OSRS raid 4, released 20 Oct 2026).
 * These use BSC's own item IDs (74600-74616), not the real OSRS IDs (34xxx),
 * so they never clash when the OSRS item data is updated later.
 */
export const TfaItem = {
	RONDACHE: 74_600,
	ZORYAS_TOME: 74_601,
	HORN_OF_BRAN: 74_602,
	ASCENSION_CROSSBOWS: 74_603,
	OBLIGATOR: 74_604,
	ARCHIVISTS_FOLIO: 74_605,
	ASCENSION_SHARDS: 74_606,
	FRAGMENT_WIND: 74_607,
	FRAGMENT_WATER: 74_608,
	FRAGMENT_EARTH: 74_609,
	FRAGMENT_FIRE: 74_610,
	ORION: 74_611,
	LIVING_RECORD_T1: 74_612,
	LIVING_RECORD_T2: 74_613,
	LIVING_RECORD_T3: 74_614,
	LIVING_RECORD_T4: 74_615,
	LIVING_RECORD_T5: 74_616
} as const;

function equipment(
	stats: [
		number,
		number,
		number,
		number,
		number,
		number,
		number,
		number,
		number,
		number,
		number,
		number,
		number,
		number
	],
	slot: EquipmentSlot,
	requirements: Partial<ItemRequirements> | null
): ItemEquipment {
	const [as, asl, ac, am, ar, ds, dsl, dc, dm, dr, ms, rs, md, pr] = stats;
	return {
		attack_stab: as,
		attack_slash: asl,
		attack_crush: ac,
		attack_magic: am,
		attack_ranged: ar,
		defence_stab: ds,
		defence_slash: dsl,
		defence_crush: dc,
		defence_magic: dm,
		defence_ranged: dr,
		melee_strength: ms,
		ranged_strength: rs,
		magic_damage: md,
		prayer: pr,
		slot,
		requirements
	};
}

const tradeable = { tradeable: true, tradeable_on_ge: true };
const untradeable = { tradeable: false, tradeable_on_ge: false };
const noBoxes = { cantDropFromMysteryBoxes: true };

// Uniques. Stats are the OSRS wiki stats (uncharged items work as if charged in BSC).
setCustomItem(
	TfaItem.RONDACHE,
	'Rondache',
	'Avernic defender',
	{
		...tradeable,
		equipable: true,
		equipment: equipment([0, 0, 0, -5, -8, 35, 41, 38, -6, 55, 8, 0, 0, 0], EquipmentSlot.Shield, { defence: 80 }),
		customItemData: { ...noBoxes, examine: 'A finely crafted rondache shield.' }
	},
	11_000_000
);
setCustomItem(
	TfaItem.ZORYAS_TOME,
	"Zorya's tome (uncharged)",
	"Tumeken's shadow (uncharged)",
	{
		...tradeable,
		equipable: true,
		equipment: equipment([0, 0, 0, 45, 0, 1, 5, 5, 10, 0, 0, 0, 15, 2], EquipmentSlot.TwoHanded, { magic: 85 }),
		customItemData: { ...noBoxes, examine: 'The book is weighed down by all the knowledge it contains.' }
	},
	26_000_000
);
setCustomItem(
	TfaItem.HORN_OF_BRAN,
	'Horn of Bran',
	'Coal',
	{
		...tradeable,
		...UN_EQUIPPABLE,
		customItemData: {
			...noBoxes,
			examine: 'Based on text inscribed upon it, it presumably belonged to someone called Bran.'
		}
	},
	225_000_000
);
setCustomItem(
	TfaItem.ASCENSION_CROSSBOWS,
	'Ascension crossbows',
	'Twisted bow',
	{
		...tradeable,
		equipable: true,
		equipment: equipment([0, 0, 0, 3, 34, -7, -5, 0, 10, 0, 0, 0, 0, 0], EquipmentSlot.TwoHanded, { ranged: 80 }),
		customItemData: { ...noBoxes, examine: 'Ancient crossbows formed of powerful crystal.' }
	},
	200_000_000
);
setCustomItem(
	TfaItem.OBLIGATOR,
	'Obligator (uncharged)',
	'Elder maul',
	{
		...tradeable,
		equipable: true,
		equipment: equipment([22, -8, 120, 0, 0, 0, 16, 0, 3, 8, 40, 0, 0, 3], EquipmentSlot.TwoHanded, { attack: 85 }),
		customItemData: { ...noBoxes, examine: 'A huge mace on a writhing vine.' }
	},
	350_000_000
);

// Standard/tertiary rewards
setCustomItem(
	TfaItem.ARCHIVISTS_FOLIO,
	"Archivist's folio (inert)",
	'Coal',
	{
		...untradeable,
		...UN_EQUIPPABLE,
		customItemData: {
			...noBoxes,
			examine: 'A collection of manuscripts used by Guthixian archivists for convenient travel.'
		}
	},
	500
);
setCustomItem(
	TfaItem.ASCENSION_SHARDS,
	'Ascension shards',
	'Coal',
	{
		...tradeable,
		...UN_EQUIPPABLE,
		stackable: true,
		customItemData: { ...noBoxes, examine: 'Shards of powerful crystal.' }
	},
	500
);

export const TFA_FRAGMENTS = [
	[TfaItem.FRAGMENT_WIND, 'Fragment of whispering wind', 'air'],
	[TfaItem.FRAGMENT_WATER, 'Fragment of deep water', 'water'],
	[TfaItem.FRAGMENT_EARTH, 'Fragment of living earth', 'earth'],
	[TfaItem.FRAGMENT_FIRE, 'Fragment of burning fire', 'fire']
] as const;

for (const [id, name, element] of TFA_FRAGMENTS) {
	setCustomItem(
		id,
		name,
		'Coal',
		{
			...untradeable,
			...UN_EQUIPPABLE,
			customItemData: { ...noBoxes, examine: `A mysterious fragment, infused with the power of ${element}.` }
		},
		30_000
	);
}

setCustomItem(
	TfaItem.ORION,
	'Orion',
	'Herbi',
	{
		...untradeable,
		customItemData: { ...noBoxes, examine: 'Reality trembles with their mere presence.' }
	},
	10_000
);

export const TFA_LIVING_RECORDS = [
	[TfaItem.LIVING_RECORD_T1, 'Living record (tier 1)', 100],
	[TfaItem.LIVING_RECORD_T2, 'Living record (tier 2)', 500],
	[TfaItem.LIVING_RECORD_T3, 'Living record (tier 3)', 1000],
	[TfaItem.LIVING_RECORD_T4, 'Living record (tier 4)', 1500],
	[TfaItem.LIVING_RECORD_T5, 'Living record (tier 5)', 2000]
] as const;

for (const [id, name] of TFA_LIVING_RECORDS) {
	setCustomItem(
		id,
		name,
		'Infernal cape',
		{
			...untradeable,
			equipable: true,
			equipment: equipment([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], EquipmentSlot.Cape, null),
			customItemData: {
				...noBoxes,
				examine: 'Once used to honour the archivists, now awarded to those who defend their work.'
			}
		},
		10
	);
}

export const tfaUniqueItems = [
	TfaItem.RONDACHE,
	TfaItem.ZORYAS_TOME,
	TfaItem.HORN_OF_BRAN,
	TfaItem.ASCENSION_CROSSBOWS,
	TfaItem.OBLIGATOR
] as const;

export const tfaFragmentIDs: number[] = TFA_FRAGMENTS.map(f => f[0]);

/** 17 items, same order as the OSRS collection log. */
export const tfaCL: number[] = [
	TfaItem.ORION,
	TfaItem.LIVING_RECORD_T1,
	TfaItem.LIVING_RECORD_T2,
	TfaItem.LIVING_RECORD_T3,
	TfaItem.LIVING_RECORD_T4,
	TfaItem.LIVING_RECORD_T5,
	TfaItem.ASCENSION_SHARDS,
	TfaItem.FRAGMENT_EARTH,
	TfaItem.FRAGMENT_WATER,
	TfaItem.FRAGMENT_WIND,
	TfaItem.FRAGMENT_FIRE,
	TfaItem.HORN_OF_BRAN,
	TfaItem.ASCENSION_CROSSBOWS,
	TfaItem.OBLIGATOR,
	TfaItem.RONDACHE,
	TfaItem.ARCHIVISTS_FOLIO,
	TfaItem.ZORYAS_TOME
];

/** Items that post a server announcement when received from the raid. */
export const tfaAnnouncedItems: number[] = [...tfaUniqueItems, TfaItem.ORION];

/** Purple items for the chest image. */
export const tfaPurpleItems: number[] = [...tfaUniqueItems, TfaItem.ORION];
