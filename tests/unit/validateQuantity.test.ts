import { Bank } from 'oldschooljs';
import { describe, expect, test, vi } from 'vitest';

import { QuestID } from '@/lib/minions/data/quests.js';
import {
	MAX_INT32,
	MAX_QUANTITY,
	prepareNumericUpdate,
	requirePositiveQuantity,
	safePositiveProduct,
	validateQuantity
} from '@/lib/util/validateQuantity.js';
import { buyFossilIslandNotes } from '@/mahoji/lib/abstracted_commands/buyFossilIslandNotes.js';
import { buyingTripCommand } from '@/mahoji/lib/abstracted_commands/buyingTripCommand.js';
import { barbAssaultBuyCommand } from '@/mahoji/lib/abstracted_commands/barbAssault.js';
import { valeTotemsBuyCommand } from '@/mahoji/lib/abstracted_commands/valeTotemsCommand.js';
import { tripBuyables } from '@/lib/data/buyables/tripBuyables.js';
import { mahojiParseNumber } from '@/mahoji/mahojiSettings.js';

const invalidNumbers = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, -1, 1.5, 1.0000001];

describe('validateQuantity', () => {
	test('accepts positive integers inside the range', () => {
		expect(validateQuantity(1)).toEqual({ ok: true, value: 1 });
		expect(validateQuantity('5k')).toEqual({ ok: true, value: 5000 });
		expect(validateQuantity('2.5b', { max: Number.MAX_SAFE_INTEGER })).toEqual({
			ok: true,
			value: 2_500_000_000
		});
		expect(requirePositiveQuantity(undefined, { fallback: 1 })).toEqual({ ok: true, value: 1 });
	});

	test('rejects values that are not positive whole numbers', () => {
		for (const value of invalidNumbers) {
			expect(validateQuantity(value).ok).toBe(false);
		}
		expect(validateQuantity('-500').ok).toBe(false);
		expect(validateQuantity(MAX_INT32 + 1, { max: MAX_INT32 }).ok).toBe(false);
	});

	test('rejects products that overflow the supported range', () => {
		expect(safePositiveProduct(20, 1).ok).toBe(true);
		expect(safePositiveProduct(0, 4)).toEqual({ ok: true, value: 0 });
		expect(safePositiveProduct(20, -1).ok).toBe(false);
		expect(safePositiveProduct(1_500_000, 2_000).ok).toBe(false);
	});

	test('rejects a negative balance removal before any write is described', () => {
		expect(() => prepareNumericUpdate({ honour_points: { decrement: -1 } })).toThrow(/positive whole number/);
		expect(() => prepareNumericUpdate({ vale_research_points: { decrement: Number.NaN } })).toThrow(
			/positive whole number/
		);
		const prepared = prepareNumericUpdate({
			GP: { increment: -50 },
			bank: { 995: 1 }
		});
		expect(prepared.decrements).toEqual([{ field: 'GP', amount: 50n }]);
		expect(prepared.rest).toEqual({ bank: { 995: 1 } });
	});
});

describe('shop purchases reject invalid quantities before writing', () => {
	test('vale totems buy', async () => {
		const statsUpdate = vi.fn();
		const transactItems = vi.fn();
		const confirmation = vi.fn();
		const user = {
			user: { finished_quest_ids: [QuestID.ChildrenOfTheSun] },
			minionName: 'Minion',
			fetchStats: vi.fn(async () => ({ vale_research_points: 100 })),
			statsUpdate,
			transactItems
		};
		for (const quantity of [-50_000, 0, Number.NaN, Number.POSITIVE_INFINITY]) {
			const result = await valeTotemsBuyCommand({ confirmation } as never, user as never, 'Ent branch', quantity);
			expect(result).toEqual(expect.stringMatching(/whole number|at least|too large/i));
		}
		expect(statsUpdate).not.toHaveBeenCalled();
		expect(transactItems).not.toHaveBeenCalled();
		expect(confirmation).not.toHaveBeenCalled();
	});

	test('barbarian assault buy', async () => {
		const statsUpdate = vi.fn();
		const addItemsToBank = vi.fn();
		const transactItems = vi.fn();
		const confirmation = vi.fn();
		const user = {
			minionName: 'Minion',
			fetchStats: vi.fn(),
			statsUpdate,
			addItemsToBank,
			transactItems
		};
		const result = await barbAssaultBuyCommand(
			{ confirmation } as never,
			user as never,
			'Fighter torso',
			-1_000_000
		);
		expect(result).toEqual(expect.stringMatching(/whole number|at least/i));
		expect(statsUpdate).not.toHaveBeenCalled();
		expect(addItemsToBank).not.toHaveBeenCalled();
		expect(transactItems).not.toHaveBeenCalled();
		expect(confirmation).not.toHaveBeenCalled();
	});

	test('/buy quantity parser rejects zero, negatives, and non-integers', () => {
		for (const quantity of ['-1', '-50000', '0', 'abc']) {
			expect(mahojiParseNumber({ input: quantity, min: 1, max: MAX_QUANTITY })).toBeNull();
		}
		expect(mahojiParseNumber({ input: '2', min: 1, max: MAX_QUANTITY })).toBe(2);
		expect(mahojiParseNumber({ input: '5k', min: 1, max: MAX_QUANTITY })).toBe(5000);
	});

	test('instant /buy shop path rejects invalid quantities before charging', async () => {
		const transactItems = vi.fn();
		const owns = vi.fn();
		const confirmation = vi.fn();
		const user = { owns, transactItems, calcMaxTripLength: vi.fn() };
		const buyable = tripBuyables[0];
		for (const quantity of [-50_000, 0, Number.NaN, Number.POSITIVE_INFINITY, 1.5]) {
			const result = await buyingTripCommand(user as never, buyable, quantity, { confirmation } as never);
			expect(result).toEqual(expect.stringMatching(/whole number|at least|too large/i));
		}
		expect(owns).not.toHaveBeenCalled();
		expect(transactItems).not.toHaveBeenCalled();
		expect(confirmation).not.toHaveBeenCalled();
		expect(user.calcMaxTripLength).not.toHaveBeenCalled();
	});

	test('Fossil Island Notes /buy rejects invalid quantities before charging', async () => {
		const transactItems = vi.fn();
		const owns = vi.fn();
		const confirmation = vi.fn();
		const user = { QP: 100, cl: new Bank(), transactItems, owns };
		for (const quantity of [-50_000, 0, Number.NaN, Number.POSITIVE_INFINITY, 1.5]) {
			const result = await buyFossilIslandNotes(
				{ user, rng: {}, confirmation } as never,
				quantity
			);
			expect(result).toEqual(expect.stringMatching(/whole number|at least|too large/i));
		}
		expect(owns).not.toHaveBeenCalled();
		expect(transactItems).not.toHaveBeenCalled();
		expect(confirmation).not.toHaveBeenCalled();
	});
});

describe('Bank.multiply', () => {
	test('rejects multipliers that are not positive integers', () => {
		const bank = new Bank().add('Coal', 2);
		expect(() => bank.clone().multiply(-1)).toThrow(/invalid quantity/i);
		expect(() => bank.clone().multiply(0)).toThrow(/invalid quantity/i);
		expect(() => bank.clone().multiply(1.5)).toThrow(/invalid quantity/i);
		expect(bank.clone().multiply(3).amount('Coal')).toBe(6);
	});
});
