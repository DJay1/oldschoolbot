import { SpecialResponse } from '@oldschoolgg/discord';

import { buildPollEmbed, pollButtons } from '@/lib/util/pollVotes.js';

export const pollCommand = defineCommand({
	name: 'poll',
	description: 'Create a Yes/No poll.',
	options: [
		{
			type: 'String',
			name: 'question',
			description: 'The poll question.',
			required: true
		}
	],
	run: async ({ interaction, user, options }) => {
		const embed = buildPollEmbed({
			question: options.question,
			yes: 0,
			no: 0,
			askedBy: user.username
		});

		await interaction.replyWithResponse({
			embeds: [embed],
			components: pollButtons()
		});
		return SpecialResponse.RespondedManually;
	}
});