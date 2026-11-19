import { Bank } from 'oldschooljs';
import { describe, expect, test, vi, beforeEach } from 'vitest';

import { flowerTable, hotColdCommand } from '@/mahoji/lib/abstracted_commands/hotColdCommand.js';

function makeUser(gp = 3_500_000_000) {
	return {
		id: '573763145198206986',
		isIronman: false,
		GP: gp,
		sync: vi.fn(async () => {}),
		transactItems: vi.fn(async () => {}),
		update: vi.fn(async () => {}),
		statsUpdate: vi.fn(async () => {
			throw new Error('statsUpdate should not be used to decrement gp_hotcold');
		}),
		updateGPTrackSetting: vi.fn(async () => {})
	};
}

function makeInteraction() {
	return { confirmation: vi.fn(async () => {}) };
}

function embedDescription(result: unknown) {
	const maybe = result as { embeds?: Array<{ data?: { description?: string }; description?: string }> };
	const embed = maybe?.embeds?.[0];
	const description = embed?.data?.description ?? embed?.description;
	if (!description) {
		throw new Error(`Expected an embed result, got ${JSON.stringify(result)}`);
	}
	return description;
}

describe('hotColdCommand loss tracking', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(globalThis.ClientSettings, 'update').mockResolvedValue(undefined as never);
	});

	test('a loss still shows the result when the player has no gp_hotcold profit yet', async () => {
		vi.spyOn(flowerTable, 'roll').mockReturnValue(new Bank().add('Blue flowers') as never);
		const user = makeUser();
		const interaction = makeInteraction();

		const result = await hotColdCommand(interaction as never, user as never, 'hot', '2.5b');

		expect(embedDescription(result)).toBe('You lost 2.5b.');
		expect(user.transactItems).toHaveBeenCalledTimes(1);
		expect(user.update).toHaveBeenCalledWith({ GP: { decrement: 2_500_000_000 } });
		expect(user.updateGPTrackSetting).toHaveBeenCalledWith('gp_hotcold', -2_500_000_000);
		expect(user.statsUpdate).not.toHaveBeenCalled();
		expect(globalThis.ClientSettings.update).toHaveBeenCalledWith({
			gp_hotcold: { decrement: 2_500_000_000 }
		});
	});

	test('a loss result is still returned if bookkeeping throws', async () => {
		vi.spyOn(flowerTable, 'roll').mockReturnValue(new Bank().add('Mixed flowers') as never);
		vi.spyOn(globalThis.Logging, 'logError').mockReturnValue(undefined as never);
		const user = makeUser();
		user.updateGPTrackSetting = vi.fn(async () => {
			throw new Error('tracker failed');
		});
		const interaction = makeInteraction();

		const result = await hotColdCommand(interaction as never, user as never, 'cold', '50m');

		expect(embedDescription(result)).toBe('You lost 50m.');
		expect(user.update).toHaveBeenCalledWith({ GP: { decrement: 50_000_000 } });
		expect(globalThis.Logging.logError).toHaveBeenCalled();
	});

	test('a regular win pays even money and tracks a positive net', async () => {
		vi.spyOn(flowerTable, 'roll').mockReturnValue(new Bank().add('Red flowers') as never);
		const user = makeUser();
		const interaction = makeInteraction();

		const result = await hotColdCommand(interaction as never, user as never, 'hot', '1b');

		expect(embedDescription(result)).toBe('You **won** 2b!');
		expect(user.update).toHaveBeenCalledWith({ GP: { increment: 1_000_000_000 } });
		expect(user.updateGPTrackSetting).toHaveBeenCalledWith('gp_hotcold', 1_000_000_000);
		expect(user.statsUpdate).not.toHaveBeenCalled();
		expect(globalThis.ClientSettings.update).toHaveBeenCalledWith({
			gp_hotcold: { increment: 1_000_000_000 }
		});
	});
});
