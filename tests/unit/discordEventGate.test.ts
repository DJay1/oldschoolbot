import type { APIInteraction } from '@oldschoolgg/discord';
import type { IMessage } from '@oldschoolgg/schemas';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { OldSchoolBotClient } from '@/discord/OldSchoolBotClient.js';
import { interactionHandler } from '@/discord/interactionHandler.js';
import { globalConfig } from '@/lib/constants.js';
import { onMessage } from '@/lib/events.js';
import {
	DISCORD_EVENT_CLAIM_LIMIT,
	claimDiscordEvent,
	resetDiscordEventClaimsForTests
} from '@/lib/util/discordEventGate.js';

let originalFetch: typeof global.mUserFetch;
let originalClient: typeof global.globalClient;

beforeEach(() => {
	resetDiscordEventClaimsForTests();
	originalFetch = global.mUserFetch;
	originalClient = global.globalClient;
});

afterEach(() => {
	global.mUserFetch = originalFetch;
	global.globalClient = originalClient;
});

function mentionMessage(id: string, content = `<@${globalConfig.clientID}>`): IMessage {
	return {
		id,
		content,
		author_id: '222',
		channel_id: '333',
		guild_id: null
	};
}

function installFetchSpy() {
	const fetchUser = vi.fn(async () => {
		throw new Error('fetched');
	});
	global.mUserFetch = fetchUser as typeof global.mUserFetch;
	const channelIsSendable = vi.fn(async () => true);
	global.globalClient = { channelIsSendable } as typeof global.globalClient;
	return { fetchUser, channelIsSendable };
}

test('claims each message id and interaction id once', () => {
	expect(claimDiscordEvent('message', '1')).toBe(true);
	expect(claimDiscordEvent('message', '1')).toBe(false);
	expect(claimDiscordEvent('interaction', '1')).toBe(true);
	expect(claimDiscordEvent('interaction', '1')).toBe(false);
	expect(claimDiscordEvent('message', '2')).toBe(true);
	expect(claimDiscordEvent('message', undefined)).toBe(true);
	expect(claimDiscordEvent('message', undefined)).toBe(true);
});

test('drops the oldest claim after the limit', () => {
	expect(claimDiscordEvent('message', 'oldest')).toBe(true);
	for (let i = 0; i < DISCORD_EVENT_CLAIM_LIMIT; i++) {
		expect(claimDiscordEvent('message', `id-${i}`)).toBe(true);
	}
	expect(claimDiscordEvent('message', 'oldest')).toBe(true);
	expect(claimDiscordEvent('message', `id-${DISCORD_EVENT_CLAIM_LIMIT - 1}`)).toBe(false);
});

test('onMessage runs a mention once per message id', async () => {
	const { fetchUser, channelIsSendable } = installFetchSpy();
	const msg = mentionMessage('msg-1');

	await expect(onMessage(msg)).rejects.toThrow('fetched');
	await expect(onMessage({ ...msg })).resolves.toBeUndefined();

	expect(fetchUser).toHaveBeenCalledTimes(1);
	expect(channelIsSendable).toHaveBeenCalledTimes(1);
});

test('onMessage still runs a different message id', async () => {
	const { fetchUser } = installFetchSpy();

	await expect(onMessage(mentionMessage('msg-a'))).rejects.toThrow('fetched');
	await expect(onMessage(mentionMessage('msg-b'))).rejects.toThrow('fetched');

	expect(fetchUser).toHaveBeenCalledTimes(2);
});

test('interactionHandler runs once per interaction id', async () => {
	const { fetchUser } = installFetchSpy();
	const upsertDiscordUser = vi.fn();
	const client = { upsertDiscordUser } as unknown as OldSchoolBotClient;
	const itx = {
		id: 'itx-1',
		guild_id: null,
		user: { id: '424242' }
	} as APIInteraction;

	await expect(interactionHandler(client, itx)).rejects.toThrow('fetched');
	await expect(interactionHandler(client, { ...itx })).resolves.toBeUndefined();
	await expect(interactionHandler(client, { ...itx, id: 'itx-2' })).rejects.toThrow('fetched');

	expect(fetchUser).toHaveBeenCalledTimes(2);
	expect(upsertDiscordUser).toHaveBeenCalledTimes(2);
});
