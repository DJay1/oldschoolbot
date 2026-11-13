import { EItem } from 'oldschooljs';

import type { Buyable } from '@/lib/data/buyables/buyables.js';

export interface TripBuyable extends Omit<Buyable, 'name' | 'outputItems'> {
	item: EItem;
	quantity?: number;
	displayName?: string;
}

export const tripBuyables: TripBuyable[] = [
	{ item: EItem.PINEAPPLE, gpCost: 608, quantityPerHour: 3_500, shopQuantity: 15, changePer: 2 },
	{ item: EItem.BANANA, gpCost: 304, quantityPerHour: 3_500, shopQuantity: 15, changePer: 2 },
	{ item: EItem.ORANGE, gpCost: 368, quantityPerHour: 3_250, shopQuantity: 10, changePer: 2 },
	{ item: EItem.BUCKET_OF_SAND, gpCost: 104, quantityPerHour: 3_250, shopQuantity: 10, changePer: 2 },
	{ item: EItem.SODA_ASH, gpCost: 64, quantityPerHour: 3_250, shopQuantity: 10, changePer: 2 },
	{ item: EItem.ARROW_SHAFT, gpCost: 4, quantityPerHour: 400_000, shopQuantity: 1000, changePer: 1 },
	{ item: EItem.COPPER_ORE, gpCost: 136, quantityPerHour: 11_000 },
	{ item: EItem.TIN_ORE, gpCost: 112, quantityPerHour: 11_000 },
	{ item: EItem.IRON_ORE, gpCost: 492, quantityPerHour: 11_000 },
	{ item: EItem.MITHRIL_ORE, gpCost: 486, quantityPerHour: 11_000 },
	{ item: EItem.SILVER_ORE, gpCost: 224, quantityPerHour: 11_000 },
	{ item: EItem.GOLD_ORE, gpCost: 450, quantityPerHour: 11_000 },
	{ item: EItem.COAL, gpCost: 496, quantityPerHour: 11_000 },
	{ item: EItem.BLOOD_RUNE, gpCost: 800, quantityPerHour: 15_000, shopQuantity: 250, changePer: 0.1 },
	{ item: EItem.LAW_RUNE, gpCost: 480, quantityPerHour: 15_000, shopQuantity: 250, changePer: 0.1 },
	{ item: EItem.SOUL_RUNE, gpCost: 600, quantityPerHour: 15_000, shopQuantity: 250, changePer: 0.1 },
	{ item: EItem.ASTRAL_RUNE, gpCost: 100, quantityPerHour: 15_000, shopQuantity: 250, changePer: 0.1 },
	{ item: EItem.DEATH_RUNE, gpCost: 360, quantityPerHour: 15_000, shopQuantity: 250, changePer: 0.1 },
	{ item: EItem.NATURE_RUNE, gpCost: 360, quantityPerHour: 15_000, shopQuantity: 250, changePer: 0.1 },
	{ item: EItem.CHAOS_RUNE, gpCost: 180, quantityPerHour: 15_000, shopQuantity: 250, changePer: 0.1 },
	{
		item: EItem.CHAOS_RUNE,
		gpCost: 19_900,
		quantityPerHour: 1_500,
		shopQuantity: 35,
		changePer: 0.1,
		quantity: 100,
		displayName: 'Chaos rune (pack)'
	}
];

export function findTripBuyable(itemID: EItem, totalQuantity?: number): TripBuyable | undefined {
	const matches = tripBuyables.filter(tb => tb.item === itemID);
	if (matches.length <= 1) return matches[0];
	if (typeof totalQuantity === 'number') {
		for (const tb of matches) {
			if (tb.quantity && totalQuantity % tb.quantity === 0) {
				return tb;
			}
		}
	}
	return matches[0];
}
