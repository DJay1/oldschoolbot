import { Items } from 'oldschooljs';
import { expect, test } from 'vitest';

import { CORGO_PARTY_HAT_EXAMINE, LaunchItem } from '@/lib/events/launch/items.js';
import {
	CORGO_PARTY_HAT_PITY,
	LAUNCH_BOX_MYSTERY_BOXES,
	LAUNCH_BOX_POTIONS,
	openLaunchBoxes,
	rareRoll,
	type LaunchBoxRng
} from '@/lib/events/launch/launchBox.js';

const worst: LaunchBoxRng = { randInt: (_min, max) => max };
const best: LaunchBoxRng = { randInt: min => min };

test('rare roll closeness is the chance compared with the roll', () => {
	expect(rareRoll(25, 47_619)).toEqual({ got: false, percent: 84 });
	expect(rareRoll(25, 1).got).toBe(true);
});

test('opening a Launch box gives the fixed supplies and skips patron boxes', () => {
	const { bank, message } = openLaunchBoxes({
		quantity: 1,
		boxesOpenedBefore: 0,
		ownsPartyHat: false,
		rng: worst
	});
	for (const box of LAUNCH_BOX_MYSTERY_BOXES) expect(bank.amount(box)).toBe(3);
	expect(bank.amount('Royal mystery box')).toBe(0);
	expect(bank.amount('Beach mystery box')).toBe(0);
	expect(bank.amount('Launch box')).toBe(0);
	expect(bank.amount('Potato with cheese')).toBe(2000);
	for (const [name, qty] of LAUNCH_BOX_POTIONS) expect(bank.amount(name)).toBe(qty);
	expect(bank.amount('Air rune')).toBe(1000);
	expect(bank.amount('Law rune')).toBe(500);
	expect(bank.amount('Small lamp')).toBe(1);
	expect(bank.amount('Average lamp')).toBe(0);
	expect(bank.amount('Large lamp')).toBe(0);
	expect(bank.amount('Huge lamp')).toBe(0);
	expect(bank.amount('Clue scroll (beginner)')).toBe(1);
	expect(bank.amount('Clue scroll (master)')).toBe(1);
	expect(bank.amount('Clue scroll (grandmaster)')).toBe(0);
	expect(bank.amount('Clue scroll (elder)')).toBe(0);
	expect(bank.amount(LaunchItem.CORGO_PARTY_HAT)).toBe(0);
	expect(message).toContain('How close you were:');
	expect(message).toContain('Corgo party hat:');
	expect(message).not.toContain('Corgo party hat: ✅ Got it!');
});

test('the 30th Launch box guarantees a Corgo party hat if you do not have one', () => {
	const missed = openLaunchBoxes({
		quantity: 1,
		boxesOpenedBefore: CORGO_PARTY_HAT_PITY - 2,
		ownsPartyHat: false,
		rng: worst
	});
	expect(missed.bank.amount(LaunchItem.CORGO_PARTY_HAT)).toBe(0);

	const pity = openLaunchBoxes({
		quantity: 1,
		boxesOpenedBefore: CORGO_PARTY_HAT_PITY - 1,
		ownsPartyHat: false,
		rng: worst
	});
	expect(pity.bank.amount(LaunchItem.CORGO_PARTY_HAT)).toBe(1);
	expect(pity.message).toContain('Corgo party hat: ✅ Got it!');

	const alreadyOwns = openLaunchBoxes({
		quantity: 1,
		boxesOpenedBefore: CORGO_PARTY_HAT_PITY - 1,
		ownsPartyHat: true,
		rng: worst
	});
	expect(alreadyOwns.bank.amount(LaunchItem.CORGO_PARTY_HAT)).toBe(0);
});

test('a lucky open can roll the chase items and a dry open of 30 still has one hat', () => {
	const lucky = openLaunchBoxes({ quantity: 1, boxesOpenedBefore: 0, ownsPartyHat: false, rng: best });
	expect(lucky.bank.amount(LaunchItem.CORGO_PARTY_HAT)).toBe(1);
	expect(lucky.bank.amount('Gregoyle')).toBe(1);
	expect(lucky.bank.amount('Kuro')).toBe(1);
	expect(lucky.bank.amount('Flappy')).toBe(1);
	expect(lucky.bank.amount('Spooky graceful hood')).toBe(1);
	expect(lucky.bank.amount('Double loot token')).toBe(1);
	expect(lucky.bank.amount(LaunchItem.DOUBLE_XP_TOKEN)).toBe(1);
	expect(lucky.message).toContain('Spooky graceful: ✅ Got it!');

	const batch = openLaunchBoxes({
		quantity: CORGO_PARTY_HAT_PITY,
		boxesOpenedBefore: 0,
		ownsPartyHat: false,
		rng: worst
	});
	expect(batch.bank.amount(LaunchItem.CORGO_PARTY_HAT)).toBe(1);
	expect(batch.bank.amount('Potato with cheese')).toBe(2000 * CORGO_PARTY_HAT_PITY);
});

test('Corgo party hat is a tradeable head item', () => {
	const hat = Items.getOrThrow('Corgo party hat');
	expect(hat.id).toBe(LaunchItem.CORGO_PARTY_HAT);
	expect(hat.tradeable).toBe(true);
	expect(hat.equipable).toBe(true);
	expect(hat.equipment?.slot).toBe('head');
	expect(hat.customItemData?.examine).toBe(CORGO_PARTY_HAT_EXAMINE);
	expect(Items.getOrThrow('Launch box').id).toBe(74_200);
	expect(Items.getOrThrow('Double XP token').id).toBe(74_202);
});
