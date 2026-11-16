import { Bank, LootTable } from 'oldschooljs';

import { Slayer2026Item } from '@/lib/customItems/slayer2026.js';
import type { Craftable } from '@/lib/skilling/types.js';

const polish = (name: string, id: number, outputTable: LootTable): Craftable => ({
	name,
	alias: [`polish ${name.toLowerCase()}`],
	id,
	level: 64,
	xp: 225,
	inputItems: new Bank().add(id),
	tickRate: 1,
	outputTable
});

export const tarnishedPolishables: Craftable[] = [
	polish(
		'Tarnished spear',
		Slayer2026Item.TARNISHED_SPEAR,
		new LootTable().add('Rune spear', 1, 7).add('Adamant spear', 1, 2).add('Mithril spear', 1, 1)
	),
	polish(
		'Tarnished ring',
		Slayer2026Item.TARNISHED_RING,
		new LootTable().add('Ruby ring', 1, 7).add('Topaz ring', 1, 2).add('Sapphire ring', 1, 1)
	),
	polish(
		'Tarnished amulet',
		Slayer2026Item.TARNISHED_AMULET,
		new LootTable().add('Ruby amulet (u)', 1, 6).add('Sapphire amulet (u)', 1, 3).add('Diamond amulet (u)', 1, 1)
	),
	polish(
		'Tarnished bracelet',
		Slayer2026Item.TARNISHED_BRACELET,
		new LootTable().add('Ruby bracelet', 1, 5).add('Diamond bracelet', 1, 4).add('Topaz bracelet', 1, 1)
	),
	polish(
		'Tarnished necklace',
		Slayer2026Item.TARNISHED_NECKLACE,
		new LootTable().add('Ruby necklace', 1, 5).add('Diamond necklace', 1, 4).add('Jade necklace', 1, 1)
	),
	polish(
		'Tarnished 2h sword',
		Slayer2026Item.TARNISHED_2H_SWORD,
		new LootTable().add('Rune 2h sword', 1, 5).add('Adamant 2h sword', 1, 4).add('Mithril 2h sword', 1, 1)
	),
	polish(
		'Tarnished battleaxe',
		Slayer2026Item.TARNISHED_BATTLEAXE,
		new LootTable().add('Rune battleaxe', 1, 5).add('Adamant battleaxe', 1, 4).add('Dragon battleaxe', 1, 1)
	),
	polish(
		'Tarnished halberd',
		Slayer2026Item.TARNISHED_HALBERD,
		new LootTable().add('Rune halberd', 1, 5).add('Adamant halberd', 1, 4).add('Dragon halberd', 1, 1)
	),
	polish(
		'Tarnished longsword',
		Slayer2026Item.TARNISHED_LONGSWORD,
		new LootTable().add('Rune longsword', 1, 5).add('Adamant longsword', 1, 4).add('Dragon longsword', 1, 1)
	)
];
