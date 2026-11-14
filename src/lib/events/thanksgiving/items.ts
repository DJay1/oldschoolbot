import { setCustomItem, UN_EQUIPPABLE } from '@/lib/customItems/util.js';

/**
 * The Straw Hat Harvest (Thanksgiving 2026) items.
 * Registered even while the event is off so owned items keep their names and icons.
 * Drops, offers, and boosts are gated in ./core.ts.
 */
export const ThanksgivingItem = {
	HARVEST_BUNDLE: 74_210,
	WICKER_BASKET: 74_211,
	BOUNTIFUL_CORNUCOPIA: 74_212,
	PILGRIM_HAT: 74_213,
	STRAW_HAT: 74_214,
	GOBBLES: 74_215,
	GOBBLE_GOBBLE: 74_216,
	LABOON: 74_217,
	LABOON_STRAW_HAT: 74_218,
	/** The existing 2021 item. Reused as the rare offer result and for Harvest Blessing. */
	CORNUCOPIA_2021: 48_333
} as const;

// Parts: tradeable (GE too). Not sold in any shop, so there is no /buy price to compare against /sell.
setCustomItem(
	ThanksgivingItem.HARVEST_BUNDLE,
	'Harvest bundle',
	'Coal',
	{
		tradeable: true,
		tradeable_on_ge: true,
		...UN_EQUIPPABLE,
		customItemData: { cantDropFromMysteryBoxes: true }
	},
	10_000
);

setCustomItem(
	ThanksgivingItem.WICKER_BASKET,
	'Wicker basket',
	'Coal',
	{
		tradeable: true,
		tradeable_on_ge: true,
		...UN_EQUIPPABLE,
		customItemData: { cantDropFromMysteryBoxes: true }
	},
	25_000
);

setCustomItem(
	ThanksgivingItem.BOUNTIFUL_CORNUCOPIA,
	'Bountiful cornucopia',
	'Coal',
	{
		tradeable: true,
		tradeable_on_ge: true,
		...UN_EQUIPPABLE,
		customItemData: { cantDropFromMysteryBoxes: true }
	},
	75_000
);

// Hats and pets: untradeable for now (flip tradeable/tradeable_on_ge to change that).
for (const [id, name] of [
	[ThanksgivingItem.PILGRIM_HAT, 'Pilgrim hat'],
	[ThanksgivingItem.STRAW_HAT, 'Straw hat']
] as const) {
	setCustomItem(
		id,
		name,
		"Chef's hat",
		{
			tradeable: false,
			tradeable_on_ge: false,
			customItemData: { cantDropFromMysteryBoxes: true }
		},
		1
	);
}

for (const [id, name] of [
	[ThanksgivingItem.GOBBLES, 'Gobbles'],
	[ThanksgivingItem.GOBBLE_GOBBLE, 'Gobble gobble'],
	[ThanksgivingItem.LABOON, 'Laboon'],
	[ThanksgivingItem.LABOON_STRAW_HAT, 'Laboon (straw hat)']
] as const) {
	setCustomItem(
		id,
		name,
		'Herbi',
		{
			tradeable: false,
			tradeable_on_ge: false,
			customItemData: { cantDropFromMysteryBoxes: true, isPet: true }
		},
		1
	);
}
