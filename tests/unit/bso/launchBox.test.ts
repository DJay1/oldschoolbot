import { Time } from '@oldschoolgg/toolkit';
import { Items } from 'oldschooljs';
import { expect, test } from 'vitest';

import { CORGO_PARTY_HAT_EXAMINE, LaunchItem } from '@/lib/events/launch/items.js';
import {
	CORGO_PARTY_HAT_GUARANTEE_OPENS,
	hasLaunchBoxOpenBadge,
	LAUNCH_BOX_MYSTERY_BOXES,
	LAUNCH_BOX_POTIONS,
	type LaunchBoxRng,
	launchBoxTripChance,
	openLaunchBoxes,
	rareRoll,
	rollLaunchBoxFromTrip
} from '@/lib/events/launch/launchBox.js';

const worst: LaunchBoxRng = { randInt: (_min, max) => max };
const best: LaunchBoxRng = { randInt: min => min };

test('trips under 20 minutes never give a Launch box', () => {
	expect(launchBoxTripChance(Time.Minute * 19, false)).toBe(0);
	expect(rollLaunchBoxFromTrip({ durationMs: Time.Minute * 19, doubleLoot: true, rng: best }).amount).toBe(0);
});

test('expected Launch boxes per trip follow the 20 / 112 minute curve', () => {
	expect(launchBoxTripChance(Time.Minute * 20, false)).toBeCloseTo(20 / 112, 5);
	expect(launchBoxTripChance(Time.Minute * 40, false)).toBeCloseTo(2 ** 1.08 * (20 / 112), 5);
	expect(launchBoxTripChance(Time.Hour, false)).toBeCloseTo(3 ** 1.08 * (20 / 112), 5);
	expect(launchBoxTripChance(Time.Hour, true)).toBeCloseTo(2 * 3 ** 1.08 * (20 / 112), 5);
});

test('long trips can give more than one Launch box', () => {
	const expected = launchBoxTripChance(Time.Hour * 2, false);
	expect(expected).toBeGreaterThan(1);
	expect(rollLaunchBoxFromTrip({ durationMs: Time.Hour * 2, doubleLoot: false, rng: worst }).amount).toBe(
		Math.floor(expected)
	);
	expect(rollLaunchBoxFromTrip({ durationMs: Time.Hour * 2, doubleLoot: false, rng: best }).amount).toBe(
		Math.floor(expected) + 1
	);
});

test('rare roll closeness is the chance compared with the roll', () => {
	expect(rareRoll(25, 4)).toEqual({ got: false, roll: 22, denominator: 25 });
	expect(rareRoll(25, 1).got).toBe(true);
});

test('opening a Launch box gives the fixed supplies and skips patron boxes', () => {
	const { bank, message } = openLaunchBoxes({
		quantity: 1,
		boxesOpenedBefore: 0,
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
	expect(message).toContain('Your best rolls (hit the top number to win):');
	expect(message).toContain('Corgo party hat:');
	expect(message).not.toContain('Corgo party hat: ✅ Got it!');
	expect(message).toContain('Corgo party hat guaranteed drop: 1/100 opens');
	expect(message).not.toContain('pity');
});

test('the 100th Launch box always grants a Corgo party hat', () => {
	const missed = openLaunchBoxes({
		quantity: 1,
		boxesOpenedBefore: CORGO_PARTY_HAT_GUARANTEE_OPENS - 2,
		rng: worst
	});
	expect(missed.bank.amount(LaunchItem.CORGO_PARTY_HAT)).toBe(0);
	expect(missed.message).toContain('Corgo party hat guaranteed drop: 99/100 opens');
	expect(missed.message).not.toContain('received your guaranteed Corgo party hat');

	const guaranteed = openLaunchBoxes({
		quantity: 1,
		boxesOpenedBefore: CORGO_PARTY_HAT_GUARANTEE_OPENS - 1,
		rng: worst
	});
	expect(guaranteed.bank.amount(LaunchItem.CORGO_PARTY_HAT)).toBe(1);
	expect(guaranteed.message).toContain('Corgo party hat: ✅ Got it!');
	expect(guaranteed.message).toContain('You reached 100 opens and received your guaranteed Corgo party hat!');
	expect(guaranteed.message).not.toContain('guaranteed drop:');
	expect(guaranteed.message).not.toContain('pity');
});

test('a lucky 1/75 on the 100th open grants two Corgo party hats', () => {
	const both = openLaunchBoxes({
		quantity: 1,
		boxesOpenedBefore: CORGO_PARTY_HAT_GUARANTEE_OPENS - 1,
		rng: best
	});
	expect(both.bank.amount(LaunchItem.CORGO_PARTY_HAT)).toBe(2);
	expect(both.message).toContain('You reached 100 opens and received your guaranteed Corgo party hat!');
	expect(both.message).not.toContain('guaranteed drop:');
});

test('opens after 100 do not grant another guaranteed Corgo party hat', () => {
	const later = openLaunchBoxes({
		quantity: 1,
		boxesOpenedBefore: CORGO_PARTY_HAT_GUARANTEE_OPENS,
		rng: worst
	});
	expect(later.bank.amount(LaunchItem.CORGO_PARTY_HAT)).toBe(0);
	expect(later.message).not.toContain('guaranteed drop:');
	expect(later.message).not.toContain('received your guaranteed Corgo party hat');
});

test('a lucky open can roll the chase items and a dry batch of 100 still has one hat', () => {
	const lucky = openLaunchBoxes({ quantity: 1, boxesOpenedBefore: 0, rng: best });
	expect(lucky.bank.amount(LaunchItem.CORGO_PARTY_HAT)).toBe(1);
	expect(lucky.bank.amount('Gregoyle')).toBe(1);
	expect(lucky.bank.amount('Kuro')).toBe(1);
	expect(lucky.bank.amount('Flappy')).toBe(1);
	expect(lucky.bank.amount('Spooky graceful hood')).toBe(1);
	expect(lucky.bank.amount('Double loot token')).toBe(1);
	expect(lucky.bank.amount(LaunchItem.DOUBLE_XP_TOKEN)).toBe(1);
	expect(lucky.message).toContain('Spooky piece: ✅ Got it!');
	expect(lucky.message).not.toContain('received your guaranteed Corgo party hat');
	expect(lucky.message).toContain('Corgo party hat guaranteed drop: 1/100 opens');

	const batch = openLaunchBoxes({
		quantity: CORGO_PARTY_HAT_GUARANTEE_OPENS,
		boxesOpenedBefore: 0,
		rng: worst
	});
	expect(batch.bank.amount(LaunchItem.CORGO_PARTY_HAT)).toBe(1);
	expect(batch.bank.amount('Potato with cheese')).toBe(2000 * CORGO_PARTY_HAT_GUARANTEE_OPENS);
	expect(batch.message).toContain('You reached 100 opens and received your guaranteed Corgo party hat!');
	expect(batch.message).not.toContain('guaranteed drop:');
});

test('the Launch box badge unlocks at 100 opens', () => {
	expect(hasLaunchBoxOpenBadge(99)).toBe(false);
	expect(hasLaunchBoxOpenBadge(100)).toBe(true);
	expect(hasLaunchBoxOpenBadge(150)).toBe(true);
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
