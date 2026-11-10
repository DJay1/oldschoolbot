import { TimerManager } from '@sapphire/timer-manager';

import { sonicBoom } from '@/lib/util/logger.js';

export async function exitCleanup() {
	try {
		if (typeof globalThis.globalClient !== 'undefined') {
			globalClient.isShuttingDown = true;
		}
		if (typeof globalThis.ActivityManager !== 'undefined') {
			await ActivityManager.drain({ timeoutMs: 25_000 });
		}
		if (typeof globalThis.globalClient !== 'undefined') {
			globalClient.ws.destroy();
		}
		TimerManager.destroy();
		sonicBoom.flushSync();
		sonicBoom.destroy();
		if (prisma) {
			prisma.$disconnect();
		}
		if (roboChimpClient) {
			roboChimpClient.$disconnect();
		}
		await Cache.close();
	} catch (err) {
		Logging.logError(err as Error);
		process.exit(1);
	}
}
