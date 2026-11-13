import { type Item, Items } from 'oldschooljs';

import { VampyriumItem } from '@/lib/customItems/bloodMoon.js';

interface CutLeapingFish {
	item: Item;
	aliases: string[];
	tickRate: number;
}

export const LeapingFish: CutLeapingFish[] = [
	{
		item: Items.getOrThrow('Leaping sturgeon'),
		aliases: ['leaping sturgeon', 'cut leaping sturgeon', 'sturgeon'],
		tickRate: 1
	},
	{
		item: Items.getOrThrow('Leaping trout'),
		aliases: ['leaping trout', 'cut leaping trout'],
		tickRate: 1
	},
	{
		item: Items.getOrThrow('Leaping salmon'),
		aliases: ['leaping salmon', 'cut leaping salmon'],
		tickRate: 1
	},
	{
		item: Items.getOrThrow(VampyriumItem.LEECHFIN),
		aliases: ['leechfin', 'cut leechfin', 'leechfins'],
		tickRate: 2
	},
	{
		item: Items.getOrThrow('Raw haddock'),
		aliases: ['raw haddock', 'haddock', 'cut haddock', 'haddock eye'],
		tickRate: 3
	}
];
