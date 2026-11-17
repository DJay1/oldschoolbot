import { Bank } from 'oldschooljs';
import { describe, expect, test, vi } from 'vitest';

import { MessageBuilderClass } from '@/discord/MessageBuilder.js';
import { ThanksgivingItem } from '@/lib/events/thanksgiving/items.js';
import { showEventItemsInLootImage } from '@/lib/util/handleTripFinish.js';
import { bankImageSource, type MakeBankImageOptions, rememberBankImageSource } from '@/lib/util/makeBankImage.js';

function fakeRender() {
	return vi.fn(async (opts: MakeBankImageOptions) => {
		const file = { name: 'bank.png', buffer: Buffer.from('img') };
		rememberBankImageSource(file, opts);
		return file;
	});
}

const user = { id: '1' } as any;

describe('Straw Hat Harvest items in the trip loot image', () => {
	test('redraws the existing loot image with the event items, keeping title and previous CL', async () => {
		const loot = new Bank().add('Coins', 100).add('Bones', 2);
		const previousCL = new Bank().add('Bones');
		const original = { name: 'bank.png', buffer: Buffer.from('old') };
		rememberBankImageSource(original, { bank: loot, title: 'Loot From 2 Man:', previousCL, user });
		const message = new MessageBuilderClass({ content: 'done' }).addFile(original);
		const parts = new Bank().add(ThanksgivingItem.HARVEST_BUNDLE, 3);
		const render = fakeRender();

		await showEventItemsInLootImage(message, parts, user, render);

		expect(render).toHaveBeenCalledTimes(1);
		expect(message.message.files).toHaveLength(1);
		const drawn = bankImageSource(message.message.files![0])!;
		expect(drawn.title).toBe('Loot From 2 Man:');
		expect(drawn.previousCL).toBe(previousCL);
		expect(drawn.bank.amount(ThanksgivingItem.HARVEST_BUNDLE)).toBe(3);
		expect(drawn.bank.amount('Coins')).toBe(100);
		// The task's own loot bank is never changed (display only, nothing added twice).
		expect(loot.amount(ThanksgivingItem.HARVEST_BUNDLE)).toBe(0);
		expect(bankImageSource(original)!.bank.amount(ThanksgivingItem.HARVEST_BUNDLE)).toBe(0);
	});

	test('redraws a pending addBankImage image too', async () => {
		const render = fakeRender();
		const message = new MessageBuilderClass({ content: 'done' });
		const pending = { name: 'bank.png', buffer: Buffer.from('p') };
		rememberBankImageSource(pending, { bank: new Bank().add('Bones'), title: 'Loot' });
		(message as any).bankImagePromise = Promise.resolve(pending);
		const added = await message.addItemsToBankImage(new Bank().add(ThanksgivingItem.WICKER_BASKET), render);
		expect(added).toBe(true);
		const built = (await message.build()) as { files?: any[] };
		expect(built.files).toHaveLength(1);
		expect(bankImageSource(built.files![0])!.bank.amount(ThanksgivingItem.WICKER_BASKET)).toBe(1);
	});

	test('adds a small Straw Hat Harvest image when the trip has no bank image', async () => {
		const render = fakeRender();
		const message = new MessageBuilderClass({ content: 'fished' });
		const parts = new Bank().add(ThanksgivingItem.HARVEST_BUNDLE, 2).add(ThanksgivingItem.WICKER_BASKET);
		await showEventItemsInLootImage(message, parts, user, render);
		expect(message.message.files).toHaveLength(1);
		const drawn = bankImageSource(message.message.files![0])!;
		expect(drawn.title).toBe('The Straw Hat Harvest');
		expect(drawn.bank.equals(parts)).toBe(true);
	});

	test('a non-bank image (chest or chat head) is left alone and the event image is added next to it', async () => {
		const render = fakeRender();
		const chest = { name: 'chest.png', buffer: Buffer.from('c') };
		const message = new MessageBuilderClass({ content: 'raid' }).addFile(chest);
		await showEventItemsInLootImage(message, new Bank().add(ThanksgivingItem.HARVEST_BUNDLE), user, render);
		expect(message.message.files).toHaveLength(2);
		expect(message.message.files![0]).toBe(chest);
	});

	test('nothing happens for an empty bank', async () => {
		const render = fakeRender();
		const message = new MessageBuilderClass({ content: 'x' });
		expect(await message.addItemsToBankImage(new Bank(), render)).toBe(false);
		expect(render).not.toHaveBeenCalled();
	});
});
