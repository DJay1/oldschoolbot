import './lib/safeglobals.js';
import './lib/user/MUser.js';
import './discord/client.js';
import './lib/cache/redis.js';

import exitHook from 'exit-hook';

import { createDb } from '@/lib/globals.js';
import { preStartup } from '@/lib/preStartup.js';
import { runSlayerUpdateMigration } from '@/lib/slayer/slayerBlocks.js';
import { exitCleanup } from '@/mahoji/lib/exitHandler.js';

exitHook(exitCleanup);

async function main() {
	await createDb();
	await runSlayerUpdateMigration().catch(err => Logging.logError(err as Error));
	Logging.logDebug(`Starting up after ${process.uptime()}s`);
	await Promise.all([preStartup(), globalClient.login()]);
}

process.on('uncaughtException', err => {
	Logging.logError(err);
});

process.on('unhandledRejection', err => {
	Logging.logError(err as Error);
});

function requestGracefulShutdown() {
	if (typeof globalThis.globalClient !== 'undefined') {
		globalClient.isShuttingDown = true;
	}
}

process.on('SIGINT', requestGracefulShutdown);
process.on('SIGTERM', requestGracefulShutdown);

main();
