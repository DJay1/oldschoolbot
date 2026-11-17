import { Time } from '@oldschoolgg/toolkit';
import { describe, expect, test } from 'vitest';

import { formatBuyDailyLimitMessage } from '@/lib/data/buyables/skillingSupplyLimits.js';
import { TokkulShopItems, tokkulShopBuyDuration, tokkulShopMaxBuyable } from '@/lib/data/buyables/tokkulBuyables.js';
import {
	tokkulShopBlockedMessage,
	tokkulShopDiaryNote,
	tokkulShopJadNote,
	tokkulShopTooLongMessage
} from '@/lib/data/buyables/tokkulShopMessages.js';

const item = (name: string) => TokkulShopItems.find(i => i.name === name)!;
const noJad = { hasKilledJad: false, isIronman: false };
const jad = { hasKilledJad: true, isIronman: false };
const ironNoJad = { hasKilledJad: false, isIronman: true };

describe('Tokkul shop player messages', () => {
	test('Blocked items explain the TzTok-Jad requirement', () => {
		expect(tokkulShopBlockedMessage(item('Uncut ruby'), noJad)).toBe(
			"You can't buy Uncut ruby yet. Only TzHaar-Hur-Rin's Ore and Gem Store in Mor Ul Rek sells it, and you need to defeat TzTok-Jad to get in. Kill TzTok-Jad once with `/activities fight_caves`, then you can buy Uncut ruby at 1s each."
		);
		expect(tokkulShopBlockedMessage(item('Runite ore'), noJad)).toContain(
			'then you can buy Runite ore at 1 per minute.'
		);
		expect(tokkulShopBlockedMessage(item('Coal'), ironNoJad)).toContain('at 20 per minute.');
		expect(tokkulShopBlockedMessage(item('Uncut dragonstone'), jad)).toBe(
			"The TzHaar shops don't sell Uncut dragonstone. You can only sell it to them."
		);
		expect(tokkulShopBlockedMessage(item('Uncut ruby'), jad)).toBeNull();
		expect(tokkulShopBlockedMessage(item('Uncut emerald'), noJad)).toBeNull();
	});

	test('Slower buys without a Jad kill get a note with the faster time', () => {
		expect(tokkulShopJadNote(item('Uncut emerald'), noJad, 30)).toBe(
			"No TzTok-Jad kill yet, so each Uncut emerald takes 1.5s. After a Jad kill it's 0.75s each, so this trip would take 22 seconds instead of 45 seconds."
		);
		expect(tokkulShopJadNote(item('Iron ore'), noJad, 24)).toBe(
			"No TzTok-Jad kill yet, so the shop restocks Iron ore at 2 per minute. After a Jad kill it's 12 per minute, so this trip would take 2 minutes instead of 12 minutes."
		);
		expect(tokkulShopJadNote(item('Uncut emerald'), jad, 30)).toBeNull();
		// Same speed either way: no note.
		expect(tokkulShopJadNote(item('Fire rune'), noJad, 1000)).toBeNull();
		expect(tokkulShopJadNote(item('Uncut onyx'), noJad, 1)).toBeNull();
	});

	test('Karamja diary price notes', () => {
		expect(tokkulShopDiaryNote(item('Uncut emerald'), 'buy', false)).toBe(
			'Finish the Karamja easy diary to pay 65 Tokkul each instead of 75.'
		);
		expect(tokkulShopDiaryNote(item('Uncut emerald'), 'buy', true)).toBe(
			'Karamja diary discount: 65 Tokkul each instead of 75.'
		);
		expect(tokkulShopDiaryNote(item('Uncut emerald'), 'sell', false)).toBe(
			'Finish the Karamja easy diary to get 17 Tokkul each instead of 7.'
		);
		expect(tokkulShopDiaryNote(item('Fire rune'), 'sell', true)).toBeNull();
	});

	test('Too-long trips say the max and why', () => {
		const emerald = item('Uncut emerald');
		const maxTripLength = 30 * Time.Minute;
		const msg = tokkulShopTooLongMessage({
			item: emerald,
			buyer: noJad,
			action: 'buy',
			quantity: 2_000,
			duration: tokkulShopBuyDuration(emerald, noJad, 2_000)!,
			maxTripLength,
			maxCanTransact: tokkulShopMaxBuyable(emerald, noJad, maxTripLength)
		});
		expect(msg).toBe(
			"That's too many for one trip. Buying 2,000x Uncut emerald would take 50 minutes, but your max trip length is 30 minutes. Each Uncut emerald takes 1.5s to buy. The most you can buy in one trip is 1,200. After a TzTok-Jad kill you could buy up to 2,400 per trip."
		);
		const iron = item('Iron ore');
		expect(
			tokkulShopTooLongMessage({
				item: iron,
				buyer: jad,
				action: 'buy',
				quantity: 500,
				duration: tokkulShopBuyDuration(iron, jad, 500)!,
				maxTripLength,
				maxCanTransact: tokkulShopMaxBuyable(iron, jad, maxTripLength)
			})
		).toContain('The shop only restocks 12 Iron ore per minute. The most you can buy in one trip is 360.');
	});

	test('Daily cap message uses the item name, not the internal limit key', () => {
		expect(
			formatBuyDailyLimitMessage({
				name: 'Uncut emerald',
				requested: 500,
				dailyLimit: 3_000,
				remaining: 200,
				resetAtSeconds: 1_800_000_000
			})
		).toBe(
			'You can only buy 3,000x Uncut emerald per day. You tried to buy 500, but you have 200 left today. You can buy more <t:1800000000:R>.'
		);
	});
});
