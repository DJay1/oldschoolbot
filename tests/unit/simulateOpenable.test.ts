import { MathRNG } from 'node-rng';
import { Bank } from 'oldschooljs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	resetSimulateOpenCooldowns,
	SIMULATE_OPEN_COOLDOWN_MS,
	simulateOpenCooldownLeft
} from '@/lib/bsc/simulateOpenCooldown.js';
import { ThanksgivingItem } from '@/lib/events/thanksgiving/items.js';
import { allOpenables } from '@/lib/openables.js';
import {
	autocompleteSimulatableOpenables,
	DISCORD_CONTENT_LIMIT,
	DISCORD_CONTENT_SAFE,
	findSimulatableOpenable,
	formatSimulateOpenCaption,
	isSimulatableOpenable,
	SIMULATE_OPEN_MAX,
	simulateOpenableLoot,
	stripHiddenEventItems,
	unreleasedEventItemIDs
} from '@/lib/simulation/simulateOpenable.js';
import { mockMUser } from './userutil.js';

describe('simulate openables', () => {
	it('caps quantity at 1,000', () => {
		expect(SIMULATE_OPEN_MAX).toBe(1000);
	});

	it('hides new Straw Hat Harvest items while the event is off', () => {
		const hidden = unreleasedEventItemIDs(0);
		expect(hidden.has(ThanksgivingItem.STRAW_HAT)).toBe(true);
		expect(hidden.has(ThanksgivingItem.BOUNTIFUL_CORNUCOPIA)).toBe(true);
		expect(hidden.has(ThanksgivingItem.CORNUCOPIA_2021)).toBe(false);
	});

	it('strips hidden event items from simulated loot', () => {
		const loot = new Bank().add('Coins', 10).add(ThanksgivingItem.STRAW_HAT, 1);
		const cleaned = stripHiddenEventItems(loot, 0);
		expect(cleaned.amount('Coins')).toBe(10);
		expect(cleaned.amount(ThanksgivingItem.STRAW_HAT)).toBe(0);
	});

	it('does not offer unreleased event openables', () => {
		const fake = {
			...allOpenables[0],
			id: ThanksgivingItem.STRAW_HAT,
			name: 'Straw hat box',
			aliases: ['straw hat box']
		};
		expect(isSimulatableOpenable(fake, 0)).toBe(false);
		expect(findSimulatableOpenable('Straw hat box', 0)).toBeNull();
	});

	it('can simulate already-released boxes including mystery and seasonal boxes', () => {
		const names = ['Tradeables Mystery box', 'Holiday Mystery box', 'Christmas box', 'Crystal chest', 'Launch box'];
		for (const name of names) {
			const openable = findSimulatableOpenable(name);
			expect(openable, name).not.toBeNull();
			expect(isSimulatableOpenable(openable!)).toBe(true);
		}
	});

	it('autocomplete returns at most 25 choices and only simulatable boxes', () => {
		const choices = autocompleteSimulatableOpenables('');
		expect(choices.length).toBeLessThanOrEqual(25);
		for (const choice of choices) {
			expect(choice.name.length).toBeLessThanOrEqual(100);
			expect(findSimulatableOpenable(choice.value)).not.toBeNull();
		}
	});

	it('worst-case caption stays at least 150 under the Discord 2,000 character limit', () => {
		const longestName = 'W'.repeat(100);
		const caption = formatSimulateOpenCaption(longestName, SIMULATE_OPEN_MAX);
		expect(caption.length).toBeLessThanOrEqual(DISCORD_CONTENT_SAFE);
		expect(DISCORD_CONTENT_SAFE).toBe(DISCORD_CONTENT_LIMIT - 150);
		expect(caption).toContain('Nothing was given or taken.');
	});

	it('simulates loot without granting or removing items', async () => {
		const openable = findSimulatableOpenable('Crystal chest');
		expect(openable).not.toBeNull();
		const user = mockMUser({ bank: new Bank().add('Crystal key', 5) });
		const addSpy = vi.spyOn(user, 'addItemsToBank');
		const transactSpy = vi.spyOn(user, 'transactItems');
		const removeSpy = vi.spyOn(user, 'removeItemsFromBank');
		const result = await simulateOpenableLoot({
			openable: openable!,
			quantity: 5,
			user,
			rng: MathRNG,
			totalLeaguesPoints: 0
		});
		expect(result.bank.length).toBeGreaterThan(0);
		expect(addSpy).not.toHaveBeenCalled();
		expect(transactSpy).not.toHaveBeenCalled();
		expect(removeSpy).not.toHaveBeenCalled();
		expect(user.bank.amount('Crystal key')).toBe(5);
	});
});

describe('simulate open cooldown', () => {
	afterEach(() => {
		resetSimulateOpenCooldowns();
	});

	it('starts a cooldown only after a successful check, and blocked retries do not reset it', () => {
		const now = 1_000_000;
		expect(simulateOpenCooldownLeft('user-a', now)).toBe(0);
		expect(simulateOpenCooldownLeft('user-a', now + 1_000)).toBe(SIMULATE_OPEN_COOLDOWN_MS - 1_000);
		expect(simulateOpenCooldownLeft('user-a', now + SIMULATE_OPEN_COOLDOWN_MS)).toBe(0);
	});
});
