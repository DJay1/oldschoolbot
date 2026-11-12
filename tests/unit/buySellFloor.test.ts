import { Bank, Items } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import Buyables from '@/lib/data/buyables/buyables.js';
import { tripBuyables } from '@/lib/data/buyables/tripBuyables.js';
import { applyBuyCostSellFloor } from '@/lib/util/buySellFloor.js';
import { calculateShopBuyCost } from '@/lib/util/calculateShopBuyCost.js';
import { sellPriceOfItem } from '@/mahoji/commands/sell.js';

const BEST_COMMON_SELL_TAX_RATE = 20;

function sellPayout(itemId: number, qty: number): number {
	const item = Items.getOrThrow(itemId);
	return Math.floor(sellPriceOfItem(item, BEST_COMMON_SELL_TAX_RATE).price) * qty;
}

describe('buy cost is at least 2x /sell payout', () => {
	test('former shop /buy items cannot be sold for a profit', () => {
		const qty = 5000;
		for (const buyable of tripBuyables) {
			const item = Items.getOrThrow(buyable.item);
			const itemQty = (buyable.quantity ?? 1) * qty;
			const shop = calculateShopBuyCost({
				gpCost: buyable.gpCost ?? 0,
				quantity: qty,
				shopQuantity: buyable.shopQuantity,
				changePer: buyable.changePer
			});
			const loot = new Bank().add(item.id, itemQty);
			const buyCost = applyBuyCostSellFloor(shop.totalCost, loot);
			const sellValue = sellPayout(item.id, itemQty);
			expect(buyCost, `${item.name} / ${buyable.displayName ?? item.name}`).toBeGreaterThanOrEqual(sellValue * 2);
			expect(buyCost).toBeGreaterThan(sellValue);
		}
	});

	test('regular GP /buy items cannot be sold for a profit', () => {
		for (const buyable of Buyables) {
			if (buyable.gpCost === undefined || buyable.itemCost !== undefined) continue;
			if (typeof buyable.outputItems === 'function') continue;
			const output =
				buyable.outputItems === undefined
					? new Bank().add(Items.getOrThrow(buyable.name).id)
					: buyable.outputItems.clone();
			if (output.length === 0) continue;
			const buyCost = applyBuyCostSellFloor(buyable.gpCost, output);
			let sellValue = 0;
			for (const [item, qty] of output.items()) {
				sellValue += sellPayout(item.id, qty);
			}
			expect(buyCost, buyable.name).toBeGreaterThanOrEqual(sellValue * 2);
		}
	});

	test('Pineapple 5k costs at least twice the /sell payout', () => {
		const item = Items.getOrThrow('Pineapple');
		const qty = 5000;
		const shop = calculateShopBuyCost({
			gpCost: 5,
			quantity: qty,
			shopQuantity: 15,
			changePer: 2
		});
		const loot = new Bank().add(item.id, qty);
		const buyCost = applyBuyCostSellFloor(shop.totalCost, loot);
		const sellValue = sellPayout(item.id, qty);
		expect(shop.totalCost).toBeLessThan(sellValue);
		expect(buyCost).toBe(Math.max(shop.totalCost, sellValue * 2));
		expect(buyCost).toBeGreaterThan(sellValue);
	});
});
