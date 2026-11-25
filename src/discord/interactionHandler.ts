import {
	type APIChatInputApplicationCommandInteraction,
	type APIInteraction,
	ApplicationCommandType,
	ComponentType,
	InteractionType
} from '@oldschoolgg/discord';
import type { IAutoCompleteInteraction, IButtonInteraction, IChatInputCommandInteraction } from '@oldschoolgg/schemas';
import { DiscordSnowflake } from '@sapphire/snowflake';

import { autoCompleteHandler } from '@/discord/autoCompleteHandler.js';
import { commandHandler } from '@/discord/commandHandler.js';
import type { OldSchoolBotClient } from '@/discord/OldSchoolBotClient.js';
import { handlePollUpdateComponent } from '@/lib/bsc/pollService.js';
import { handleTicketModalSubmit, isTicketModalId, type TicketModalSubmit } from '@/lib/bsc/ticketService.js';
import { DISCORD_USER_IDS_INSERTED_CACHE } from '@/lib/cache.js';
import { OSInteraction } from '@/lib/structures/OSInteraction.js';
import { claimDiscordEvent } from '@/lib/util/discordEventGate.js';
import { globalButtonInteractionHandlerWrapper } from '@/lib/util/globalInteractions.js';

function chatInputData(
	itx: APIChatInputApplicationCommandInteraction,
	userId: string,
	guildId: string | null
): IChatInputCommandInteraction {
	return {
		id: itx.id,
		token: itx.token,
		user_id: userId,
		created_timestamp: DiscordSnowflake.timestampFrom(itx.id),
		guild_id: guildId,
		channel_id: itx.channel.id,
		kind: 'ChatInputCommand',
		command_name: itx.data.name,
		command_type: itx.data.type
	};
}

/** Private (ephemeral) when the command lists the used subcommand as private, same rule as the lock defer. */
export function isPrivateCommandUse(
	command: { privateSubcommands?: readonly string[] } | undefined,
	options: { name: string }[] | undefined
): boolean {
	const used = new Set((options ?? []).map(o => o.name));
	return Boolean(command?.privateSubcommands?.some(name => used.has(name)));
}

async function deferCommandOnArrival(
	client: OldSchoolBotClient,
	interaction: OSInteraction<IChatInputCommandInteraction>,
	itx: APIChatInputApplicationCommandInteraction
) {
	const command = client.allCommands.find(c => c.name === itx.data.name);
	try {
		await interaction.defer({ ephemeral: isPrivateCommandUse(command, itx.data.options) });
	} catch (err) {
		// Already expired or acknowledged: carry on so the command behaves exactly as before.
		Logging.logDebug('Early command defer failed', { error: (err as Error).message, command_name: itx.data.name });
	}
}

export async function interactionHandler(client: OldSchoolBotClient, itx: APIInteraction) {
	if (!claimDiscordEvent('interaction', itx.id)) return;
	const guildId = itx.guild_id ?? null;
	const user = (itx.member?.user ?? itx.user)!;
	const userId = user.id;

	if (!DISCORD_USER_IDS_INSERTED_CACHE.has(userId) && user) {
		client.upsertDiscordUser(user);
	}

	// Acknowledge slash commands before any database or image work, so Discord's 3 second window is never missed
	// while the bot is busy. Autocomplete, select menus and buttons are handled below as before.
	let earlyCommand: OSInteraction<IChatInputCommandInteraction> | null = null;
	if (itx.type === InteractionType.ApplicationCommand && itx.data.type === ApplicationCommandType.ChatInput) {
		earlyCommand = new OSInteraction({
			interaction: chatInputData(itx as APIChatInputApplicationCommandInteraction, userId, guildId),
			rawInteraction: itx as APIChatInputApplicationCommandInteraction,
			client,
			// Filled in right after the defer.
			user: null as unknown as MUser
		});
		await deferCommandOnArrival(client, earlyCommand, itx as APIChatInputApplicationCommandInteraction);
	}

	const fullUser = await mUserFetch(userId);

	if (itx.type === InteractionType.ApplicationCommandAutocomplete) {
		const d: IAutoCompleteInteraction = {
			id: itx.id,
			token: itx.token,
			user_id: userId,
			created_timestamp: DiscordSnowflake.timestampFrom(itx.id),
			guild_id: guildId,
			channel_id: itx.channel?.id ?? null,
			kind: 'AutoComplete',
			command_name: itx.data.name,
			options: itx.data.options
		};
		return autoCompleteHandler(d);
	}

	// Ticket forms (player report and staff reason box). Other modals (daily games) use their own listener.
	if (itx.type === InteractionType.ModalSubmit && isTicketModalId(itx.data.custom_id)) {
		await handleTicketModalSubmit(itx as unknown as TicketModalSubmit, fullUser).catch(err =>
			Logging.logError(err as Error, { type: 'TICKET_MODAL', user_id: userId })
		);
		return;
	}

	if (itx.type === InteractionType.MessageComponent && itx.data.component_type === ComponentType.StringSelect) {
		await handlePollUpdateComponent({
			id: itx.id,
			token: itx.token,
			userId,
			guildId,
			roleIds: itx.member?.roles,
			customId: itx.data.custom_id,
			values: itx.data.values
		});
		return;
	}

	// Button
	if (itx.type === InteractionType.MessageComponent && itx.data.component_type === ComponentType.Button) {
		const d: IButtonInteraction = {
			id: itx.id,
			token: itx.token,
			user_id: userId,
			created_timestamp: DiscordSnowflake.timestampFrom(itx.id),
			guild_id: guildId,
			channel_id: itx.channel.id,
			kind: 'Button',
			custom_id: itx.data.custom_id,
			message: {
				id: itx.message.id,
				channel_id: itx.message.channel_id,
				guild_id: guildId,
				author_id: itx.message.author.id,
				content: itx.message.content
			}
		};
		const interaction = new OSInteraction({ interaction: d, rawInteraction: itx, client, user: fullUser });
		await globalButtonInteractionHandlerWrapper(itx, interaction);
		return;
	}

	if (itx.type === InteractionType.ApplicationCommand && itx.data.type === ApplicationCommandType.ChatInput) {
		const chatInputItx = itx as APIChatInputApplicationCommandInteraction;
		const interaction = earlyCommand!;
		interaction.user = fullUser;
		await commandHandler(chatInputItx, interaction);
		return;
	}
}
