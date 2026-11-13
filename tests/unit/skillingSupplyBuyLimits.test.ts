import { Bank, Items } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import Buyables from '@/lib/data/buyables/buyables.js';
import {
	applyBuyDailyReserve,
	buyDailyLimitFor,
	buyDailyLimitKeyType,
	formatBuyDailyLimitMessage,
	SKILLING_SUPPLY_DAILY_LIMITS
} from '@/lib/data/buyables/skillingSupplyLimits.js';
import { tripBuyables } from '@/lib/data/buyables/tripBuyables.js';
import { applyBuyCostSellFloor } from '@/lib/util/buySellFloor.js';
import { calculateShopBuyCost } from '@/lib/util/calculateShopBuyCost.js';
import { sellPriceOfItem } from '@/mahoji/commands/sell.js';

const BEST_COMMON_SELL_TAX_RATE = 20;

const EXPECTED_EFFECTIVE_UNIT_COST: Record<string, number> = {
	Vial: 60,
	'Vial of water': 120,
	Bucket: 60,
	'Empty bucket pack': 20_000,
	'Jug of Water': 200,
	'Bolt of cloth': 10_000,
	'Mithril seeds': 6_000,
	'Fishing Bait': 40,
	'Ball of wool': 600,
	Sandworms: 1_000,
	'Bucket of water': 1_000,
	Rope: 220,
	'Cup of hot water': 3_000,
	'Arrow shaft': 4,
	Feather: 100,
	'Air rune': 30,
	'Earth rune': 30,
	'Water rune': 30,
	'Fire rune': 30,
	'Mind rune': 50,
	'Body rune': 40,
	'Astral rune': 100,
	'Chaos rune': 180,
	'Chaos rune (pack)': 19_900,
	'Nature rune': 360,
	'Death rune': 360,
	'Law rune': 480,
	'Soul rune': 600,
	'Blood rune': 800,
	'Copper ore': 136,
	'Tin ore': 112,
	'Iron ore': 492,
	Coal: 496,
	'Silver ore': 224,
	'Gold ore': 450,
	'Mithril ore': 486,
	'Bucket of sand': 104,
	'Soda ash': 64,
	Pineapple: 608,
	Banana: 304,
	Orange: 368,
	'Eye of newt': 600,
	Compost: 1_400,
	'Olive oil(4)': 640,
	'Limestone brick': 2_000,
	'Olive oil pack': 5_340
};

const UNLIMITED = [
	'Vial',
	'Vial of water',
	'Bucket',
	'Empty bucket pack',
	'Jug of Water',
	'Bolt of cloth',
	'Mithril seeds',
	'Fishing Bait',
	'Ball of wool',
	'Sandworms',
	'Bucket of water',
	'Rope',
	'Cup of hot water'
];

function sellPayout(itemId: number, qty: number): number {
	const item = Items.getOrThrow(itemId);
	return Math.floor(sellPriceOfItem(item, BEST_COMMON_SELL_TAX_RATE).price) * qty;
}

function tripEffectiveCost(name: string): { cost: number; loot: Bank } | null {
	const buyable = tripBuyables.find(tb => (tb.displayName ?? Items.get(tb.item)?.name) === name);
	if (!buyable) return null;
	const item = Items.getOrThrow(buyable.item);
	const shop = calculateShopBuyCost({
		gpCost: buyable.gpCost ?? 0,
		quantity: 1,
		shopQuantity: buyable.shopQuantity,
		changePer: buyable.changePer
	});
	const loot = new Bank().add(item.id, buyable.quantity ?? 1);
	return { cost: applyBuyCostSellFloor(shop.totalCost, loot), loot };
}

function regularEffectiveCost(name: string): { cost: number; loot: Bank } | null {
	const fromAll = Buyables.find(b => b.name === name);
	if (!fromAll) return null;
	if (typeof fromAll.outputItems === 'function') return null;
	const loot =
		fromAll.outputItems === undefined
			? new Bank().add(Items.getOrThrow(fromAll.name).id)
			: fromAll.outputItems.clone();
	return { cost: applyBuyCostSellFloor(fromAll.gpCost ?? 0, loot), loot };
}

describe('skilling supply /buy prices and daily limits', () => {
	test('qty-1 effective cost matches the shipped prices and stays at or above 2x /sell', () => {
		for (const [name, expected] of Object.entries(EXPECTED_EFFECTIVE_UNIT_COST)) {
			const found = tripEffectiveCost(name) ?? regularEffectiveCost(name);
			expect(found, name).not.toBeNull();
			const { cost, loot } = found!;
			let sellValue = 0;
			for (const [item, qty] of loot.items()) {
				sellValue += sellPayout(item.id, qty);
			}
			expect(cost, name).toBe(expected);
			expect(cost, `${name} floor`).toBeGreaterThanOrEqual(sellValue * 2);
		}
	});

	test('daily limits match the agreed list, and unlimited items have no cap', () => {
		expect(buyDailyLimitFor('Arrow shaft')).toBe(5_000);
		expect(buyDailyLimitFor('Feather')).toBe(2_000);
		expect(buyDailyLimitFor('Air rune')).toBe(5_000);
		expect(buyDailyLimitFor('Chaos rune')).toBe(1_000);
		expect(buyDailyLimitFor('Chaos rune (pack)')).toBe(10);
		expect(buyDailyLimitFor('Eye of newt')).toBe(500);
		expect(buyDailyLimitFor('Compost')).toBe(250);
		expect(buyDailyLimitFor('Olive oil pack')).toBe(10);
		expect(Object.keys(SKILLING_SUPPLY_DAILY_LIMITS)).toHaveLength(33);
		for (const name of UNLIMITED) {
			expect(buyDailyLimitFor(name), name).toBeUndefined();
		}
	});

	test('limit message shows remaining amount and a Discord relative timestamp', () => {
		const message = formatBuyDailyLimitMessage({
			name: 'Feather',
			requested: 2_500,
			dailyLimit: 2_000,
			remaining: 1_100,
			resetAtSeconds: 1_800_000_000
		});
		expect(message).toBe(
			'You can only buy 2,000x Feather per day. You tried to buy 2,500, but you have 1,100 left today. You can buy more <t:1800000000:R>.'
		);

		const empty = formatBuyDailyLimitMessage({
			name: 'Feather',
			requested: 1,
			dailyLimit: 2_000,
			remaining: 0,
			resetAtSeconds: 1_800_000_000
		});
		expect(empty).toBe(
			'You can only buy 2,000x Feather per day. You have none left today. You can buy more <t:1800000000:R>.'
		);
	});

	test('atomic reserve cannot pass the cap, including overlapping increments', () => {
		let used = 0;
		const cap = 1_000;
		const first = applyBuyDailyReserve(used, 900, cap);
		expect(first).toEqual({ ok: true, used: 900 });
		used = first.used;
		const second = applyBuyDailyReserve(used, 200, cap);
		expect(second).toEqual({ ok: false, used: 900 });
		const exact = applyBuyDailyReserve(used, 100, cap);
		expect(exact).toEqual({ ok: true, used: 1_000 });
		expect(applyBuyDailyReserve(0, 0, cap).ok).toBe(false);
		expect(applyBuyDailyReserve(0, -5, cap).ok).toBe(false);
	});

	test('shop quantity scaling still applies on trip buyables after the base unit price change', () => {
		const pineapple = tripBuyables.find(tb => tb.item === Items.getOrThrow('Pineapple').id)!;
		const one = calculateShopBuyCost({
			gpCost: pineapple.gpCost ?? 0,
			quantity: 1,
			shopQuantity: pineapple.shopQuantity,
			changePer: pineapple.changePer
		});
		const many = calculateShopBuyCost({
			gpCost: pineapple.gpCost ?? 0,
			quantity: 30,
			shopQuantity: pineapple.shopQuantity,
			changePer: pineapple.changePer
		});
		expect(one.totalCost).toBe(608);
		expect(many.averageCost).toBeGreaterThan(one.averageCost);
		expect(buyDailyLimitKeyType('Chaos rune (pack)')).toBe('buy_daily_chaos_rune_pack');
	});
});
