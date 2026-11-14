import { describe, expect, test } from 'vitest';

import {
	isTestPotatoOpenForEveryone,
	TEST_BOT_APPLICATION_ID,
	TEST_SERVER_GUILD_ID,
	testPotatoAccess,
	testPotatoCallNeedsAdmin
} from '@/lib/bsc/testPotatoAccess.js';

const PROD_APP_ID = '1323755235793178655';
const PROD_GUILD_ID = '1320163629546471515';

const testEnv = (): NodeJS.ProcessEnv => ({
	NODE_ENV: 'development',
	PRODUCTION: 'false',
	BSC_ENV: 'test',
	BSC_TESTPOTATO_OPEN: 'true',
	CLIENT_ID: TEST_BOT_APPLICATION_ID
});
const prodEnv = (): NodeJS.ProcessEnv => ({
	NODE_ENV: 'production',
	PRODUCTION: 'true',
	BSC_ENV: 'prod',
	CLIENT_ID: PROD_APP_ID
});

const open = (env: NodeJS.ProcessEnv, applicationId: string | null | undefined, guildId: string | null | undefined) =>
	isTestPotatoOpenForEveryone({ env, applicationId, guildId });

describe('/testpotato open access gate', () => {
	test('test bot in Test Server with the flag is open', () => {
		expect(open(testEnv(), TEST_BOT_APPLICATION_ID, TEST_SERVER_GUILD_ID)).toBe(true);
	});

	test('prod config is closed everywhere', () => {
		expect(open(prodEnv(), PROD_APP_ID, PROD_GUILD_ID)).toBe(false);
		expect(open(prodEnv(), PROD_APP_ID, TEST_SERVER_GUILD_ID)).toBe(false);
		expect(open({ ...prodEnv(), BSC_TESTPOTATO_OPEN: 'true' }, PROD_APP_ID, TEST_SERVER_GUILD_ID)).toBe(false);
	});

	test('prod mode stays closed even with every other test value copied in', () => {
		expect(open({ ...testEnv(), PRODUCTION: 'true' }, TEST_BOT_APPLICATION_ID, TEST_SERVER_GUILD_ID)).toBe(false);
		expect(
			open(
				{ ...testEnv(), PRODUCTION: undefined, NODE_ENV: 'production' },
				TEST_BOT_APPLICATION_ID,
				TEST_SERVER_GUILD_ID
			)
		).toBe(false);
		expect(open({ ...testEnv(), PRODUCTION: 'maybe' }, TEST_BOT_APPLICATION_ID, TEST_SERVER_GUILD_ID)).toBe(false);
	});

	test('each single missing condition closes it', () => {
		const ok = [TEST_BOT_APPLICATION_ID, TEST_SERVER_GUILD_ID] as const;
		expect(open({ ...testEnv(), BSC_ENV: 'prod' }, ...ok)).toBe(false);
		expect(open({ ...testEnv(), BSC_ENV: undefined }, ...ok)).toBe(false);
		expect(open({ ...testEnv(), BSC_TESTPOTATO_OPEN: undefined }, ...ok)).toBe(false);
		expect(open({ ...testEnv(), BSC_TESTPOTATO_OPEN: '1' }, ...ok)).toBe(false);
		expect(open({ ...testEnv(), CLIENT_ID: PROD_APP_ID }, ...ok)).toBe(false);
		expect(open(testEnv(), PROD_APP_ID, TEST_SERVER_GUILD_ID)).toBe(false);
		expect(open(testEnv(), TEST_BOT_APPLICATION_ID, PROD_GUILD_ID)).toBe(false);
		expect(open(testEnv(), TEST_BOT_APPLICATION_ID, null)).toBe(false);
		expect(open(testEnv(), TEST_BOT_APPLICATION_ID, undefined)).toBe(false);
		expect(open(testEnv(), null, TEST_SERVER_GUILD_ID)).toBe(false);
	});

	test('unknown or empty config is closed', () => {
		expect(open({}, undefined, undefined)).toBe(false);
		expect(open({}, TEST_BOT_APPLICATION_ID, TEST_SERVER_GUILD_ID)).toBe(false);
	});
});

describe('/testpotato access decision', () => {
	test('non-admin is denied when the gate is closed', () => {
		expect(testPotatoAccess({ isAdmin: false, openForEveryone: false, options: { spawn: {} } })).toBe('denied');
	});

	test('admin is always allowed', () => {
		expect(
			testPotatoAccess({ isAdmin: true, openForEveryone: false, options: { thanksgiving: { active: true } } })
		).toBe('allowed');
	});

	test('non-admin can use player-only subcommands when open', () => {
		for (const options of [
			{ spawn: { preset: 'thanksgiving' } },
			{ max: {} },
			{ setxp: {} },
			{ wipe: { thing: 'bank' } },
			{ reset: { thing: 'x' } }
		]) {
			expect(testPotatoAccess({ isAdmin: false, openForEveryone: true, options })).toBe('allowed');
		}
	});

	test('global or other-player subcommands stay admin-only when open', () => {
		expect(testPotatoCallNeedsAdmin({ thanksgiving: { active: true } })).toBe(true);
		expect(testPotatoCallNeedsAdmin({ thanksgiving: { active: false } })).toBe(true);
		expect(testPotatoCallNeedsAdmin({ bingo_tools: { start_bingo: '1' } })).toBe(true);
		expect(testPotatoCallNeedsAdmin({ wipe: { thing: 'giveaways' } })).toBe(true);
		expect(
			testPotatoAccess({ isAdmin: false, openForEveryone: true, options: { thanksgiving: { active: true } } })
		).toBe('admin_only_subcommand');
	});
});
