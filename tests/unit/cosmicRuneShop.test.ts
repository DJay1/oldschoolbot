import { Bank, EItem, Items } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import {
	applyBuyDailyReserve,
	buyDailyLimitFor,
	buyDailyLimitKeyType,
	COSMIC_RUNE_BUY_NAME,
	COSMIC_RUNE_BUY_PER_HOUR,
	COSMIC_RUNE_BUY_PER_HOUR_LUNARS,
	COSMIC_RUNE_DAILY_LIMIT,
	COSMIC_RUNE_DAILY_LIMIT_LUNARS,
	cosmicRuneBuyPerHour,
	cosmicRuneDailyLimit,
	formatCosmicRuneBuyLimitMessage,
	formatCosmicRunePurchaseNote,
	LUNAR_DIPLOMACY_CAP_HINT
} from '@/lib/data/buyables/skillingSupplyLimits.js';
import { tripBuyables } from '@/lib/data/buyables/tripBuyables.js';
import { QuestID, quests } from '@/lib/minions/data/quests.js';
import { applyBuyCostSellFloor } from '@/lib/util/buySellFloor.js';
import { calculateShopBuyCost } from '@/lib/util/calculateShopBuyCost.js';
import { sellPriceOfItem } from '@/mahoji/commands/sell.js';

const DISCORD_CONTENT_LIMIT = 2000;
const LENGTH_BUFFER = 150;
const BEST_COMMON_SELL_TAX_RATE = 20;
const AUTOCOMPLETE_CHOICE_NAME_LIMIT = 100;
const AUTOCOMPLETE_CHOICE_LIMIT = 25;

function worstLimitMessage(hasLunarDiplomacy: boolean) {
	return formatCosmicRuneBuyLimitMessage({
		requested: 9_007_199_254_740_991,
		dailyLimit: COSMIC_RUNE_DAILY_LIMIT_LUNARS,
		remaining: 9_007_199_254_740_991,
		resetAtSeconds: 9_007_199_254_740_991,
		hasLunarDiplomacy
	});
}

describe('Cosmic rune shop and Lunar Diplomacy', () => {
	test('Lunar Diplomacy is a completable quest with OSRS-like requirements', () => {
		const quest = quests.find(q => q.id === QuestID.LunarDiplomacy);
		expect(quest).toBeTruthy();
		expect(quest?.name).toBe('Lunar Diplomacy');
		expect(quest?.qp).toBe(2);
		expect(quest?.qpReq).toBe(40);
		expect(quest?.combatLevelReq).toBe(70);
		expect(quest?.skillReqs).toEqual({
			crafting: 61,
			defence: 40,
			firemaking: 49,
			herblore: 5,
			magic: 65,
			mining: 60,
			woodcutting: 55
		});

		const lowCombat = { combatLevel: 70 } as MUser;
		const highCombat = { combatLevel: 80 } as MUser;
		expect(quest!.calcTime(lowCombat)).toBeGreaterThan(quest!.calcTime(highCombat));

		const list = `That's not a valid quest, the quests you can do are: ${quests.map(q => q.name).join(', ')}.`;
		expect(list.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - LENGTH_BUFFER);
		expect(list).toContain('Lunar Diplomacy');
	});

	test('quest autocomplete labels stay within Discord limits after adding Lunar Diplomacy', () => {
		const choices = quests.map(i => ({ name: `${i.name} (completed)`, value: i.name }));
		expect(choices.length).toBeLessThanOrEqual(AUTOCOMPLETE_CHOICE_LIMIT);
		for (const choice of choices) {
			expect(choice.name.length, choice.name).toBeLessThanOrEqual(AUTOCOMPLETE_CHOICE_NAME_LIMIT);
			expect(choice.value.length, choice.value).toBeLessThanOrEqual(AUTOCOMPLETE_CHOICE_NAME_LIMIT);
		}
	});

	test('daily caps and buy rates depend on Lunar Diplomacy', () => {
		expect(cosmicRuneDailyLimit(false)).toBe(3_000);
		expect(cosmicRuneDailyLimit(true)).toBe(5_000);
		expect(cosmicRuneBuyPerHour(false)).toBe(7_500);
		expect(cosmicRuneBuyPerHour(true)).toBe(15_000);
		expect(buyDailyLimitFor('Cosmic rune')).toBe(COSMIC_RUNE_DAILY_LIMIT);
		expect(buyDailyLimitFor('Cosmic rune', { hasLunarDiplomacy: false })).toBe(3_000);
		expect(buyDailyLimitFor('Cosmic rune', { hasLunarDiplomacy: true })).toBe(5_000);
		expect(buyDailyLimitFor('COSMIC RUNE', { hasLunarDiplomacy: true })).toBe(5_000);
		expect(COSMIC_RUNE_BUY_PER_HOUR).toBe(7_500);
		expect(COSMIC_RUNE_BUY_PER_HOUR_LUNARS).toBe(15_000);
		expect(COSMIC_RUNE_DAILY_LIMIT).toBe(3_000);
		expect(COSMIC_RUNE_DAILY_LIMIT_LUNARS).toBe(5_000);
		expect(buyDailyLimitKeyType(COSMIC_RUNE_BUY_NAME)).toBe('buy_daily_cosmic_rune');
	});

	test('the same daily counter can grow from 3,000 to 5,000 after Lunar Diplomacy', () => {
		const first = applyBuyDailyReserve(0, 3_000, COSMIC_RUNE_DAILY_LIMIT);
		expect(first).toEqual({ ok: true, used: 3_000 });
		expect(applyBuyDailyReserve(first.used, 1, COSMIC_RUNE_DAILY_LIMIT)).toEqual({ ok: false, used: 3_000 });

		const afterQuest = applyBuyDailyReserve(first.used, 2_000, COSMIC_RUNE_DAILY_LIMIT_LUNARS);
		expect(afterQuest).toEqual({ ok: true, used: 5_000 });
		expect(applyBuyDailyReserve(afterQuest.used, 1, COSMIC_RUNE_DAILY_LIMIT_LUNARS)).toEqual({
			ok: false,
			used: 5_000
		});
	});

	test('shop entry is 100 GP and stays at or above 2x /sell', () => {
		const buyable = tripBuyables.find(tb => tb.item === EItem.COSMIC_RUNE);
		expect(buyable).toBeTruthy();
		expect(buyable!.gpCost).toBe(100);
		expect(buyable!.quantityPerHour).toBe(COSMIC_RUNE_BUY_PER_HOUR);
		expect(buyable!.shopQuantity).toBe(250);
		expect(buyable!.changePer).toBe(0.1);

		const item = Items.getOrThrow(EItem.COSMIC_RUNE);
		expect(item.name).toBe('Cosmic rune');
		const shop = calculateShopBuyCost({
			gpCost: buyable!.gpCost ?? 0,
			quantity: 1,
			shopQuantity: buyable!.shopQuantity,
			changePer: buyable!.changePer
		});
		const loot = new Bank().add(item.id, buyable!.quantity ?? 1);
		const cost = applyBuyCostSellFloor(shop.totalCost, loot);
		const sellValue = Math.floor(sellPriceOfItem(item, BEST_COMMON_SELL_TAX_RATE).price);
		expect(cost).toBe(100);
		expect(cost).toBeGreaterThanOrEqual(sellValue * 2);
	});

	test('cap messages show remaining, the Lunar Diplomacy boost, and stay under Discord limits', () => {
		const withoutQuest = formatCosmicRuneBuyLimitMessage({
			requested: 4_000,
			dailyLimit: 3_000,
			remaining: 0,
			resetAtSeconds: 1_800_000_000,
			hasLunarDiplomacy: false
		});
		expect(withoutQuest).toBe(
			'You can only buy 3,000x Cosmic rune per day. You have none left today. You can buy more <t:1800000000:R>. Complete Lunar Diplomacy with `/activities quest` to raise the cap to 5,000 a day and buy them twice as fast.'
		);
		expect(withoutQuest).toContain(LUNAR_DIPLOMACY_CAP_HINT);
		expect(withoutQuest.startsWith('You can only buy 3,000x Cosmic rune per day.')).toBe(true);

		const withRemaining = formatCosmicRuneBuyLimitMessage({
			requested: 4_000,
			dailyLimit: 3_000,
			remaining: 1_200,
			resetAtSeconds: 1_800_000_000,
			hasLunarDiplomacy: false
		});
		expect(withRemaining).toContain('you have 1,200 left today');
		expect(withRemaining).toContain(LUNAR_DIPLOMACY_CAP_HINT);

		const withQuest = formatCosmicRuneBuyLimitMessage({
			requested: 6_000,
			dailyLimit: 5_000,
			remaining: 0,
			resetAtSeconds: 1_800_000_000,
			hasLunarDiplomacy: true
		});
		expect(withQuest).toBe(
			'You can only buy 5,000x Cosmic rune per day. You have none left today. You can buy more <t:1800000000:R>.'
		);
		expect(withQuest).not.toContain('Lunar Diplomacy');

		const purchaseWithout = formatCosmicRunePurchaseNote({
			remaining: 1_500,
			dailyLimit: 3_000,
			hasLunarDiplomacy: false
		});
		expect(purchaseWithout).toBe(
			'You have 1,500 of 3,000 Cosmic rune left today. Complete Lunar Diplomacy with `/activities quest` to raise the cap to 5,000 a day and buy them twice as fast.'
		);

		const purchaseWith = formatCosmicRunePurchaseNote({
			remaining: 2_000,
			dailyLimit: 5_000,
			hasLunarDiplomacy: true
		});
		expect(purchaseWith).toBe('You have 2,000 of 5,000 Cosmic rune left today (Lunar Diplomacy cap).');

		const purchaseLine =
			'You purchased 9,007,199,254,740,991x Cosmic rune. This cost 9,007,199,254,740,991 GP (avg 9,007,199,254,740,991 ea).';
		for (const message of [
			withoutQuest,
			withRemaining,
			withQuest,
			purchaseWithout,
			purchaseWith,
			worstLimitMessage(false),
			worstLimitMessage(true),
			`${purchaseLine} ${formatCosmicRunePurchaseNote({
				remaining: 9_007_199_254_740_991,
				dailyLimit: COSMIC_RUNE_DAILY_LIMIT_LUNARS,
				hasLunarDiplomacy: false
			})}`
		]) {
			expect(message.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - LENGTH_BUFFER);
		}
	});
});
