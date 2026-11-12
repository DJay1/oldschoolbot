import { readFileSync } from 'node:fs';

import { Bank, Items } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { applyBuyCostSellFloor } from '@/lib/util/buySellFloor.js';
import { GF_COST_GP, GF_GIF_PATH, GF_ITEM_ID, gfQuantityError, isGfBuyName } from '@/mahoji/lib/abstracted_commands/buyGf.js';
import { sellPriceOfItem } from '@/mahoji/commands/sell.js';

const BEST_COMMON_SELL_TAX_RATE = 20;

describe('/buy gf', () => {
	test('matches gf and girlfriend names', () => {
		expect(isGfBuyName('gf')).toBe(true);
		expect(isGfBuyName('GF')).toBe(true);
		expect(isGfBuyName('girlfriend')).toBe(true);
		expect(isGfBuyName('Girl Friend')).toBe(true);
		expect(isGfBuyName('kitten')).toBe(false);
	});

	test('rejects any quantity other than 1', () => {
		expect(gfQuantityError(null)).toBeNull();
		expect(gfQuantityError(1)).toBeNull();
		expect(gfQuantityError(2)).toBe('You can only buy gf in a quantity of 1.');
		expect(gfQuantityError(1000)).toBe('You can only buy gf in a quantity of 1.');
	});

	test('gives Ana in a barrel and costs at least 2x the /sell payout', () => {
		const item = Items.getOrThrow(GF_ITEM_ID);
		expect(item.id).toBe(1842);
		expect(item.name).toBe('Ana in a barrel');
		const loot = new Bank().add(item.id, 1);
		const buyCost = applyBuyCostSellFloor(GF_COST_GP, loot);
		const sellValue = Math.floor(sellPriceOfItem(item, BEST_COMMON_SELL_TAX_RATE).price);
		expect(buyCost).toBeGreaterThanOrEqual(sellValue * 2);
		expect(buyCost).toBe(GF_COST_GP);
	});

	test('ships a local corgi-love gif under 5MB', () => {
		const buf = readFileSync(GF_GIF_PATH);
		expect(buf.subarray(0, 3).toString('ascii')).toBe('GIF');
		expect(buf.length).toBeGreaterThan(1000);
		expect(buf.length).toBeLessThan(5 * 1024 * 1024);
	});
});