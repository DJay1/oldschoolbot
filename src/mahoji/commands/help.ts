import { ButtonBuilder, ButtonStyle } from '@oldschoolgg/discord';

import { ticketConfig } from '@/lib/bsc/ticketService.js';
import { isTicketType, ticketFormButtonId, ticketFormButtonLabel, ticketHelpPrompt } from '@/lib/bsc/tickets.js';
import { patreonUrl } from '@/lib/patreonLink.js';

export const helpCommand = defineCommand({
	name: 'help',
	description: 'Get information and help with the bot.',
	// The ticket prompt is only shown to the player who asked.
	privateSubcommands: ['ticket'],
	options: [
		{
			type: 'String',
			name: 'ticket',
			description: 'Open a private ticket: bug, suggestion, player report or appeal.',
			required: false,
			choices: [
				{ name: 'Bug', value: 'bug' },
				{ name: 'Suggestion', value: 'suggestion' },
				{ name: 'Report a player', value: 'report' },
				{ name: 'Appeal (mute or warning)', value: 'appeal' }
			]
		}
	],
	run: async ({ options }) => {
		const ticket = (options as { ticket?: string }).ticket;
		if (isTicketType(ticket)) {
			if (!ticketConfig().channelId) {
				return {
					content: "Tickets aren't set up on this bot yet. Please tell a staff member instead.",
					ephemeral: true
				};
			}
			return {
				content: ticketHelpPrompt(ticket),
				components: [
					new ButtonBuilder()
						.setCustomId(ticketFormButtonId(ticket))
						.setLabel(ticketFormButtonLabel(ticket))
						.setStyle(ButtonStyle.Primary)
				],
				ephemeral: true
			};
		}
		return {
			content: `Help for **Bark School Corgo**. Old school, on four legs.

Use the slash commands to play. If you do not have a minion yet, run \`/minion buy\`.
Found a bug, have an idea, need to report a player or appeal? Use \`/help ticket:\` and pick one.

Perks: /patron info — ${patreonUrl()}`
		};
	}
});
