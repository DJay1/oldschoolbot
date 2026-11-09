import { EmbedBuilder, dateFm } from '@oldschoolgg/discord';

import { formatStartupCatchUp, markCatchUpAnnounced } from '@/lib/bsc/announcementBackfill.js';
import { startupActiveBoosts } from '@/lib/bsc/startupActiveBoosts.js';
import { startupChangelogLines } from '@/lib/bsc/startupChangelog.js';
import { META_CONSTANTS } from '@/lib/constants.js';

const CATCH_UP_CAP = 15;

/**
 * Compact restart notice for General: title, time, boosts, changelog, one-time catch-up.
 */
export async function buildStartupRestartMessage(): Promise<{
	embeds: EmbedBuilder[];
	catchUpCount: number;
}> {
	const boosts = startupActiveBoosts();
	const changes = startupChangelogLines();
	const catchUp = await formatStartupCatchUp(CATCH_UP_CAP);

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
		blocks.push(`**What changed:**\n${changes.map(line => `- ${line}`).join('\n')}`);
	}

	if (catchUp.lines.length > 0) {
		const body = catchUp.lines.map(line => `- ${line}`).join('\n');
		const extra = catchUp.hidden > 0 ? `\n- +${catchUp.hidden} more` : '';
		blocks.push(`**Already owned (catch-up):**\n${body}${extra}`);
	}

	embed.setDescription(blocks.join('\n\n').slice(0, 4000));

	if (catchUp.candidates.length > 0) {
		await markCatchUpAnnounced(catchUp.candidates);
	}

	return { embeds: [embed], catchUpCount: catchUp.candidates.length };
}
