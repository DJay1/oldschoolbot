import { makeURLSearchParams } from '@discordjs/rest';
import {
	InteractionResponseType,
	MessageFlags,
	Routes
} from '@oldschoolgg/discord';
import { stringMatches } from '@oldschoolgg/toolkit';

import { globalConfig } from '@/lib/constants.js';
import { ReactEmoji } from '@/lib/data/emojis.js';
import {
	canUpdatePollStatus,
	closeResultSummary,
	countedPollVotes,
	isAllowedUpdateTarget,
	isPollStillUpdateable,
	POLL_DJ_USER_ID,
	POLL_REPOLL_WINDOW_MS,
	POLL_STAFF_CHANNEL_ID,
	POLL_STAFF_CHANNEL_NAME,
	POLL_STAFF_ROLE_NAMES,
	POLL_UPDATE_PICK_ID,
	POLL_UPDATE_STATUS_PREFIX,
	POLL_UPDATE_TARGET_STATUSES,
	pollCloseOutcome,
	pollResultEmbed,
	shouldPostWeeklyPollReminder,
	truncatePollText,
	weeklyPollReminderWeekId,
	type PollRecord,
	type PollStatus
} from '@/lib/bsc/polls.js';

async function fetchAllReactionUserIds(channelId: string, messageId: string, emoji: string): Promise<string[]> {
	const ids: string[] = [];
	let after: string | undefined;
	for (let page = 0; page < 20; page++) {
		const query: Record<string, string | number> = { limit: 100 };
		if (after) query.after = after;
		const res = (await globalClient.rest.get(Routes.channelMessageReaction(channelId, messageId, emoji), {
			query: makeURLSearchParams(query)
		})) as { id: string }[] | null;
		if (!res || res.length === 0) break;
		ids.push(...res.map(user => user.id));
		if (res.length < 100) break;
		after = res[res.length - 1].id;
	}
	return ids;
}

export async function usersWithMinions(userIds: string[]): Promise<Set<string>> {
	const unique = [...new Set(userIds)].filter(Boolean);
	if (unique.length === 0) return new Set();
	const rows = await prisma.user.findMany({
		where: { id: { in: unique } },
		select: { id: true, minion_hasBought: true }
	});
	return new Set(rows.filter(row => row.minion_hasBought).map(row => row.id));
}

export async function userHasPollStaffRole(guildId: string | null, roleIds: string[] | undefined): Promise<boolean> {
	if (!guildId || !roleIds || roleIds.length === 0) return false;
	const roles = await globalClient.fetchRolesOfGuild(guildId);
	const staffIds = new Set(
		roles.filter(role => POLL_STAFF_ROLE_NAMES.some(name => stringMatches(role.name, name))).map(role => role.id)
	);
	return roleIds.some(id => staffIds.has(id));
}

export async function userCanUpdatePolls(
	userId: string,
	guildId: string | null,
	roleIds: string[] | undefined
): Promise<boolean> {
	if (canUpdatePollStatus(userId, false)) return true;
	return userHasPollStaffRole(guildId, roleIds);
}

async function notifyCreator(poll: PollRecord, text: string): Promise<void> {
	try {
		await globalClient.sendDm(poll.creatorId, text);
	} catch {
		try {
			await globalClient.sendMessage(poll.channelId, {
				content: `<@${poll.creatorId}> ${text}`,
				allowedMentions: { parse: [], users: [poll.creatorId], roles: [] }
			});
		} catch (err) {
			Logging.logError(err as Error);
		}
	}
}

async function updatePollMessage(poll: PollRecord): Promise<void> {
	try {
		await globalClient.editMessage(poll.channelId, poll.messageId, {
			embeds: [pollResultEmbed(poll).toJSON()]
		} as any);
	} catch (err) {
		Logging.logError(err as Error);
	}
}

export async function snapshotAndClosePoll(poll: PollRecord, now = Date.now()): Promise<PollRecord | null> {
	if (poll.status !== 'Open' || now < poll.closesAt) return null;
	const claimed = await Cache.tryClaimPollCloseLock(poll.id);
	if (!claimed) return null;

	try {
		const yesUsers = await fetchAllReactionUserIds(
			poll.channelId,
			poll.messageId,
			encodeURIComponent(ReactEmoji.Yes)
		);
		const noUsers = await fetchAllReactionUserIds(
			poll.channelId,
			poll.messageId,
			encodeURIComponent(ReactEmoji.No)
		);
		const minions = await usersWithMinions([...yesUsers, ...noUsers]);
		const counted = countedPollVotes(yesUsers, noUsers, minions, globalConfig.clientID);
		const outcome = pollCloseOutcome(counted.yes, counted.no, poll.isRepoll);
		const closed: PollRecord = {
			...poll,
			status: outcome.status,
			yes: counted.yes,
			no: counted.no,
			total: counted.total,
			percent: outcome.percent,
			repollDeadline: outcome.status === 'Repoll' ? now + POLL_REPOLL_WINDOW_MS : null,
			updatedAt: now
		};
		await Cache.savePoll(closed);
		await updatePollMessage(closed);
		await notifyCreator(closed, closeResultSummary(closed));
		return closed;
	} catch (err) {
		await Cache.releasePollCloseLock(poll.id);
		Logging.logError(err as Error);
		return null;
	}
}

export async function expireRepollWindow(poll: PollRecord, now = Date.now()): Promise<PollRecord | null> {
	if (poll.status !== 'Repoll' || poll.repollId) return null;
	if (!poll.repollDeadline || now <= poll.repollDeadline) return null;
	const closed: PollRecord = { ...poll, status: 'Failed', updatedAt: now };
	await Cache.savePoll(closed);
	await updatePollMessage(closed);
	await notifyCreator(closed, `Your poll was eligible for a repoll, but none was created in time, so it failed. ${closed.yes} Yes / ${closed.total} counted (${closed.percent?.toFixed(1)}% yes).`);
	return closed;
}

export async function createPollRecord(options: {
	guildId: string;
	channelId: string;
	messageId: string;
	question: string;
	creatorId: string;
	durationMs: number;
	isRepoll?: boolean;
	originalPollId?: string;
	now?: number;
}): Promise<PollRecord> {
	const now = options.now ?? Date.now();
	const poll: PollRecord = {
		id: options.messageId,
		guildId: options.guildId,
		channelId: options.channelId,
		messageId: options.messageId,
		question: options.question,
		creatorId: options.creatorId,
		createdAt: now,
		closesAt: now + options.durationMs,
		status: 'Open',
		yes: 0,
		no: 0,
		total: 0,
		percent: null,
		note: null,
		isRepoll: options.isRepoll ?? false,
		originalPollId: options.originalPollId ?? null,
		repollId: null,
		repollDeadline: null,
		updatedAt: now
	};
	await Cache.savePoll(poll);
	if (options.originalPollId) {
		const original = await Cache.getPoll(options.originalPollId);
		if (original) {
			await Cache.savePoll({ ...original, repollId: poll.id, updatedAt: now });
		}
	}
	return poll;
}

export async function updateStoredPollStatus(
	pollId: string,
	status: PollStatus,
	note: string | null,
	now = Date.now()
): Promise<PollRecord | { error: string }> {
	const poll = await Cache.getPoll(pollId);
	if (!poll) return { error: 'That poll could not be found.' };
	if (!isPollStillUpdateable(poll)) {
		return { error: `This poll can no longer be updated (it is ${poll.status}).` };
	}
	if (!isAllowedUpdateTarget(status)) {
		return { error: 'Status must be In progress, Done, or Rejected.' };
	}
	const updated: PollRecord = {
		...poll,
		status,
		note: note && note.trim() ? note.trim().slice(0, 200) : poll.note,
		updatedAt: now
	};
	await Cache.savePoll(updated);
	await updatePollMessage(updated);
	return updated;
}

export async function deleteStoredPoll(pollId: string): Promise<{ error: string } | { ok: true; question: string }> {
	const poll = await Cache.getPoll(pollId);
	if (!poll) return { error: 'That poll could not be found.' };
	try {
		await globalClient.deleteMessage(poll.channelId, poll.messageId);
	} catch (err) {
		const status = typeof err === 'object' && err && 'status' in err ? Number((err as { status?: number }).status) : 0;
		if (status !== 404) Logging.logError(err as Error);
	}
	await Cache.deletePoll(pollId);
	return { ok: true, question: poll.question };
}

export async function processPollTicker(now = Date.now()): Promise<void> {
	if (!globalConfig.isProduction) return;
	const polls = await Cache.listPolls();
	for (const poll of polls) {
		if (poll.status === 'Open' && now >= poll.closesAt) {
			await snapshotAndClosePoll(poll, now);
		} else if (poll.status === 'Repoll') {
			await expireRepollWindow(poll, now);
		}
	}
	if (shouldPostWeeklyPollReminder(now)) {
		await postWeeklyPollReminder(now);
	}
}

async function findStaffChannelId(guildId: string): Promise<string | null> {
	const channels = (await globalClient.rest.get(Routes.guildChannels(guildId))) as {
		id: string;
		name?: string | null;
	}[];
	const byId = channels.find(channel => channel.id === POLL_STAFF_CHANNEL_ID);
	if (byId) return byId.id;
	const match = channels.find(channel => stringMatches(channel.name ?? '', POLL_STAFF_CHANNEL_NAME));
	return match?.id ?? null;
}

async function findStaffRoleIds(guildId: string): Promise<string[]> {
	const roles = await globalClient.fetchRolesOfGuild(guildId);
	return roles
		.filter(role => POLL_STAFF_ROLE_NAMES.some(name => stringMatches(role.name, name)))
		.map(role => role.id);
}

export async function postWeeklyPollReminder(now = Date.now()): Promise<boolean> {
	const weekId = weeklyPollReminderWeekId(now);
	const claimed = await Cache.tryClaimPollWeeklyReminder(weekId);
	if (!claimed) return false;

	try {
		const guildId = globalConfig.supportServerID;
		const channelId = await findStaffChannelId(guildId);
		if (!channelId) {
			await Cache.releasePollWeeklyReminder(weekId);
			Logging.logError(new Error(`Could not find #${POLL_STAFF_CHANNEL_NAME} for the weekly poll reminder.`));
			return false;
		}
		const roleIds = await findStaffRoleIds(guildId);
		const polls = (await Cache.listPolls()).filter(
			poll => poll.guildId === guildId && (poll.status === 'Passed' || poll.status === 'In progress')
		);
		const lines =
			polls.length === 0
				? 'No passed or in-progress polls right now.'
				: polls
						.sort((a, b) => b.updatedAt - a.updatedAt)
						.map(poll => {
							const title = truncatePollText(poll.question, 80);
							const pct = poll.percent === null ? '' : ` (${poll.percent.toFixed(1)}% yes)`;
							return `- [${title}](https://discord.com/channels/${poll.guildId}/${poll.channelId}/${poll.messageId}) — ${poll.status}${pct}`;
						})
						.join('\n');
		const mentions = [`<@${POLL_DJ_USER_ID}>`, ...roleIds.map(id => `<@&${id}>`)].join(' ');
		const content = `${mentions}\n**Weekly poll reminder**\n${lines}`.slice(0, 1900);
		await globalClient.sendMessage(channelId, {
			content,
			allowedMentions: { parse: [], users: [POLL_DJ_USER_ID], roles: roleIds }
		});
		return true;
	} catch (err) {
		await Cache.releasePollWeeklyReminder(weekId);
		Logging.logError(err as Error);
		return false;
	}
}

export function pollSelectOptions(polls: PollRecord[]) {
	return polls.slice(0, 25).map(poll => ({
		label: truncatePollText(`${poll.status}: ${poll.question}`, 100),
		description: truncatePollText(
			poll.percent === null ? poll.status : `${poll.percent.toFixed(1)}% yes`,
			100
		),
		value: poll.id
	}));
}

export function pollPickSelectRow(polls: PollRecord[]) {
	return {
		type: 1 as const,
		components: [
			{
				type: 3 as const,
				custom_id: POLL_UPDATE_PICK_ID,
				placeholder: 'Select a poll to update',
				min_values: 1,
				max_values: 1,
				options: pollSelectOptions(polls)
			}
		]
	};
}

export function pollStatusSelectRow(pollId: string) {
	return {
		type: 1 as const,
		components: [
			{
				type: 3 as const,
				custom_id: `${POLL_UPDATE_STATUS_PREFIX}${pollId}`,
				placeholder: 'Set the new status',
				min_values: 1,
				max_values: 1,
				options: POLL_UPDATE_TARGET_STATUSES.map(status => ({
					label: status,
					value: status
				}))
			}
		]
	};
}

export function pendingUpdateNote(note?: string | null): string | null {
	const trimmed = note?.trim() ?? '';
	return trimmed ? trimmed.slice(0, 200) : null;
}

export async function replyWithRawInteractionMessage(
	interactionId: string,
	token: string,
	data: Record<string, unknown>,
	type: InteractionResponseType = InteractionResponseType.ChannelMessageWithSource
): Promise<void> {
	await globalClient.rest.post(Routes.interactionCallback(interactionId, token), {
		body: { type, data }
	});
}

export async function handlePollUpdateComponent(itx: {
	id: string;
	token: string;
	userId: string;
	guildId: string | null;
	roleIds: string[] | undefined;
	customId: string;
	values: string[];
}): Promise<boolean> {
	const isPick = itx.customId === POLL_UPDATE_PICK_ID;
	const isStatus = itx.customId.startsWith(POLL_UPDATE_STATUS_PREFIX);
	if (!isPick && !isStatus) return false;

	const allowed = await userCanUpdatePolls(itx.userId, itx.guildId, itx.roleIds);
	if (!allowed) {
		await replyWithRawInteractionMessage(
			itx.id,
			itx.token,
			{
				content: 'Only DJ or members with the Developer or Contributor role can update polls.',
				components: [],
				flags: MessageFlags.Ephemeral
			},
			InteractionResponseType.UpdateMessage
		);
		return true;
	}

	if (isPick) {
		const pollId = itx.values[0];
		const poll = pollId ? await Cache.getPoll(pollId) : null;
		if (!poll || !isPollStillUpdateable(poll)) {
			await replyWithRawInteractionMessage(
				itx.id,
				itx.token,
				{
					content: 'That poll can no longer be updated. Run /poll update again to see the current list.',
					components: [],
					flags: MessageFlags.Ephemeral
				},
				InteractionResponseType.UpdateMessage
			);
			return true;
		}
		const title = truncatePollText(poll.question, 80);
		const pct = poll.percent === null ? poll.status : `${poll.percent.toFixed(1)}% yes, ${poll.status}`;
		await replyWithRawInteractionMessage(
			itx.id,
			itx.token,
			{
				content: `Update **${title}** (${pct}). Choose the new status:`,
				components: [pollStatusSelectRow(poll.id)],
				flags: MessageFlags.Ephemeral
			},
			InteractionResponseType.UpdateMessage
		);
		return true;
	}

	const pollId = itx.customId.slice(POLL_UPDATE_STATUS_PREFIX.length);
	const status = itx.values[0];
	if (!status || !isAllowedUpdateTarget(status)) {
		await replyWithRawInteractionMessage(
			itx.id,
			itx.token,
			{
				content: 'Status must be In progress, Done, or Rejected.',
				components: [],
				flags: MessageFlags.Ephemeral
			},
			InteractionResponseType.UpdateMessage
		);
		return true;
	}

	const note = pendingUpdateNote(await Cache.getPollUpdateNote(itx.userId));
	const result = await updateStoredPollStatus(pollId, status, note);
	await Cache.clearPollUpdateNote(itx.userId);
	if ('error' in result) {
		await replyWithRawInteractionMessage(
			itx.id,
			itx.token,
			{
				content: result.error,
				components: [],
				flags: MessageFlags.Ephemeral
			},
			InteractionResponseType.UpdateMessage
		);
		return true;
	}

	const noteText = result.note ? ` Note: ${result.note}` : '';
	await replyWithRawInteractionMessage(
		itx.id,
		itx.token,
		{
			content: `Updated **${truncatePollText(result.question, 80)}** to **${result.status}**.${noteText}`,
			components: [],
			flags: MessageFlags.Ephemeral
		},
		InteractionResponseType.UpdateMessage
	);
	return true;
}

