import { EquipmentSlot } from '@oldschoolgg/gear';
import { Items } from 'oldschooljs';

import { setCustomItem } from '@/lib/customItems/util.js';

export const BloodMoonItem = {
	HALLOWED_FLAIL: 74_420,
	SUNSPEAR: 74_421,
	TOME_OF_EXPERIENCE: 74_422
} as const;

const questItem = {
	tradeable: false,
	tradeable_on_ge: false,
	customItemData: { cantDropFromMysteryBoxes: true }
};

setCustomItem(
	BloodMoonItem.HALLOWED_FLAIL,
	'Hallowed flail',
	'Blisterwood flail',
	{
		...questItem,
		equipment: {
			attack_stab: 32,
			attack_slash: 68,
			attack_crush: 0,
			attack_magic: 10,
			attack_ranged: 0,
			defence_stab: 0,
			defence_slash: 2,
			defence_crush: 0,
			defence_magic: 10,
			defence_ranged: 0,
			melee_strength: 46,
			ranged_strength: 0,
			magic_damage: 0,
			prayer: 6,
			slot: EquipmentSlot.Weapon,
			requirements: { attack: 50 }
		},
		weapon: { attack_speed: 4 }
	},
	80_000
);

setCustomItem(
	BloodMoonItem.SUNSPEAR,
	'Sunspear',
	'Dragon halberd',
	{
		...questItem,
		equipment: {
			attack_stab: 100,
			attack_slash: 21,
			attack_crush: 60,
			attack_magic: 0,
			attack_ranged: 0,
			defence_stab: 0,
			defence_slash: 42,
			defence_crush: 28,
			defence_magic: 0,
			defence_ranged: 0,
			melee_strength: 70,
			ranged_strength: 0,
			magic_damage: 0,
			prayer: 7,
			slot: EquipmentSlot.TwoHanded,
			requirements: {}
		},
		weapon: { attack_speed: 5 }
	},
	100_000
);

setCustomItem(
	BloodMoonItem.TOME_OF_EXPERIENCE,
	'Tome of experience (blood moon)',
	'Coal',
	{
		...questItem
	},
	1
);

export const MaggotKingItem = {
	ELDER_VENATOR_FANG: 74_423,
	ETCHED_ELDER_VENATOR_FANG: 74_424,
	NECKLACE_OF_RUPTURE: 74_425,
	CRIMSON_KISTEN: 74_426,
	MAGGOT_MARQUESS: 74_427,
	STYMPHIKE_TARTARE: 74_428,
	DULL_ANCIENT_MEDAL: 74_429
} as const;

const untradeable = {
	tradeable: false,
	tradeable_on_ge: false,
	customItemData: { cantDropFromMysteryBoxes: true }
};
const tradeable = {
	tradeable: true,
	tradeable_on_ge: true,
	customItemData: { cantDropFromMysteryBoxes: true }
};

setCustomItem(MaggotKingItem.ELDER_VENATOR_FANG, 'Elder venator fang', 'Coal', untradeable, 1);
setCustomItem(MaggotKingItem.ETCHED_ELDER_VENATOR_FANG, 'Etched elder venator fang', 'Coal', tradeable, 40_000_000);

setCustomItem(
	MaggotKingItem.NECKLACE_OF_RUPTURE,
	'Necklace of rupture',
	'Necklace of anguish',
	{
		...tradeable,
		equipment: {
			attack_stab: 0,
			attack_slash: 0,
			attack_crush: 0,
			attack_magic: 0,
			attack_ranged: 20,
			defence_stab: 0,
			defence_slash: 0,
			defence_crush: 0,
			defence_magic: 0,
			defence_ranged: 0,
			melee_strength: 0,
			ranged_strength: 8,
			magic_damage: 0,
			prayer: 3,
			slot: EquipmentSlot.Neck,
			requirements: { hitpoints: 90 }
		}
	},
	55_000_000
);

setCustomItem(
	MaggotKingItem.CRIMSON_KISTEN,
	'Crimson kisten',
	'Elder maul',
	{
		...tradeable,
		equipment: {
			attack_stab: 0,
			attack_slash: 0,
			attack_crush: 80,
			attack_magic: 0,
			attack_ranged: 0,
			defence_stab: 0,
			defence_slash: 0,
			defence_crush: 0,
			defence_magic: 0,
			defence_ranged: 0,
			melee_strength: 56,
			ranged_strength: 0,
			magic_damage: 0,
			prayer: 0,
			slot: EquipmentSlot.TwoHanded,
			requirements: { attack: 60, strength: 85 }
		},
		weapon: { attack_speed: 4 }
	},
	25_000_000
);

setCustomItem(MaggotKingItem.MAGGOT_MARQUESS, 'Maggot marquess', 'Herbi', tradeable, 1_000_000);
setCustomItem(MaggotKingItem.STYMPHIKE_TARTARE, 'Stymphike tartare', 'Shark', untradeable, 1);
setCustomItem(MaggotKingItem.DULL_ANCIENT_MEDAL, 'Dull ancient medal', 'Coal', untradeable, 50);

export const VampyriumItem = {
	BUCKET_OF_BLOODWOOD_SAP: 74_430,
	LEECHFIN: 74_431,
	STYMPHIKE_CARCASS: 74_432
} as const;

setCustomItem(VampyriumItem.BUCKET_OF_BLOODWOOD_SAP, 'Bucket of bloodwood sap', 'Coal', untradeable, 1);
setCustomItem(VampyriumItem.LEECHFIN, 'Leechfin', 'Coal', tradeable, 300);
setCustomItem(VampyriumItem.STYMPHIKE_CARCASS, 'Stymphike carcass', 'Coal', untradeable, 1);

export const SEEKING_ARROWS: readonly { id: number; name: string; base: string }[] = [
	{ id: 74_433, name: 'Seeking bronze arrow', base: 'Bronze arrow' },
	{ id: 74_434, name: 'Seeking iron arrow', base: 'Iron arrow' },
	{ id: 74_435, name: 'Seeking steel arrow', base: 'Steel arrow' },
	{ id: 74_436, name: 'Seeking mithril arrow', base: 'Mithril arrow' },
	{ id: 74_437, name: 'Seeking broad arrows', base: 'Broad arrows' },
	{ id: 74_438, name: 'Seeking adamant arrow', base: 'Adamant arrow' },
	{ id: 74_439, name: 'Seeking rune arrow', base: 'Rune arrow' },
	{ id: 74_440, name: 'Seeking amethyst arrow', base: 'Amethyst arrow' },
	{ id: 74_441, name: 'Seeking dragon arrow', base: 'Dragon arrow' },
	{ id: 74_449, name: 'Seeking hellfire arrow', base: 'Hellfire arrow' }
];

export function setSeekingArrowItems() {
	for (const arrow of SEEKING_ARROWS) {
		const base = Items.getOrThrow(arrow.base);
		setCustomItem(
			arrow.id,
			arrow.name,
			arrow.base,
			{
				...tradeable,
				equipment: { attack_ranged: (base.equipment?.attack_ranged ?? 0) + 20 }
			},
			(base.price ?? 1) * 2
		);
	}
}

export const SeekingFletchItem = {
	SAP_TREATED_REDWOOD_LOGS: 74_446,
	SEEKING_ARROW_SHAFT: 74_447,
	SEEKING_HEADLESS_ARROW: 74_448
} as const;

setCustomItem(SeekingFletchItem.SAP_TREATED_REDWOOD_LOGS, 'Sap-treated redwood logs', 'Redwood logs', tradeable, 2_000);
setCustomItem(SeekingFletchItem.SEEKING_ARROW_SHAFT, 'Seeking arrow shaft', 'Arrow shaft', tradeable, 20);
setCustomItem(SeekingFletchItem.SEEKING_HEADLESS_ARROW, 'Seeking headless arrow', 'Headless arrow', tradeable, 25);
