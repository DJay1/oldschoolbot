import { qualityCheckItemChoices } from '@/lib/qualityChecks/config.js';
import { QualityCheckBoardError } from '@/lib/qualityChecks/forum.js';
import {
	closeQualityCheckCampaign,
	confirmQualityCheckBounty,
	postQualityCheckBoard,
	qualityCheckLeaderboardText,
	qualityCheckStaffDenial,
	qualityCheckStatusText,
	rejectQualityCheckBounty,
	syncQualityCheckBoard
} from '@/lib/qualityChecks/service.js';

const itemOption = {
	type: 'String' as const,
	name: 'item' as const,
	description: 'Bounty to update.',
	required: true as const,
	choices: qualityCheckItemChoices
};

const noteOption = {
	type: 'String' as const,
	name: 'note' as const,
	description: 'Reason posted in the bounty thread.',
	required: false as const
};

function clampMessage(content: string): string {
	if (content.length <= 1900) return content;
	return `${content.slice(0, 1890)}\n…`;
}

export const qualityCheckCommand = defineCommand({
	name: 'qualitycheck',
	description: 'Post quality-check bounties and confirm credit.',
	attributes: {
		categoryFlags: ['utility'],
		examples: ['/qualitycheck post', '/qualitycheck sync', '/qualitycheck leaderboard']
	},
	options: [
		{
			type: 'Subcommand',
			name: 'post',
			description: 'Create or refresh one forum post per bounty.',
			options: []
		},
		{
			type: 'Subcommand',
			name: 'sync',
			description: 'Read forum tags and threads into the bounty board.',
			options: []
		},
		{
			type: 'Subcommand',
			name: 'status',
			description: 'Show each bounty, who claimed it, and the thread.',
			options: []
		},
		{
			type: 'Subcommand',
			name: 'leaderboard',
			description: 'Show confirmed credits.',
			options: []
		},
		{
			type: 'Subcommand',
			name: 'confirm',
			description: 'Credit the claimer. Same as the Confirm button.',
			options: [itemOption]
		},
		{
			type: 'Subcommand',
			name: 'reject',
			description: 'Reject a bounty. It does not count as credit.',
			options: [itemOption, noteOption]
		},
		{
			type: 'Subcommand',
			name: 'close',
			description: 'Stop reminders. DJ can still confirm a waiting bounty.',
			options: []
		}
	],
	run: async ({ options, user, guildId, interaction }) => {
		const denied = qualityCheckStaffDenial(user, guildId);
		if (denied) return { content: denied, ephemeral: true };
		await interaction.defer();
		try {
			if (options.post) return clampMessage(await postQualityCheckBoard());
			if (options.sync) return clampMessage(await syncQualityCheckBoard());
			if (options.status) return clampMessage(await qualityCheckStatusText());
			if (options.leaderboard) return clampMessage(await qualityCheckLeaderboardText());
			if (options.confirm) return confirmQualityCheckBounty(user, options.confirm.item);
			if (options.reject) return rejectQualityCheckBounty(user, options.reject.item, options.reject.note);
			if (options.close) return closeQualityCheckCampaign();
			return 'Choose a quality-check subcommand.';
		} catch (err) {
			if (err instanceof QualityCheckBoardError) return err.message;
			Logging.logError(err as Error, { type: 'QUALITY_CHECK_COMMAND' });
			return 'The quality-check command failed. The channel must be a Forum, and the bot needs permission to post threads.';
		}
	}
});
