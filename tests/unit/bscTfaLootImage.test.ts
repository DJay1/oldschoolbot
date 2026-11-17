import '../../src/lib/util/clientSettings.js';

import { Bank } from 'oldschooljs';
import { SeedableRNG } from 'node-rng';
import { describe, expect, test } from 'vitest';

import { rollTfaTripLoot, tfaShouldShowLootImage } from '@/lib/bsc/tfa/tfaActivity.js';
import { TfaItem } from '@/lib/bsc/tfa/tfaItems.js';
import { bankImageTask } from '@/lib/canvas/bankImage.js';
import { chestCanvasHeight, chestLootTypes, drawChestLootImage } from '@/lib/canvas/chestImage.js';
import { mockMUser } from './userutil.js';

const raid = (n: number) => ({ b: [1, 2, 4, 6, 8], w: null, u: Array.from({ length: n }, () => ({ d: [], p: 100 })) });
const pngHeight = (buf: Buffer) => buf.readUInt32BE(20);
const tfaType = chestLootTypes.find(t => t.title === 'The Fractured Archive')!;

function soloFlappyTrip(seed: number, raids = 3) {
	return rollTfaTripLoot({
		userIDs: ['a'],
		raids: Array.from({ length: raids }, () => raid(1)),
		ownsFolio: {},
		fragmentsObtained: {},
		petOdds: 3,
		flappy: { a: true },
		rng: new SeedableRNG(seed)
	}).loot;
}

describe('TFA loot image', async () => {
	await bankImageTask.ready;

	test('shows for solo Flappy multi-raid trips, even with more than 6 items', () => {
		let sawBig = false;
		for (let seed = 1; seed <= 20; seed++) {
			const loot = soloFlappyTrip(seed);
			if (loot.get('a').length > 6) sawBig = true;
			expect(tfaShouldShowLootImage({ completed: 3, lootPerUser: [loot.get('a')] })).toBe(true);
		}
		expect(sawBig).toBe(true);
	});

	test('rules: needs a completed raid, some loot, and at most 3 players', () => {
		const some = new Bank().add('Coins', 1);
		expect(tfaShouldShowLootImage({ completed: 0, lootPerUser: [some] })).toBe(false);
		expect(tfaShouldShowLootImage({ completed: 1, lootPerUser: [new Bank()] })).toBe(false);
		expect(tfaShouldShowLootImage({ completed: 1, lootPerUser: [some, new Bank(), new Bank()] })).toBe(true);
		expect(tfaShouldShowLootImage({ completed: 1, lootPerUser: [some, some, some, some] })).toBe(false);
	});

	test('panel grows with the item count; other raids keep their fixed size', () => {
		expect(chestCanvasHeight(tfaType, 6)).toBe(tfaType.height);
		expect(chestCanvasHeight(tfaType, 7)).toBeGreaterThan(tfaType.height);
		const cox = chestLootTypes.find(t => t.title !== 'The Fractured Archive')!;
		expect(chestCanvasHeight(cox, 20)).toBe(cox.height);
	});

	test('renders a taller image for a big Flappy trip, solo and team', async () => {
		const user = mockMUser();
		const big = soloFlappyTrip(5, 10).get('a').add(TfaItem.OBLIGATOR);
		expect(big.length).toBeGreaterThan(6);
		const solo = await drawChestLootImage({
			entries: [{ loot: big, user, previousCL: new Bank(), customTexts: [] }],
			type: 'The Fractured Archive'
		});
		expect(solo.name.startsWith('SPOILER_')).toBe(true);
		expect(pngHeight(solo.buffer)).toBe(chestCanvasHeight(tfaType, big.length));
		const team = await drawChestLootImage({
			entries: [
				{ loot: big, user, previousCL: new Bank(), customTexts: [] },
				{ loot: new Bank().add('Coins', 5), user: mockMUser(), previousCL: new Bank(), customTexts: [] }
			],
			type: 'The Fractured Archive'
		});
		expect(pngHeight(team.buffer)).toBe(chestCanvasHeight(tfaType, big.length));
	});
});