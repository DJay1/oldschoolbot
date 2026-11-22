import { Bank, Items } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { BadgesEnum } from '../../../src/lib/badges/badgeEmojis.js';
import { userCanAccessBankBg } from '../../../src/lib/bsc/bankBgAccess.js';
import {
	BUG_HUNTER_PET_ID,
	BUG_HUNTER_PET_NAME,
	formatTesterUnlockProgress,
	milestoneEligibility,
	planShopSpend,
	TESTER_GIFT_COINS,
	TESTER_LAB_BG_ID,
	TESTER_MILESTONES
} from '../../../src/lib/bsc/testerRewards.js';
import { testerGiftTable } from '../../../src/lib/bso/openables/tables.js';
import { BitField } from '../../../src/lib/constants.js';

describe('planShopSpend', () => {
	test('spends tester points first', () => {
		expect(planShopSpend(20, 50, 15)).toEqual({ ok: true, testerSpend: 15, developerSpend: 0 });
	});

	test('uses developer points when tester points are short', () => {
		expect(planShopSpend(10, 20, 15)).toEqual({ ok: true, testerSpend: 10, developerSpend: 5 });
	});

	test('can spend developer points only', () => {
		expect(planShopSpend(0, 50, 15)).toEqual({ ok: true, testerSpend: 0, developerSpend: 15 });
	});

	test('rejects when the combined balance is too low', () => {
		expect(planShopSpend(4, 5, 15)).toEqual({ ok: false });
	});

	test('rejects invalid amounts', () => {
		expect(planShopSpend(10, 10, 0)).toEqual({ ok: false });
		expect(planShopSpend(10, 10, 1.5)).toEqual({ ok: false });
		expect(planShopSpend(-1, 10, 1)).toEqual({ ok: false });
	});
});

describe('tester milestone eligibility', () => {
	test('badge needs both boxes opened and points earned', () => {
		expect(milestoneEligibility(10, 149).badge).toBe(false);
		expect(milestoneEligibility(9, 150).badge).toBe(false);
		expect(milestoneEligibility(10, 150).badge).toBe(true);
	});

	test('cosmetics use lifetime points earned, not boxes opened', () => {
		expect(milestoneEligibility(0, 300).title).toBe(true);
		expect(milestoneEligibility(100, 299).title).toBe(false);
		expect(milestoneEligibility(0, 750).lab).toBe(true);
		expect(milestoneEligibility(0, 1499).pet).toBe(false);
		expect(milestoneEligibility(0, 1500).pet).toBe(true);
	});

	test('thresholds stay in the intended order', () => {
		expect(TESTER_MILESTONES.badgeEarned).toBeLessThan(TESTER_MILESTONES.titleEarned);
		expect(TESTER_MILESTONES.titleEarned).toBeLessThan(TESTER_MILESTONES.labEarned);
		expect(TESTER_MILESTONES.labEarned).toBeLessThan(TESTER_MILESTONES.petEarned);
	});
});

describe('Tester Gift box loot', () => {
	test('is player-tradeable and not a mystery-box drop', () => {
		const item = Items.getOrThrow('Tester Gift Box');
		expect(item.id).toBe(13_345);
		expect(item.tradeable).toBe(true);
		expect(item.tradeable_on_ge).toBe(false);
	});

	test('Bug hunter pet is untradeable and cannot come from mystery boxes', () => {
		const pet = Items.getOrThrow(BUG_HUNTER_PET_NAME);
		expect(pet.id).toBe(BUG_HUNTER_PET_ID);
		expect(pet.customItemData?.isSuperUntradeable).toBe(true);
		expect(pet.customItemData?.cantDropFromMysteryBoxes).toBe(true);
	});

	test('every box rolls boosted coins and never tester cosmetics', () => {
		const banned = new Set([BUG_HUNTER_PET_ID, Items.getOrThrow('Tester Gift Box').id]);
		for (let i = 0; i < 400; i++) {
			const loot = new Bank(testerGiftTable.roll());
			const coins = loot.amount('Coins');
			expect(coins).toBeGreaterThanOrEqual(TESTER_GIFT_COINS.min);
			expect(coins).toBeLessThanOrEqual(TESTER_GIFT_COINS.max);
			for (const id of banned) {
				expect(loot.has(id)).toBe(false);
			}
		}
	});
});

describe('Tester Lab bank background access', () => {
	const lab = {
		id: TESTER_LAB_BG_ID,
		name: 'Tester Lab',
		image: null,
		available: true,
		bitfield: BitField.HasTesterLabBackground
	} as const;

	function user(opts: { admin?: boolean; bits?: number[] }) {
		return {
			id: '1',
			isModOrAdmin: () => Boolean(opts.admin),
			bitfield: opts.bits ?? [],
			user: { store_bitfield: [] }
		} as any;
	}

	test('requires the Tester Lab unlock bit', () => {
		expect(userCanAccessBankBg(user({}), lab as any)).toBe(false);
		expect(userCanAccessBankBg(user({ bits: [BitField.HasTesterLabBackground] }), lab as any)).toBe(true);
	});

	test('mods can still preview it', () => {
		expect(userCanAccessBankBg(user({ admin: true }), lab as any)).toBe(true);
	});
});

describe('badge and bit ids', () => {
	test('Tester badge uses a new id and does not reuse reserved 17', () => {
		expect(BadgesEnum.Tester).toBe(19);
		expect(BadgesEnum.Tester).not.toBe(17);
		expect(BadgesEnum.Developer).toBe(0);
	});
});

describe('Discord length', () => {
	test('worst-case /testershop balance stays under the 2000 character limit', () => {
		const progress = {
			boxesOpened: 999_999,
			earnedTotal: 999_999,
			hasBadge: false,
			hasTitle: false,
			hasLab: false,
			hasPet: false
		};
		const unlocks = formatTesterUnlockProgress(progress);
		const longReason = 'R'.repeat(80);
		const recent = Array.from({ length: 5 }, (_, i) => {
			const sign = i % 2 === 0 ? '+' : '-';
			const kind = i % 2 === 0 ? 'tester' : 'dev';
			return `${sign}100000 ${kind} - ${longReason} (<t:2000000000:R>)`;
		});
		const message = [
			'You have **999999** tester points (999999 earned in total) and **999999** developer points.',
			'',
			unlocks,
			'',
			'Your Tester badge is ready to unlock.',
			'You unlocked the Tester badge.',
			'You unlocked the title the Bug Hunter.',
			'You unlocked the Tester Lab bank background. Set it with `/minion bankbg name:Tester Lab`.',
			'You unlocked the Bug hunter pet.',
			'',
			'**Recent:**',
			...recent
		].join('\n');
		expect(message.length).toBeLessThanOrEqual(2000 - 150);
	});
});
