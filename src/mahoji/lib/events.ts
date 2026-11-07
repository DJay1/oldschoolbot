import { syncDoubleLoot } from '@/lib/bso/doubleLoot.js';
import { syncSlayerMaskLeaderboardCache } from '@/lib/bso/skills/slayer/slayerMaskLeaderboard.js';

import { Time } from '@oldschoolgg/toolkit';
import { TimerManager } from '@sapphire/timer-manager';

import { bulkUpdateCommands } from '@/discord/utils.js';
import { Channel, globalConfig, META_CONSTANTS, testingShortcutsEnabled } from '@/lib/constants.js';
import { loadSeasonalEventOverrides } from '@/lib/events/store.js';
import { initTickers } from '@/lib/tickers.js';

export const onStartup = async () => {
	await syncDoubleLoot();
	await loadSeasonalEventOverrides().catch(err => Logging.logError(err));
	syncSlayerMaskLeaderboardCache();

	// Wait 10 seconds before starting tickers to reduce lag on startup
	TimerManager.setTimeout(
		() => {
			initTickers();
		},
		testingShortcutsEnabled() ? 0 : Time.Second * 10
	);

	// Production publishes player commands globally and leaves /admin and /rp on the support guild.
	// Test mode publishes the whole set to the support guild so QC sees updates immediately.
	// A rate limit must not crash the process: the Windows launcher restarts on any exit.
	try {
		await bulkUpdateCommands();
	} catch (err) {
		Logging.logError(err as Error);
	}

	if (globalConfig.isProduction) {
		globalClient
			.sendMessage(Channel.GeneralChannel, {
				content: `I have just turned on!\n\n${META_CONSTANTS.RENDERED_STR}`
			})
			.catch(err => Logging.logError(err));
	}
};
