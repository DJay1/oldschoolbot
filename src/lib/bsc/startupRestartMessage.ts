import { EmbedBuilder, dateFm } from '@oldschoolgg/discord';

import { startupActiveBoosts } from '@/lib/bsc/startupActiveBoosts.js';
import { startupChangelogLines } from '@/lib/bsc/startupChangelog.js';
import { META_CONSTANTS } from '@/lib/constants.js';

/**
 * Compact restart notice for General: title, time, boosts, changelog.
 * Funziez / Notification channel already logs item receives, so catch-up is not listed here.
 */
export async function buildStartupRestartMessage(): Promise<{
	embeds: EmbedBuilder[];
}> {
	const boosts = startupActiveBoosts();
	const changes = startupChangelogLines();

	const embed = new EmbedBuilder()
		.setColor(0x57_f2_87)
		.setTitle('Bark School Corgo is online')
		.setTimestamp(META_CONSTANTS.STARTUP_DATE);

	const blocks: string[] = [`**Date/Time:** ${dateFm(META_CONSTANTS.STARTUP_DATE)}`];

	if (boosts) {
		// startupActiveBoosts already includes the heading
		blocks.push(boosts);
	}

	if (changes.length > 0) {
		const changeLines = changes.map(line => `- ${line}`).join('\n');
		blocks.push(`**What changed:**\n${changeLines}`);
	}

	embed.setDescription(blocks.join('\n\n').slice(0, 4000));

	return { embeds: [embed] };
}
