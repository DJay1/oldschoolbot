import { Bank } from 'oldschooljs';
import { describe, expect, test, vi } from 'vitest';

import { MAX_XP } from '@/lib/constants.js';
import { LAMP_MAX_PER_USE, lampCommand } from '@/mahoji/lib/abstracted_commands/lampCommand.js';
import { mockMUser } from './userutil.js';

function lampUser(lamps: number, magicXp = 0) {
	const user = mockMUser({ bank: new Bank().add('Large lamp', lamps), skills_magic: magicXp });
	const removed: Bank[] = [];
	const xp: { amount: number; multiplier?: boolean; artificial?: boolean }[] = [];
	Object.assign(user, {
		fetchStats: vi.fn(async () => ({ lamped_xp: {} })),
		statsUpdate: vi.fn(async () => {}),
		removeItemsFromBank: vi.fn(async (b: Bank) => {
			removed.push(b);
		}),
		addXP: vi.fn(async (p: { amount: number; multiplier?: boolean; artificial?: boolean }) => {
			xp.push(p);
			return '';
		})
	});
	return { user, removed, xp };
}

describe('lamps: all', () => {
	test('uses every lamp owned, once, with no XP multiplier', async () => {
		const { user, removed, xp } = lampUser(7);
		await lampCommand(user, 'Large lamp', 'magic', undefined, true);
		expect(removed).toHaveLength(1);
		expect(removed[0].amount('Large lamp')).toBe(7);
		expect(xp).toHaveLength(1);
		expect(xp[0].amount).toBe(7_000_000);
		expect(xp[0].multiplier).toBe(false);
		expect(xp[0].artificial).toBe(true);
	});

	test('capped per use, and the quantity option still works', async () => {
		const big = lampUser(LAMP_MAX_PER_USE + 50);
		await lampCommand(big.user, 'Large lamp', 'magic', undefined, true);
		expect(big.removed[0].amount('Large lamp')).toBe(LAMP_MAX_PER_USE);
		const some = lampUser(10);
		await lampCommand(some.user, 'Large lamp', 'magic', 3);
		expect(some.removed[0].amount('Large lamp')).toBe(3);
	});

	test("doesn't burn lamps past max XP, and refuses at max", async () => {
		const near = lampUser(50, MAX_XP - 2_500_000);
		await lampCommand(near.user, 'Large lamp', 'magic', undefined, true);
		expect(near.removed[0].amount('Large lamp')).toBe(3);
		const maxed = lampUser(5, MAX_XP);
		const res = await lampCommand(maxed.user, 'Large lamp', 'magic', undefined, true);
		expect(String(res)).toContain('already have');
		expect(maxed.removed).toHaveLength(0);
	});

	test('none owned', async () => {
		const { user, removed } = lampUser(0);
		expect(String(await lampCommand(user, 'Large lamp', 'magic', undefined, true))).toContain("don't have any");
		expect(removed).toHaveLength(0);
	});
});
