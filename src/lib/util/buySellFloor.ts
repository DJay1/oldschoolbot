import { Bank, type Item } from 'oldschooljs';

import { sellPriceOfItem } from '@/mahoji/commands/sell.js';

/** Skipper lowers the /sell tax to 20%, which is the best normal payout. */
const BEST_COMMON_SELL_TAX_RATE = 20;

/**
 * Raise a /buy GP cost so it is never below 2x what /sell would pay for the items.
 */
export function applyBuyCostSellFloor(existingGpCost: number, output: Bank): number {
	if (!Number.isSafeInteger(existingGpCost) || existingGpCost < 0) {
		return existingGpCost;
	}
	let minCost = 0;
	for (const [item, qty] of output.items()) {
		const unitSell = Math.floor(sellPriceOfItem(item, BEST_COMMON_SELL_TAX_RATE).price);
		if (unitSell <= 0) continue;
		const line = unitSell * 2 * qty;
		if (!Number.isSafeInteger(minCost + line)) {
			return Number.MAX_SAFE_INTEGER;
		}
		minCost += line;
	}
	return Math.max(existingGpCost, minCost);
}

export function applyBuyCostSellFloorToItem(existingGpCost: number, item: Item, quantity: number): number {
	return applyBuyCostSellFloor(existingGpCost, new Bank().add(item.id, quantity));
}
