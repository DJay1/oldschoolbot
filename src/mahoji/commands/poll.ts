import { MessageFlags, SpecialResponse } from '@oldschoolgg/discord';

import {
	buildPollListPages,
	canCreateRepoll,
	canDeletePoll,
	isPollStillUpdateable,
	parsePollDuration,
	pollResultEmbed,
	truncatePollText,
	type PollRecord
} from '@/lib/bsc/polls.js';
import {
	createPollRecord,
	deleteStoredPoll,
	pendingUpdateNote,
	pollPickSelectRow,
	replyWithRawInteractionMessage,
	userCanUpdatePolls
} from '@/lib/bsc/pollService.js';

function autocompletePolls(value: string, polls: PollRecord[]) {
	const query = value.trim().toLowerCase();
	return polls
		.filter(poll => !query || poll.question.toLowerCase().includes(query) || poll.id.includes(query))
		.slice(0, 25)
		.map(poll => ({
			name: truncatePollText(`${poll.status}: ${poll.question}`, 100),
			value: poll.id
		}));
}

async function pollsInGuild(guildId: string | null): Promise<PollRecord[]> {
	if (!guildId) return [];
	const polls = await Cache.listPolls();
	return polls.filter(poll => poll.guildId === guildId);
}

export const pollCommand = defineCommand({
	name: 'poll',
	description: 'Create and manage Yes/No reaction polls.',
	options: [
		{
			type: 'Subcommand',
			name: 'create',
			description: 'Create a Yes/No poll. Closes after 2 days by default.',
			options: [
				{
					type: 'String',
					name: 'question',
					description: 'The poll question.',
					required: true
				},
				{
					type: 'String',
					name: 'duration',
					description: 'How long the poll stays open (e.g. 12h, 2d, 7d). Default: 2d.',
					required: false
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'list',
			description: 'List tracked polls and their status.'
		},
		{
			type: 'Subcommand',
			name: 'update',
			description: 'Staff: set a passed poll to In progress, Done, or Rejected.',
			options: [
				{
					type: 'String',
					name: 'note',
					description: 'Optional note shown in /poll list (e.g. who is working on it).',
					required: false
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'repoll',
			description: 'Create a new poll for one that is eligible for a repoll.',
			options: [
				{
					type: 'String',
					name: 'poll',
					description: 'The poll to run again.',
					required: true,
					autocomplete: async ({ value, userId, guildId }: StringAutoComplete) => {
						const now = Date.now();
						const polls = (await pollsInGuild(guildId)).filter(poll => canCreateRepoll(poll, userId, now));
						return autocompletePolls(value, polls);
					}
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'delete',
			description: 'DJ only: delete a troll or unwanted poll.',
			options: [
				{
					type: 'String',
					name: 'poll',
					description: 'The poll to delete.',
					required: true,
					autocomplete: async ({ value, userId, guildId }: StringAutoComplete) => {
						if (!canDeletePoll(userId)) return [];
						return autocompletePolls(value, await pollsInGuild(guildId));
					}
				}
			]
		}
	],
	run: async ({ interaction, options, user, member, channelId, guildId, userId }) => {
		if (options.create) {
			if (!user.hasMinion) {
				return 'You need a minion to create a poll.';
			}
			if (!guildId) {
				return 'Use this command in a server.';
			}
			const duration = parsePollDuration(options.create.duration);
			if (!duration.ok) {
				return duration.message;
			}

			const now = Date.now();
			const draft: PollRecord = {
				id: 'pending',
				guildId,
				channelId,
				messageId: 'pending',
				question: options.create.question,
				creatorId: userId,
				createdAt: now,
				closesAt: now + duration.ms,
				status: 'Open',
				yes: 0,
				no: 0,
				total: 0,
				percent: null,
				note: null,
				isRepoll: false,
				originalPollId: null,
				repollId: null,
				repollDeadline: null,
				updatedAt: now
			};
			const createdMessage = await interaction.replyWithResponse({
				embeds: [pollResultEmbed(draft)]
			});
			const messageId = createdMessage!.message_id;
			await createPollRecord({
				guildId,
				channelId,
				messageId,
				question: options.create.question,
				creatorId: userId,
				durationMs: duration.ms,
				now
			});
			await globalClient.reactToMsg({ channelId, messageId, emojiId: 'Yes' });
			await globalClient.reactToMsg({ channelId, messageId, emojiId: 'No' });
			return SpecialResponse.RespondedManually;
		}

		if (options.list) {
			const polls = await pollsInGuild(guildId);
			return interaction.makePaginatedMessage({ pages: buildPollListPages(polls) });
		}

		if (options.update) {
			const allowed = await userCanUpdatePolls(userId, guildId, member?.roles);
			if (!allowed) {
				return {
					content: 'Only DJ or members with the Developer or Contributor role can update polls.',
					ephemeral: true
				};
			}
			const updatable = (await pollsInGuild(guildId)).filter(isPollStillUpdateable);
			if (updatable.length === 0) {
				return {
					content: 'There are no polls to update right now. This is for Passed, In progress, or Repoll polls.',
					ephemeral: true
				};
			}
			await Cache.savePollUpdateNote(userId, pendingUpdateNote(options.update.note));
			await replyWithRawInteractionMessage(interaction.id, interaction.rawInteraction.token, {
				content:
					'Pick a poll to update, then choose In progress, Done, or Rejected. Optional notes can be added with `/poll update note:`.',
				components: [pollPickSelectRow(updatable)],
				flags: MessageFlags.Ephemeral
			});
			return SpecialResponse.RespondedManually;
		}

		if (options.repoll) {
			if (!user.hasMinion) {
				return 'You need a minion to create a poll.';
			}
			if (!guildId) {
				return 'Use this command in a server.';
			}
			const original = await Cache.getPoll(options.repoll.poll);
			if (!original || original.guildId !== guildId) {
				return 'That poll could not be found.';
			}
			if (!canCreateRepoll(original, userId)) {
				return 'That poll is not eligible for a repoll, or you are not allowed to create one.';
			}
			const duration = parsePollDuration(undefined);
			if (!duration.ok) return duration.message;

			const now = Date.now();
			const draft: PollRecord = {
				id: 'pending',
				guildId,
				channelId,
				messageId: 'pending',
				question: original.question,
				creatorId: userId,
				createdAt: now,
				closesAt: now + duration.ms,
				status: 'Open',
				yes: 0,
				no: 0,
				total: 0,
				percent: null,
				note: null,
				isRepoll: true,
				originalPollId: original.id,
				repollId: null,
				repollDeadline: null,
				updatedAt: now
			};
			const createdMessage = await interaction.replyWithResponse({
				embeds: [pollResultEmbed(draft)]
			});
			const messageId = createdMessage!.message_id;
			await createPollRecord({
				guildId,
				channelId,
				messageId,
				question: original.question,
				creatorId: userId,
				durationMs: duration.ms,
				isRepoll: true,
				originalPollId: original.id,
				now
			});
			await globalClient.reactToMsg({ channelId, messageId, emojiId: 'Yes' });
			await globalClient.reactToMsg({ channelId, messageId, emojiId: 'No' });
			return SpecialResponse.RespondedManually;
		}

		if (options.delete) {
			if (!canDeletePoll(userId)) {
				return { content: 'Only DJ can delete polls.', ephemeral: true };
			}
			const poll = await Cache.getPoll(options.delete.poll);
			if (!poll || (guildId && poll.guildId !== guildId)) {
				return 'That poll could not be found.';
			}
			const result = await deleteStoredPoll(poll.id);
			if ('error' in result) return result.error;
			return `Deleted poll: ${truncatePollText(result.question, 80)}`;
		}

		return 'Invalid command.';
	}
});
