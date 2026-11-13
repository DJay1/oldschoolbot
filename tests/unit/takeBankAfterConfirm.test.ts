import { Bank, Items } from 'oldschooljs';
import { describe, expect, test, vi } from 'vitest';

import { takeBankAfterConfirm } from '@/lib/util/takeBankAfterConfirm.js';

describe('takeBankAfterConfirm', () => {
	const item = Items.getOrThrow('Pineapple');

	test('fails and does not remove if the items are already gone', async () => {
		const removeItemsFromBank = vi.fn();
		const user = {
			bankWithGP: new Bank(),
			sync: vi.fn(async () => undefined),
			removeItemsFromBank
		};
		const bank = new Bank().add(item.id);
		const result = await takeBankAfterConfirm(user as never, bank);
		expect(result).toEqual({ ok: false, message: "You don't own those items." });
		expect(user.sync).toHaveBeenCalledOnce();
		expect(removeItemsFromBank).not.toHaveBeenCalled();
	});

	test('fails if removal throws because the items were taken after the check', async () => {
		const bank = new Bank().add(item.id);
		const removeItemsFromBank = vi.fn(async () => {
			throw new Error('Tried to remove items they do not own');
		});
		const user = {
			bankWithGP: bank.clone(),
			sync: vi.fn(async () => undefined),
			removeItemsFromBank
		};
		const result = await takeBankAfterConfirm(user as never, bank);
		expect(result).toEqual({ ok: false, message: "You don't own those items." });
		expect(removeItemsFromBank).toHaveBeenCalledOnce();
	});

	test('removes the items when they are still owned', async () => {
		const bank = new Bank().add(item.id);
		const removeItemsFromBank = vi.fn(async () => undefined);
		const user = {
			bankWithGP: bank.clone(),
			sync: vi.fn(async () => undefined),
			removeItemsFromBank
		};
		const result = await takeBankAfterConfirm(user as never, bank);
		expect(result).toEqual({ ok: true });
		expect(removeItemsFromBank).toHaveBeenCalledWith(bank);
	});
});
