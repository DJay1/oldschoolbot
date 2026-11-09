import { Bank } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { gambleCommand } from '../../../src/mahoji/commands/gamble.js';
import { DICE_PLAYER_WIN_MIN_ROLL } from '../../../src/mahoji/lib/abstracted_commands/diceCommand.js';
import { mockClient, mockMathRandom } from '../util.js';

describe('Dice Command', async () => {
	test('house edge is 48% player win (roll >= 52 of 0-99)', () => {
		expect(DICE_PLAYER_WIN_MIN_ROLL).toBe(52);
		const playerWins = 100 - DICE_PLAYER_WIN_MIN_ROLL;
		expect(playerWins).toBe(48);
	});

	test('Lose dice', async () => {
		const client = await mockClient();
		const user = await client.mockUser();
		await user.addItemsToBank({ items: new Bank().add('Coins', 100_000_000) });

		await user.gpMatch(100_000_000);
		const unmock = mockMathRandom(0.1);

		const result = await user.runCommand(gambleCommand, { dice: { amount: '100m' } });
		expect(result).toEqual('TestUser rolled **10** on the percentile dice, and you lost -100m GP.');
		await user.gpMatch(0);
		await user.statsMatch('dice_losses', 1);
		await user.statsMatch('gp_dice', BigInt(-100_000_000));
		await client.expectValueMatch('gp_dice', BigInt(-100_000_000));
		unmock();
	});

	test('Won dice', async () => {
		const client = await mockClient();
		const user = await client.mockUser();
		await user.addItemsToBank({ items: new Bank().add('Coins', 100_000_000) });

		const unmock = mockMathRandom(0.9);
		await user.gpMatch(100_000_000);
		const result = await user.runCommand(gambleCommand, { dice: { amount: '100m' } });
		expect(result).toEqual('TestUser rolled **90** on the percentile dice, and you won 100m GP.');
		await user.gpMatch(200_000_000);
		await user.statsMatch('dice_wins', 1);
		await user.statsMatch('gp_dice', BigInt(100_000_000));
		await client.expectValueMatch('gp_dice', BigInt(100_000_000));
		unmock();
	});
});
