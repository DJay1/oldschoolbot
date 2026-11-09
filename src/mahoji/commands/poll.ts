import { EmbedBuilder, SpecialResponse } from '@oldschoolgg/discord';

export const pollCommand = defineCommand({
	name: 'poll',
	description: 'Create a reaction poll.',
	options: [
		{
			type: 'String',
			name: 'question',
			description: 'The poll question.',
			required: true
		}
	],
	run: async ({ interaction, channelId, user, options }) => {
		const embed = new EmbedBuilder()
			.setColor(0x58_65_f2)
			.setTitle('Poll')
			.setDescription(`**${options.question}**\n\nReact with Yes / No.`)
			.setFooter({ text: `Asked by ${user.username}` });

		const createdMessage = await interaction.replyWithResponse({
			embeds: [embed]
		});
		const messageId = createdMessage!.message_id;
		await globalClient.reactToMsg({ channelId: channelId, messageId, emojiId: 'Yes' });
		await globalClient.reactToMsg({ channelId: channelId, messageId, emojiId: 'No' });
		return SpecialResponse.RespondedManually;
	}
});
