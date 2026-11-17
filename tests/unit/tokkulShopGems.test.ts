import { Time } from '@oldschoolgg/toolkit';
import { describe, expect, test } from 'vitest';

import { tokkulShopDailyLimitFor } from '@/lib/data/buyables/skillingSupplyLimits.js';
import {
	TokkulShopItems,
	tokkulShopBuyDuration,
	tokkulShopMaxBuyable,
	tokkulShopStockFor
} from '@/lib/data/buyables/tokkulBuyables.js';

const item = (name: string) => TokkulShopItems.find(i => i.name === name)!;
const noJad = { hasKilledJad: false, isIronman: false };
const jad = { hasKilledJad: true, isIronman: false };
const ironJad = { hasKilledJad: true, isIronman: true };

describe('Tokkul shop gems and ores (Nov 17)', () => {
	test('Gems have flat times per item, halved with a TzTok-Jad kill', () => {
		const times: [string, number][] = [
			['Uncut sapphire', 1],
			['Uncut emerald', 1.5],
			['Uncut ruby', 2],
			['Uncut diamond', 3]
		];
		for (const [name, secs] of times) {
			expect(tokkulShopBuyDuration(item(name), jad, 1), name).toBe((secs * Time.Second) / 2);
			expect(tokkulShopBuyDuration(item(name), ironJad, 1), name).toBe((secs * Time.Second) / 2);
		}
		expect(tokkulShopBuyDuration(item('Uncut sapphire'), noJad, 1)).toBe(Time.Second);
		// Reported case: 30 Uncut emeralds used to take 30 minutes without a Jad kill.
		expect(tokkulShopBuyDuration(item('Uncut emerald'), noJad, 30)).toBe(45 * Time.Second);
		expect(tokkulShopBuyDuration(item('Uncut emerald'), jad, 30)).toBe(22.5 * Time.Second);
		expect(tokkulShopMaxBuyable(item('Uncut emerald'), noJad, 30 * Time.Minute)).toBe(1_200);
	});

	test('Uncut onyx and everything else keep 1 minute per restock', () => {
		expect(tokkulShopBuyDuration(item('Uncut onyx'), jad, 2)).toBe(2 * Time.Minute);
		expect(tokkulShopBuyDuration(item('Iron ore'), noJad, 3)).toBe(2 * Time.Minute);
		expect(tokkulShopBuyDuration(item('Iron ore'), jad, 12)).toBe(Time.Minute);
		expect(tokkulShopBuyDuration(item('Fire rune'), noJad, 10_000)).toBe(2 * Time.Minute);
		expect(tokkulShopMaxBuyable(item('Iron ore'), jad, 30 * Time.Minute)).toBe(360);
	});

	test('Stock that applies to the player decides what is buyable', () => {
		// Was blocked for everyone because only `stock` (no Jad kill) was checked.
		for (const name of [
			'Uncut ruby',
			'Uncut diamond',
			'Silver ore',
			'Coal',
			'Gold ore',
			'Mithril ore',
			'Adamantite ore',
			'Runite ore'
		]) {
			expect(tokkulShopBuyDuration(item(name), noJad, 1), name).toBeNull();
			expect(tokkulShopBuyDuration(item(name), jad, 1), name).not.toBeNull();
			expect(tokkulShopBuyDuration(item(name), ironJad, 1), name).not.toBeNull();
		}
		expect(tokkulShopStockFor(item('Uncut ruby'), ironJad)).toBe(4);
		expect(tokkulShopBuyDuration(item('Runite ore'), jad, 2)).toBe(2 * Time.Minute);
		// Not sold by the shop at all.
		expect(tokkulShopBuyDuration(item('Uncut dragonstone'), jad, 1)).toBeNull();
	});

	test('Every ore and gem has a 3,000 daily cap', () => {
		for (const i of TokkulShopItems.filter(x => /ore$|^Coal$|^Uncut (?!dragonstone)/.test(x.name))) {
			expect(tokkulShopDailyLimitFor(i.name), i.name).toBe(3_000);
		}
		expect(tokkulShopDailyLimitFor('Uncut onyx')).toBe(3_000);
	});

	test('No buy/sell loop: buying always costs at least 2x what selling gives back', () => {
		for (const i of TokkulShopItems) {
			if (!i.tokkulCost || !i.diaryTokkulCost) continue;
			expect(i.tokkulCost, i.name).toBeGreaterThanOrEqual(i.tokkulReturn * 2);
			expect(i.diaryTokkulCost, i.name).toBeGreaterThanOrEqual((i.diaryTokkulReturn ?? 0) * 2);
		}
	});
});
