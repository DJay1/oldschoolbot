import { Bank } from 'oldschooljs';
import { describe, expect, test, vi } from 'vitest';

import { MessageBuilderClass } from '@/discord/MessageBuilder.js';
import { type DrawChestLootImageOptions, rememberChestLootImageSource } from '@/lib/canvas/chestImage.js';
import { THANKSGIVING_MIN_TRIP_MS } from '@/lib/events/thanksgiving/core.js';
import { creditHarvestPartsToExtraMembers, formatPartyHarvestFinds } from '@/lib/events/thanksgiving/harvestParty.js';
import { ThanksgivingItem } from '@/lib/events/thanksgiving/items.js';
import { GROUP_TRIP_MAX_MEMBERS, groupTripExtraMemberIDs } from '@/lib/util/groupTripMembers.js';
import { showEventItemsInLootImage } from '@/lib/util/handleTripFinish.js';
import { type MakeBankImageOptions, rememberBankImageSource } from '@/lib/util/makeBankImage.js';

const neverRng = { randInt: (_min: number, max: number) => max };
const HOUR = 60 * 60_000;
const DISCORD_CONTENT_LIMIT = 2000;
const LENGTH_BUFFER = 150;
const LONGEST_MENTION = `<@${'9'.repeat(20)}>`;

function mockMember(id: string) {
	const transactItems = vi.fn(async ({ itemsToAdd }: { itemsToAdd: Bank }) => ({ itemsAdded: itemsToAdd }));
	return {
		id,
		usernameOrMention: `<@${id}>`,
		bank: new Bank(),
		transactItems
	};
}

function fakeChestRender() {
	return vi.fn(async (opts: DrawChestLootImageOptions) => {
		const file = { name: 'chest.png', buffer: Buffer.from('chest') };
		rememberChestLootImageSource(file, opts);
		return file;
	});
}

function fakeBankRender() {
	return vi.fn(async (opts: MakeBankImageOptions) => {
		const file = { name: 'bank.png', buffer: Buffer.from('img') };
		rememberBankImageSource(file, opts);
		return file;
	});
}

describe('group trip extra members', () => {
	test('everyone but the roller, once each', () => {
		expect(groupTripExtraMemberIDs({ users: ['1', '2', '3'] }, '1')).toEqual(['2', '3']);
		expect(groupTripExtraMemberIDs({ users: ['1', '2', '2', '1', '3'] }, '1')).toEqual(['2', '3']);
		expect(groupTripExtraMemberIDs({ users: ['1'] }, '1')).toEqual([]);
		expect(groupTripExtraMemberIDs({}, '1')).toEqual([]);
		expect(groupTripExtraMemberIDs({ users: 'nope' }, '1')).toEqual([]);
	});
});

describe('party harvest credit', () => {
	test('credits each extra member once and never the leader', async () => {
		const leader = mockMember('leader');
		const alice = mockMember('alice');
		const bob = mockMember('bob');
		const members: Record<string, ReturnType<typeof mockMember>> = { alice, bob, leader };
		const result = await creditHarvestPartsToExtraMembers({
			data: { users: ['leader', 'alice', 'bob', 'alice'] },
			leaderID: 'leader',
			durationMs: HOUR,
			doubleLoot: false,
			rng: neverRng,
			fetchUser: async id => members[id] as any
		});

		expect(leader.transactItems).not.toHaveBeenCalled();
		expect(alice.transactItems).toHaveBeenCalledTimes(1);
		expect(bob.transactItems).toHaveBeenCalledTimes(1);
		expect((alice.transactItems.mock.calls[0][0] as { collectionLog?: boolean }).collectionLog).toBe(true);
		const aliceLoot: Bank = alice.transactItems.mock.calls[0][0].itemsToAdd;
		const bobLoot: Bank = bob.transactItems.mock.calls[0][0].itemsToAdd;
		expect(aliceLoot.length).toBeGreaterThan(0);
		expect(bobLoot.length).toBeGreaterThan(0);
		expect(result.imageItems).toEqual([
			{ userId: 'alice', items: aliceLoot },
			{ userId: 'bob', items: bobLoot }
		]);
		expect(result.messages).toHaveLength(1);
		expect(result.messages[0]).toContain('<@alice> gathered');
		expect(result.messages[0]).toContain('<@bob> gathered');
		expect(result.messages[0]).not.toContain('<@leader>');
		expect(result.messages[0]).toContain('for The Straw Hat Harvest.');
	});

	test('trips under 10 minutes credit nobody', async () => {
		const alice = mockMember('alice');
		const result = await creditHarvestPartsToExtraMembers({
			data: { users: ['leader', 'alice'] },
			leaderID: 'leader',
			durationMs: THANKSGIVING_MIN_TRIP_MS - 1,
			doubleLoot: false,
			rng: neverRng,
			fetchUser: async () => alice as any
		});
		expect(alice.transactItems).not.toHaveBeenCalled();
		expect(result.imageItems).toEqual([]);
		expect(result.messages).toEqual([]);
	});

	test('a failed member transact is skipped and does not block the others', async () => {
		const logError = vi.spyOn(Logging, 'logError').mockImplementation(() => undefined);
		const alice = mockMember('alice');
		const bob = mockMember('bob');
		alice.transactItems.mockRejectedValueOnce(new Error('bank locked'));
		const result = await creditHarvestPartsToExtraMembers({
			data: { users: ['leader', 'alice', 'bob'] },
			leaderID: 'leader',
			durationMs: HOUR,
			doubleLoot: false,
			rng: neverRng,
			fetchUser: async id => (id === 'alice' ? alice : bob) as any
		});
		expect(alice.transactItems).toHaveBeenCalledTimes(1);
		expect(bob.transactItems).toHaveBeenCalledTimes(1);
		expect(result.imageItems).toEqual([{ userId: 'bob', items: bob.transactItems.mock.calls[0][0].itemsToAdd }]);
		expect(result.messages[0]).toContain('<@bob> gathered');
		expect(result.messages[0]).not.toContain('<@alice>');
		logError.mockRestore();
	});

	test('Double Loot increases the credited amount', async () => {
		const normal = mockMember('alice');
		const doubled = mockMember('alice');
		await creditHarvestPartsToExtraMembers({
			data: { users: ['leader', 'alice'] },
			leaderID: 'leader',
			durationMs: HOUR,
			doubleLoot: false,
			rng: neverRng,
			fetchUser: async () => normal as any
		});
		await creditHarvestPartsToExtraMembers({
			data: { users: ['leader', 'alice'] },
			leaderID: 'leader',
			durationMs: HOUR,
			doubleLoot: true,
			rng: neverRng,
			fetchUser: async () => doubled as any
		});
		const a: Bank = normal.transactItems.mock.calls[0][0].itemsToAdd;
		const b: Bank = doubled.transactItems.mock.calls[0][0].itemsToAdd;
		expect(b.amount(ThanksgivingItem.HARVEST_BUNDLE)).toBeGreaterThan(a.amount(ThanksgivingItem.HARVEST_BUNDLE));
	});
});

describe('party harvest message length', () => {
	test('the worst-case Messages line for a max party stays 150 under the Discord limit', () => {
		const huge = new Bank()
			.add(ThanksgivingItem.HARVEST_BUNDLE, 999_999_999)
			.add(ThanksgivingItem.WICKER_BASKET, 999_999_999);
		const extraMembers = GROUP_TRIP_MAX_MEMBERS - 1;
		const partyLine = formatPartyHarvestFinds(
			Array.from({ length: extraMembers }, () => ({ mention: LONGEST_MENTION, parts: huge }))
		)!;
		const leaderLine = `CORN You gathered ${huge} for The Straw Hat Harvest.`.replace('CORN', '\uD83C\uDF3D');
		const appendix = `**Messages:** ${partyLine}, ${leaderLine}`;
		expect(partyLine.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - LENGTH_BUFFER);
		expect(appendix.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - LENGTH_BUFFER);
	});
});

describe('party harvest items in the chest loot image', () => {
	test('adds each member to their own panel and does not add a second image', async () => {
		const leader = { id: 'leader' } as any;
		const alice = { id: 'alice' } as any;
		const leaderLoot = new Bank().add('Snape grass', 8);
		const aliceLoot = new Bank().add('Bones', 2);
		const message = new MessageBuilderClass({ content: 'raid' });
		(message as any).chestLootImageOptions = {
			type: 'The Fractured Archive',
			entries: [
				{ loot: leaderLoot, user: leader, previousCL: new Bank(), customTexts: [] },
				{ loot: aliceLoot, user: alice, previousCL: new Bank(), customTexts: [] }
			]
		};
		(message as any).chestLootImagePromise = Promise.resolve({ name: 'chest.png', buffer: Buffer.from('old') });
		const chestRender = fakeChestRender();
		const leaderParts = new Bank().add(ThanksgivingItem.HARVEST_BUNDLE, 5);
		const aliceParts = new Bank().add(ThanksgivingItem.WICKER_BASKET, 2);
		await showEventItemsInLootImage(message, leaderParts, leader, fakeBankRender(), chestRender, [
			{ userId: 'alice', items: aliceParts }
		]);

		expect(chestRender).toHaveBeenCalledTimes(1);
		const drawn = chestRender.mock.calls[0][0] as DrawChestLootImageOptions;
		expect(drawn.entries[0].loot.amount(ThanksgivingItem.HARVEST_BUNDLE)).toBe(5);
		expect(drawn.entries[1].loot.amount(ThanksgivingItem.WICKER_BASKET)).toBe(2);
		expect(drawn.entries[0].loot.amount(ThanksgivingItem.WICKER_BASKET)).toBe(0);
		expect(drawn.entries[1].loot.amount(ThanksgivingItem.HARVEST_BUNDLE)).toBe(0);
		expect(leaderLoot.amount(ThanksgivingItem.HARVEST_BUNDLE)).toBe(0);
		expect(aliceLoot.amount(ThanksgivingItem.WICKER_BASKET)).toBe(0);
		const built = (await message.build()) as { files?: any[] };
		expect(built.files).toHaveLength(1);
	});
});
