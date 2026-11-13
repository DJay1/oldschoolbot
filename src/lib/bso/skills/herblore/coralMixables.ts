import { Bank, Items } from 'oldschooljs';

import { CoralPotionItem } from '@/lib/customItems/coralPotions.js';
import type { Mixable } from '@/lib/skilling/types.js';

export const coralMixables: Mixable[] = [
	{
		item: Items.getOrThrow('Elkhorn potion (unf)'),
		aliases: ['elkhorn potion (unf)', 'elkhorn potion', 'elkhorn (unf)'],
		level: 56,
		xp: 0,
		inputItems: new Bank({ 'Elkhorn coral': 1, 'Vial of water': 1 }),
		tickRate: 1,
		bankTimePerPotion: 0.3
	},
	{
		item: Items.getOrThrow('Pillar potion (unf)'),
		aliases: ['pillar potion (unf)', 'pillar potion', 'pillar (unf)'],
		level: 62,
		xp: 0,
		inputItems: new Bank({ 'Pillar coral': 1, 'Vial of water': 1 }),
		tickRate: 1,
		bankTimePerPotion: 0.3
	},
	{
		item: Items.getOrThrow('Umbral potion (unf)'),
		aliases: ['umbral potion (unf)', 'umbral potion', 'umbral (unf)'],
		level: 89,
		xp: 0,
		inputItems: new Bank({ 'Umbral coral': 1, 'Vial of water': 1 }),
		tickRate: 1,
		bankTimePerPotion: 0.3
	},
	{
		item: Items.getOrThrow('Anti-odour salt'),
		aliases: ['anti-odour salt', 'anti odour salt', 'salt'],
		level: 49,
		xp: 11,
		inputItems: new Bank({ 'Elkhorn coral': 1, 'Crab paste': 5 }),
		tickRate: 2,
		bankTimePerPotion: 0.3,
		outputMultiple: 15
	},
	{
		item: Items.getOrThrow('Haemostatic poultice'),
		aliases: ['haemostatic poultice', 'poultice'],
		level: 56,
		xp: 27,
		inputItems: new Bank({ 'Elkhorn potion (unf)': 1, 'Squid paste': 1 }),
		tickRate: 2,
		bankTimePerPotion: 0.3
	},
	{
		item: Items.getOrThrow(CoralPotionItem.SUPER_FISHING_POTION[2]),
		aliases: ['super fishing potion', 'super fishing potion(3)', 'super fishing'],
		level: 62,
		xp: 140.5,
		inputItems: new Bank({ 'Pillar potion (unf)': 1, 'Haddock eye': 1 }),
		tickRate: 2,
		bankTimePerPotion: 0.3
	},
	{
		item: Items.getOrThrow(CoralPotionItem.SUPER_HUNTER_POTION[2]),
		aliases: ['super hunter potion', 'super hunter potion(3)', 'super hunter'],
		level: 67,
		xp: 154,
		inputItems: new Bank({ 'Pillar potion (unf)': 1, 'Crab paste': 1 }),
		tickRate: 2,
		bankTimePerPotion: 0.3
	},
	{
		item: Items.getOrThrow(CoralPotionItem.ARMADYL_BREW[2]),
		aliases: ['armadyl brew', 'armadyl brew(3)', 'arma brew'],
		level: 89,
		xp: 205,
		inputItems: new Bank({ 'Umbral potion (unf)': 1, 'Rainbow crab paste': 1 }),
		tickRate: 2,
		bankTimePerPotion: 0.3
	}
];

export const coralMixableIDs = new Set(coralMixables.map(m => m.item.id));
