import '../../src/lib/util/clientSettings.js';

import { describe, expect, it, vi } from 'vitest';

import { isPrivateCommandUse } from '../../src/discord/interactionHandler.js';
import { deferButtonBeforeCommand } from '../../src/lib/settings/settings.js';

describe('early acknowledgement of commands', () => {
	it('slash commands defer privately only for private subcommands', () => {
		const cmd = { privateSubcommands: ['view'] };
		expect(isPrivateCommandUse(cmd, [{ name: 'view' }])).toBe(true);
		expect(isPrivateCommandUse(cmd, [{ name: 'buy' }])).toBe(false);
		expect(isPrivateCommandUse({}, [{ name: 'view' }])).toBe(false);
		expect(isPrivateCommandUse(undefined, undefined)).toBe(false);
	});

	it('defers a fresh button interaction once', async () => {
		const defer = vi.fn(async () => {});
		const itx: any = { isButton: () => true, deferred: false, replied: false, defer };
		await deferButtonBeforeCommand(itx);
		expect(defer).toHaveBeenCalledTimes(1);
	});

	it('leaves answered, non-button and internal interactions alone', async () => {
		const defer = vi.fn(async () => {});
		await deferButtonBeforeCommand({ isButton: () => true, deferred: true, replied: false, defer } as any);
		await deferButtonBeforeCommand({ isButton: () => true, deferred: false, replied: true, defer } as any);
		await deferButtonBeforeCommand({ isButton: () => false, deferred: false, replied: false, defer } as any);
		// Trip-queue / shutdown fakes have no isButton.
		await deferButtonBeforeCommand({ defer } as any);
		expect(defer).not.toHaveBeenCalled();
	});

	it('a failed defer does not stop the command', async () => {
		const itx: any = {
			isButton: () => true,
			deferred: false,
			replied: false,
			defer: async () => {
				throw new Error('Unknown interaction');
			}
		};
		await expect(deferButtonBeforeCommand(itx)).resolves.toBeUndefined();
	});
});
