import { Bank } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { isPrivateCommandUse } from '@/discord/interactionHandler.js';
import { thanksgivingStatus } from '@/lib/events/thanksgiving/offer.js';
import { thanksgivingCommand } from '@/mahoji/commands/thanksgiving.js';

const DISCORD_CONTENT_LIMIT = 2000;

function makeUser() {
	const empty = new Bank();
	return {
		id: '1',
		bank: empty,
		cl: empty,
		allItemsOwned: empty,
		fetchStats: async () => ({ openable_scores: {} })
	};
}

describe('/thanksgiving status is a hidden reply', () => {
	test('only the status subcommand defers privately, and offer and harvest stay public', () => {
		expect(thanksgivingCommand.privateSubcommands).toEqual(['status']);
		expect(isPrivateCommandUse(thanksgivingCommand, [{ name: 'status' }])).toBe(true);
		expect(isPrivateCommandUse(thanksgivingCommand, [{ name: 'offer' }])).toBe(false);
		expect(isPrivateCommandUse(thanksgivingCommand, [{ name: 'harvest' }])).toBe(false);
		expect(isPrivateCommandUse(thanksgivingCommand, undefined)).toBe(false);
	});

	test('the status reply is ephemeral and stays under the Discord length limit', async () => {
		const result = await thanksgivingStatus(makeUser() as never);
		expect(result).toEqual(expect.objectContaining({ ephemeral: true }));
		expect(typeof result.content).toBe('string');
		expect(result.content.length).toBeGreaterThan(0);
		expect(result.content.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - 150);
	});
});
