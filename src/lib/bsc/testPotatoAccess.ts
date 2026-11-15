import { isProductionMode } from '@/lib/hosting/productionMode.js';

/**
 * /testpotato open access for everyone, test bot only.
 *
 * Default closed. Every condition below must be true to open it:
 * 1. Not production mode (PRODUCTION / NODE_ENV).
 * 2. BSC_ENV is "test".
 * 3. BSC_TESTPOTATO_OPEN is "true" (set only in the gitignored .env.test).
 * 4. CLIENT_ID in the env is the test app id.
 * 5. The running Discord application id is the test app id.
 * 6. The guild is Test Server.
 *
 * The live bot has a different app id, BSC_ENV=prod and PRODUCTION=true, so even if this code
 * is merged to main it stays admin-only there.
 */
export const TEST_BOT_APPLICATION_ID = '1568786765576409140';
export const TEST_SERVER_GUILD_ID = '1564440506866606101';
export const TESTPOTATO_OPEN_ENV_FLAG = 'BSC_TESTPOTATO_OPEN';

/**
 * Subcommands that stay admin-only even when open access is on, because they change global state or
 * affect other players: the event toggle, starting a bingo other players are in, posting the weekly recap, and deleting
 * giveaways other players have entered.
 */
export const TESTPOTATO_ADMIN_ONLY_SUBCOMMANDS = ['thanksgiving', 'bingo_tools', 'weekly_recap'] as const;
export const TESTPOTATO_ADMIN_ONLY_WIPE_THINGS = ['giveaways'] as const;

export function isTestPotatoOpenForEveryone({
	applicationId,
	guildId,
	env = process.env
}: {
	applicationId: string | null | undefined;
	guildId: string | null | undefined;
	env?: NodeJS.ProcessEnv;
}): boolean {
	try {
		if (isProductionMode(env)) return false;
	} catch {
		return false;
	}
	if (env.BSC_ENV !== 'test') return false;
	if (env[TESTPOTATO_OPEN_ENV_FLAG] !== 'true') return false;
	if (env.CLIENT_ID !== TEST_BOT_APPLICATION_ID) return false;
	if (applicationId !== TEST_BOT_APPLICATION_ID) return false;
	if (guildId !== TEST_SERVER_GUILD_ID) return false;
	return true;
}

/** True when this subcommand call must be run by a bot admin even with open access on. */
export function testPotatoCallNeedsAdmin(options: Record<string, unknown>): boolean {
	for (const sub of TESTPOTATO_ADMIN_ONLY_SUBCOMMANDS) {
		if (options[sub] !== undefined && options[sub] !== null) return true;
	}
	const wipe = options.wipe as { thing?: string } | undefined | null;
	if (wipe && (TESTPOTATO_ADMIN_ONLY_WIPE_THINGS as readonly string[]).includes(String(wipe.thing))) return true;
	return false;
}

export type TestPotatoAccess = 'allowed' | 'admin_only_subcommand' | 'denied';

export function testPotatoAccess({
	isAdmin,
	openForEveryone,
	options
}: {
	isAdmin: boolean;
	openForEveryone: boolean;
	options: Record<string, unknown>;
}): TestPotatoAccess {
	if (isAdmin) return 'allowed';
	if (!openForEveryone) return 'denied';
	if (testPotatoCallNeedsAdmin(options)) return 'admin_only_subcommand';
	return 'allowed';
}
