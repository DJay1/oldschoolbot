import { Bank, Items } from 'oldschooljs';
import { describe, expect, test, vi } from 'vitest';

import { feedHammyCommand } from '@/lib/bso/commands/hammyCommand.js';

describe('feed hammy item handling', () => {
	test('does not add items if the original cannot be removed after confirm', async () => {
		const item = Items.getOrThrow('Pineapple');
		const confirmation = vi.fn(async () => undefined);
		const sync = vi.fn(async () => undefined);
		const removeItemsFromBank = vi.fn(async () => {
			throw new Error('Tried to remove items they do not own');
		});
		const addItemsToBank = vi.fn();
		const user = {
			bank: new Bank().add('Hammy').add(item.id),
			sync,
			removeItemsFromBank,
			addItemsToBank
		};

		const result = await feedHammyCommand({ confirmation } as never, user as never, item.name);
		expect(confirmation).toHaveBeenCalledOnce();
		expect(removeItemsFromBank).toHaveBeenCalledOnce();
		expect(addItemsToBank).not.toHaveBeenCalled();
		expect(result).toBe(`You don't have a ${item.name}.`);
	});
});
