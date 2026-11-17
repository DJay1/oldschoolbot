import { Bank, Items } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import Buyables from '@/lib/data/buyables/buyables.js';
import {
	buyDailyLimitFor,
	buyDailyLimitKeyType,
	TOKKUL_SHOP_DAILY_LIMITS,
	tokkulShopDailyLimitFor,
	tokkulShopLimitName
} from '@/lib/data/buyables/skillingSupplyLimits.js';
import { TokkulShopItems } from '@/lib/data/buyables/tokkulBuyables.js';
import { applyBuyCostSellFloor } from '@/lib/util/buySellFloor.js';
import { sellPriceOfItem } from '@/mahoji/commands/sell.js';

describe('Nov 16 /buy changes', () => {
	test('Tokkul shop: 3,000 per ore per day, own counter, nothing else capped', () => {
		const ores = TokkulShopItems.filter(i => /ore$|^Coal$/.test(i.name)).map(i => i.name);
		// Gems were added to the same caps on Nov 17.
		const gems = ['Uncut sapphire', 'Uncut emerald', 'Uncut ruby', 'Uncut diamond', 'Uncut onyx'];
		expect([...ores, ...gems].sort()).toEqual(Object.keys(TOKKUL_SHOP_DAILY_LIMITS).sort());
		for (const ore of ores) expect(tokkulShopDailyLimitFor(ore), ore).toBe(3_000);
		expect(tokkulShopDailyLimitFor('Adamantite ore')).toBe(3_000);
		expect(tokkulShopDailyLimitFor('Runite ore')).toBe(3_000);
		expect(tokkulShopDailyLimitFor('Chaos rune')).toBeUndefined();
		expect(tokkulShopDailyLimitFor('Obsidian platebody')).toBeUndefined();
		// Separate Redis key from /buy, so the two shops never share or reset each other.
		expect(buyDailyLimitKeyType(tokkulShopLimitName('Iron ore'))).toBe('buy_daily_tokkul_shop_iron_ore');
		expect(buyDailyLimitKeyType('Iron ore')).toBe('buy_daily_iron_ore');
		expect(buyDailyLimitFor(tokkulShopLimitName('Iron ore'))).toBeUndefined();
	});

	test('Pumpkin seed: up to 1,000 per buy, still at least 2x /sell', () => {
		const seed = Buyables.find(b => b.name === 'Pumpkin seed')!;
		expect(seed.maxQuantity).toBe(1_000);
		const out = new Bank().add('Pumpkin seed', 1_000);
		const sell = sellPriceOfItem(Items.getOrThrow('Pumpkin seed'), 20).price * 1_000;
		expect(seed.gpCost! * 1_000).toBeGreaterThanOrEqual(sell * 2);
		expect(applyBuyCostSellFloor(seed.gpCost! * 1_000, out)).toBe(seed.gpCost! * 1_000);
	});

	test('Pumpkin is priced like other allotment crops', () => {
		const pumpkin = Items.getOrThrow('Pumpkin');
		expect(pumpkin.price).toBe(100);
		const sell = sellPriceOfItem(pumpkin).price;
		expect(sell).toBe(75);
		// Same yield as every other allotment (about 28 per patch). 3 seeds per patch at 500 GP each.
		const perPatch = 28 * sell - 3 * 500;
		expect(perPatch).toBeLessThan(1_000);
		expect(sellPriceOfItem(pumpkin, 20).price * 28).toBeLessThan(
			28 * sellPriceOfItem(Items.getOrThrow('Snape grass'), 20).price
		);
	});

	test('Fish barrel and Tackle box cost 6,000 Spirit flakes, 1 at a time, only if not owned', async () => {
		for (const name of ['Fish barrel', 'Tackle box']) {
			const b = Buyables.find(x => x.name === name)!;
			expect(b, name).toBeDefined();
			expect(new Bank(b.itemCost).amount('Spirit flakes')).toBe(6_000);
			expect(b.gpCost ?? 0).toBe(0);
			expect(b.maxQuantity).toBe(1);
			const owner = { allItemsOwned: new Bank().add(name) } as any;
			const fresh = { allItemsOwned: new Bank() } as any;
			expect((await b.customReq!(owner, {} as any))[0]).toBe(false);
			expect((await b.customReq!(fresh, {} as any))[0]).toBe(true);
			// Untradeable: /sell pays nothing, so the sell floor adds no GP.
			expect(applyBuyCostSellFloor(0, new Bank().add(name))).toBe(0);
		}
	});
});
