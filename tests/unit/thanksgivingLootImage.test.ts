import { Bank } from 'oldschooljs';
import { describe, expect, test, vi } from 'vitest';

import { MessageBuilderClass } from '@/discord/MessageBuilder.js';
import { type DrawChestLootImageOptions, rememberChestLootImageSource } from '@/lib/canvas/chestImage.js';
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

function fakeChestRender() {
	return vi.fn(async (opts: DrawChestLootImageOptions) => {
		const file = { name: 'chest.png', buffer: Buffer.from('chest') };
		rememberChestLootImageSource(file, opts);
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

	test('adds no second image when the trip has no loot image; items stay in the message text', async () => {
		const render = fakeRender();
		const chestRender = fakeChestRender();
		const message = new MessageBuilderClass({ content: 'fished' });
		const parts = new Bank().add(ThanksgivingItem.HARVEST_BUNDLE, 2).add(ThanksgivingItem.WICKER_BASKET);
		await showEventItemsInLootImage(message, parts, user, render, chestRender);
		expect(render).not.toHaveBeenCalled();
		expect(chestRender).not.toHaveBeenCalled();
		expect(message.message.files ?? []).toHaveLength(0);
	});

	test('a non-bank, non-chest image is left alone and no second loot image is added', async () => {
		const render = fakeRender();
		const chestRender = fakeChestRender();
		const chat = { name: 'chat.png', buffer: Buffer.from('c') };
		const message = new MessageBuilderClass({ content: 'event' }).addFile(chat);
		await showEventItemsInLootImage(
			message,
			new Bank().add(ThanksgivingItem.HARVEST_BUNDLE),
			user,
			render,
			chestRender
		);
		expect(render).not.toHaveBeenCalled();
		expect(chestRender).not.toHaveBeenCalled();
		expect(message.message.files).toHaveLength(1);
		expect(message.message.files![0]).toBe(chat);
	});

	test('redraws a pending chest loot image with the event items on the matching user panel', async () => {
		const loot = new Bank().add('Snape grass', 8);
		const otherLoot = new Bank().add('Bones', 2);
		const other = { id: '2' } as any;
		const message = new MessageBuilderClass({ content: 'raid' });
		const opts: DrawChestLootImageOptions = {
			type: 'The Fractured Archive',
			entries: [
				{ loot, user, previousCL: new Bank(), customTexts: [] },
				{ loot: otherLoot, user: other, previousCL: new Bank(), customTexts: [] }
			]
		};
		(message as any).chestLootImageOptions = opts;
		const pending = { name: 'chest.png', buffer: Buffer.from('old') };
		(message as any).chestLootImagePromise = Promise.resolve(pending);
		const chestRender = fakeChestRender();
		const parts = new Bank().add(ThanksgivingItem.HARVEST_BUNDLE, 5).add(ThanksgivingItem.WICKER_BASKET);
		await showEventItemsInLootImage(message, parts, user, fakeRender(), chestRender);

		expect(chestRender).toHaveBeenCalledTimes(1);
		const drawn = chestRender.mock.calls[0][0] as DrawChestLootImageOptions;
		expect(drawn.entries[0].loot.amount(ThanksgivingItem.HARVEST_BUNDLE)).toBe(5);
		expect(drawn.entries[0].loot.amount(ThanksgivingItem.WICKER_BASKET)).toBe(1);
		expect(drawn.entries[0].loot.amount('Snape grass')).toBe(8);
		expect(drawn.entries[1].loot.amount(ThanksgivingItem.HARVEST_BUNDLE)).toBe(0);
		expect(drawn.entries[1].loot.equals(otherLoot)).toBe(true);
		// Display only: the chests' original loot banks are not mutated, so items are not credited twice.
		expect(loot.amount(ThanksgivingItem.HARVEST_BUNDLE)).toBe(0);
		expect(otherLoot.amount(ThanksgivingItem.HARVEST_BUNDLE)).toBe(0);
		const built = (await message.build()) as { files?: any[] };
		expect(built.files).toHaveLength(1);
	});

	test('redraws a chest loot image already attached as a file', async () => {
		const loot = new Bank().add('Coins', 10);
		const original = { name: 'chest.png', buffer: Buffer.from('old') };
		rememberChestLootImageSource(original, {
			type: 'The Fractured Archive',
			entries: [{ loot, user, previousCL: new Bank(), customTexts: [] }]
		});
		const message = new MessageBuilderClass({ content: 'raid' }).addFile(original);
		const chestRender = fakeChestRender();
		await showEventItemsInLootImage(
			message,
			new Bank().add(ThanksgivingItem.WICKER_BASKET),
			user,
			fakeRender(),
			chestRender
		);
		expect(chestRender).toHaveBeenCalledTimes(1);
		expect(message.message.files).toHaveLength(1);
		expect(loot.amount(ThanksgivingItem.WICKER_BASKET)).toBe(0);
	});

	test('nothing happens for an empty bank', async () => {
		const render = fakeRender();
		const message = new MessageBuilderClass({ content: 'x' });
		expect(await message.addItemsToBankImage(new Bank(), render)).toBe(false);
		expect(render).not.toHaveBeenCalled();
	});
});
