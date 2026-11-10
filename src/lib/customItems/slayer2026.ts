import { EquipmentSlot } from '@oldschoolgg/gear';

import { setCustomItem, UN_EQUIPPABLE } from '@/lib/customItems/util.js';

export const Slayer2026Item = {
	VENATOR_FANG: 74_400,
	VENATOR_TOOTH: 74_401,
	VENATOR_HEART: 74_402,
	STYMPHIKE_FEATHER: 74_403,
	LETVEK: 74_404,
	ORIKALKUM_GRAVEL: 74_405,
	BLOOD_SAC: 74_406,
	GRAPEVINE: 74_407,
	TARNISHED_SPEAR: 74_408,
	TARNISHED_RING: 74_409,
	TARNISHED_AMULET: 74_410,
	TARNISHED_BRACELET: 74_411,
	TARNISHED_NECKLACE: 74_412,
	TARNISHED_2H_SWORD: 74_413,
	TARNISHED_BATTLEAXE: 74_414,
	TARNISHED_HALBERD: 74_415,
	TARNISHED_LONGSWORD: 74_416,
	HORN_OF_PLENTY_EMPTY: 74_417
} as const;

const items: [id: number, name: string, base: string, price: number][] = [
	[Slayer2026Item.VENATOR_FANG, 'Venator fang', 'Feather', 400],
	[Slayer2026Item.VENATOR_TOOTH, 'Venator tooth', 'Feather', 250],
	[Slayer2026Item.VENATOR_HEART, 'Venator heart', 'Coal', 250_000],
	[Slayer2026Item.STYMPHIKE_FEATHER, 'Stymphike feather', 'Feather', 60],
	[Slayer2026Item.LETVEK, 'Letvek', 'Coal', 40_000],
	[Slayer2026Item.ORIKALKUM_GRAVEL, 'Orikalkum gravel', 'Coal', 15_000],
	[Slayer2026Item.BLOOD_SAC, 'Blood sac', 'Feather', 700],
	[Slayer2026Item.GRAPEVINE, 'Grapevine', 'Coal', 1_500],
	[Slayer2026Item.TARNISHED_SPEAR, 'Tarnished spear', 'Coal', 6_000],
	[Slayer2026Item.TARNISHED_RING, 'Tarnished ring', 'Coal', 6_000],
	[Slayer2026Item.TARNISHED_AMULET, 'Tarnished amulet', 'Coal', 9_000],
	[Slayer2026Item.TARNISHED_BRACELET, 'Tarnished bracelet', 'Coal', 9_000],
	[Slayer2026Item.TARNISHED_NECKLACE, 'Tarnished necklace', 'Coal', 9_000],
	[Slayer2026Item.TARNISHED_2H_SWORD, 'Tarnished 2h sword', 'Coal', 12_000],
	[Slayer2026Item.TARNISHED_BATTLEAXE, 'Tarnished battleaxe', 'Coal', 12_000],
	[Slayer2026Item.TARNISHED_HALBERD, 'Tarnished halberd', 'Coal', 12_000],
	[Slayer2026Item.TARNISHED_LONGSWORD, 'Tarnished longsword', 'Coal', 12_000],
	[Slayer2026Item.HORN_OF_PLENTY_EMPTY, 'Horn of Plenty (empty)', 'Coal', 1_000_000]
];

for (const [id, name, base, price] of items) {
	setCustomItem(
		id,
		name,
		base,
		{
			...UN_EQUIPPABLE,
			customItemData: {
				cantDropFromMysteryBoxes: true
			}
		},
		price
	);
}

export const ShellbaneItem = {
	BELLES_FOLLY_TARNISHED: 74_442,
	BELLES_FOLLY: 74_443,
	JAR_OF_FEATHERS: 74_444,
	GULL: 74_445
} as const;

setCustomItem(
	ShellbaneItem.BELLES_FOLLY_TARNISHED,
	"Belle's folly (tarnished)",
	'Coal',
	{ ...UN_EQUIPPABLE, customItemData: { cantDropFromMysteryBoxes: true } },
	5_000_000
);

setCustomItem(
	ShellbaneItem.BELLES_FOLLY,
	"Belle's folly",
	'Dragon dagger',
	{
		customItemData: { cantDropFromMysteryBoxes: true },
		equipment: {
			attack_stab: 100,
			attack_slash: 78,
			attack_crush: -3,
			attack_magic: 0,
			attack_ranged: 0,
			defence_stab: 20,
			defence_slash: 15,
			defence_crush: -9,
			defence_magic: 0,
			defence_ranged: 0,
			melee_strength: 102,
			ranged_strength: 0,
			magic_damage: 0,
			prayer: 0,
			slot: EquipmentSlot.Weapon,
			requirements: { attack: 65 }
		},
		weapon: { attack_speed: 5 }
	},
	6_000_000
);

setCustomItem(
	ShellbaneItem.JAR_OF_FEATHERS,
	'Jar of Feathers',
	'Coal',
	{ ...UN_EQUIPPABLE, tradeable: false, tradeable_on_ge: false, customItemData: { cantDropFromMysteryBoxes: true } },
	1
);

setCustomItem(
	ShellbaneItem.GULL,
	'Gull',
	'Herbi',
	{ tradeable: true, tradeable_on_ge: true, customItemData: { cantDropFromMysteryBoxes: true } },
	1_000_000
);
