import { DiscordAPIError } from '@discordjs/rest';
import { type APIRole, type ButtonBuilder, ChannelType, Routes } from '@oldschoolgg/discord';

import { QUALITY_CHECK_TAGS, type QualityCheckBountyStatus, qualityCheckConfig } from '@/lib/qualityChecks/config.js';
import { bountyStatusFromTagNames } from '@/lib/qualityChecks/parse.js';

export class QualityCheckBoardError extends Error {}

interface ForumTag {
	id: string;
	name: string;
	moderated?: boolean;
	emoji_id?: string | null;
	emoji_name?: string | null;
}

interface ForumChannelPayload {
	id: string;
	type: number;
	available_tags?: ForumTag[];
}

export interface ForumThreadPayload {
	id: string;
	name?: string | null;
	parent_id?: string | null;
	applied_tags?: string[];
	last_message_id?: string | null;
	thread_metadata?: { archive_timestamp?: string; archived?: boolean };
}

export interface ForumAttachment {
	filename?: string;
	content_type?: string;
	width?: number | null;
}

export interface ForumMessage {
	id: string;
	content: string;
	authorId: string;
	bot: boolean;
	attachments: ForumAttachment[];
}

const MISSING_RESOURCE_CODES = new Set([10003, 10008]);

export function isMissingDiscordResource(err: unknown): boolean {
	if (!(err instanceof DiscordAPIError)) return false;
	const code = typeof err.code === 'number' ? err.code : Number(err.code);
	return MISSING_RESOURCE_CODES.has(code);
}

function actionRows(buttons: ButtonBuilder[]) {
	const rows: { type: 1; components: ReturnType<ButtonBuilder['toJSON']>[] }[] = [];
	for (let index = 0; index < buttons.length; index += 5) {
		rows.push({
			type: 1,
			components: buttons.slice(index, index + 5).map(button => button.toJSON())
		});
	}
	return rows;
}

function readMessage(raw: unknown): ForumMessage | null {
	if (!raw || typeof raw !== 'object') return null;
	const message = raw as {
		id?: string;
		content?: string;
		author?: { id?: string; bot?: boolean };
		author_id?: string;
		attachments?: ForumAttachment[];
	};
	const authorId = message.author?.id ?? message.author_id;
	if (!message.id || !authorId) return null;
	return {
		id: message.id,
		content: message.content ?? '',
		authorId,
		bot: Boolean(message.author?.bot),
		attachments: message.attachments ?? []
	};
}

export async function ensureQualityCheckRoleMentionable(): Promise<boolean> {
	try {
		const role = (await globalClient.rest.get(
			Routes.guildRole(qualityCheckConfig.guildId, qualityCheckConfig.roleId)
		)) as APIRole;
		if (role.mentionable) return true;
		await globalClient.rest.patch(Routes.guildRole(qualityCheckConfig.guildId, qualityCheckConfig.roleId), {
			body: { mentionable: true }
		});
		return true;
	} catch (err) {
		Logging.logError(err as Error, { type: 'QUALITY_CHECK_ROLE' });
		return false;
	}
}

export async function loadForumChannel(): Promise<ForumChannelPayload> {
	let channel: ForumChannelPayload;
	try {
		channel = (await globalClient.rest.get(Routes.channel(qualityCheckConfig.channelId))) as ForumChannelPayload;
	} catch (err) {
		Logging.logError(err as Error, { type: 'QUALITY_CHECK_FORUM' });
		throw new QualityCheckBoardError(
			'Could not read the quality-checks channel. Check the channel id and that the bot can view it.'
		);
	}
	if (channel.type !== ChannelType.GuildForum) {
		throw new QualityCheckBoardError(
			'The quality-checks channel must be a Forum (tags open, claimed, needs-DJ, passed, failed). Convert it, then run /qualitycheck post again.'
		);
	}
	return channel;
}

export async function ensureBountyTags(
	channel: ForumChannelPayload
): Promise<Record<QualityCheckBountyStatus, string>> {
	const tags = channel.available_tags ?? [];
	const missing = QUALITY_CHECK_TAGS.filter(name => !tags.some(tag => tag.name === name));
	let available = tags;
	if (missing.length > 0) {
		try {
			const updated = (await globalClient.rest.patch(Routes.channel(channel.id), {
				body: {
					available_tags: [
						...tags.map(tag => ({
							id: tag.id,
							name: tag.name,
							moderated: Boolean(tag.moderated),
							emoji_id: tag.emoji_id ?? null,
							emoji_name: tag.emoji_name ?? null
						})),
						...missing.map(name => ({ name, moderated: true }))
					]
				}
			})) as ForumChannelPayload;
			available = updated.available_tags ?? [];
		} catch (err) {
			Logging.logError(err as Error, { type: 'QUALITY_CHECK_TAGS' });
			throw new QualityCheckBoardError(
				`Missing forum tags: ${missing.join(', ')}. Add those exact names, or give the bot Manage Channels so it can add them.`
			);
		}
	}
	const ids = {} as Record<QualityCheckBountyStatus, string>;
	for (const name of QUALITY_CHECK_TAGS) {
		const tag = available.find(entry => entry.name === name);
		if (!tag?.id) {
			throw new QualityCheckBoardError(`Forum tag "${name}" is missing after the update.`);
		}
		ids[name] = tag.id;
	}
	return ids;
}

export function statusFromAppliedTags(
	appliedTagIds: readonly string[] | undefined,
	tagIds: Record<QualityCheckBountyStatus, string>
): QualityCheckBountyStatus | null {
	const names = (appliedTagIds ?? []).flatMap(id => {
		const match = QUALITY_CHECK_TAGS.find(name => tagIds[name] === id);
		return match ? [match] : [];
	});
	return bountyStatusFromTagNames(names);
}

export async function readThread(threadId: string): Promise<ForumThreadPayload | null> {
	try {
		return (await globalClient.rest.get(Routes.channel(threadId))) as ForumThreadPayload;
	} catch (err) {
		if (!isMissingDiscordResource(err)) {
			Logging.logError(err as Error, { type: 'QUALITY_CHECK_THREAD', thread_id: threadId });
		}
		return null;
	}
}

export async function listForumThreads(): Promise<ForumThreadPayload[]> {
	const collected: ForumThreadPayload[] = [];
	const seen = new Set<string>();
	const add = (threads: ForumThreadPayload[] | undefined) => {
		for (const thread of threads ?? []) {
			if (!thread?.id || thread.parent_id !== qualityCheckConfig.channelId || seen.has(thread.id)) continue;
			seen.add(thread.id);
			collected.push(thread);
		}
	};
	try {
		const active = (await globalClient.rest.get(Routes.guildActiveThreads(qualityCheckConfig.guildId))) as {
			threads?: ForumThreadPayload[];
		};
		add(active.threads);
	} catch (err) {
		Logging.logError(err as Error, { type: 'QUALITY_CHECK_THREADS' });
		throw new QualityCheckBoardError('Could not list active forum threads.');
	}
	let before: string | undefined;
	for (let page = 0; page < 3; page++) {
		const query = new URLSearchParams({ limit: '100' });
		if (before) query.set('before', before);
		const archived = (await globalClient.rest.get(Routes.channelThreads(qualityCheckConfig.channelId, 'public'), {
			query
		})) as { threads?: ForumThreadPayload[]; has_more?: boolean };
		add(archived.threads);
		if (!archived.has_more || !archived.threads?.length) break;
		const oldest = archived.threads[archived.threads.length - 1];
		const stamp = oldest?.thread_metadata?.archive_timestamp;
		if (!stamp || stamp === before) break;
		before = stamp;
	}
	return collected;
}

export async function fetchThreadMessages(threadId: string): Promise<ForumMessage[]> {
	const raw = (await globalClient.rest.get(Routes.channelMessages(threadId), {
		query: new URLSearchParams({ limit: '100' })
	})) as unknown[];
	if (!Array.isArray(raw)) return [];
	const messages: ForumMessage[] = [];
	for (const entry of raw) {
		const message = readMessage(entry);
		if (message) messages.push(message);
	}
	return messages;
}

export function oldestMessage(messages: readonly ForumMessage[]): ForumMessage | null {
	let oldest: ForumMessage | null = null;
	for (const message of messages) {
		if (!oldest || BigInt(message.id) < BigInt(oldest.id)) oldest = message;
	}
	return oldest;
}

export async function createBountyThread(input: {
	name: string;
	content: string;
	buttons: ButtonBuilder[];
	tagId: string;
}): Promise<{ threadId: string; starterMessageId: string | null }> {
	const created = (await globalClient.rest.post(Routes.threads(qualityCheckConfig.channelId), {
		body: {
			name: input.name.slice(0, 100),
			auto_archive_duration: 10080,
			applied_tags: [input.tagId],
			message: {
				content: input.content,
				components: actionRows(input.buttons),
				allowed_mentions: { parse: [], users: [], roles: [] }
			}
		}
	})) as ForumThreadPayload;
	if (!created?.id) throw new QualityCheckBoardError('Discord did not return a bounty thread id.');
	return { threadId: created.id, starterMessageId: created.last_message_id ?? null };
}

export async function editBountyStarter(input: {
	threadId: string;
	starterMessageId: string | null;
	content: string;
	buttons: ButtonBuilder[];
}): Promise<string | null> {
	let messageId = input.starterMessageId;
	if (!messageId) {
		const messages = await fetchThreadMessages(input.threadId);
		messageId = oldestMessage(messages)?.id ?? null;
	}
	if (!messageId) return null;
	await globalClient.rest.patch(Routes.channelMessage(input.threadId, messageId), {
		body: {
			content: input.content,
			components: actionRows(input.buttons),
			allowed_mentions: { parse: [], users: [], roles: [] }
		}
	});
	return messageId;
}

export async function setThreadStatusTag(input: {
	threadId: string;
	appliedTagIds: readonly string[] | undefined;
	tagIds: Record<QualityCheckBountyStatus, string>;
	status: QualityCheckBountyStatus;
}): Promise<void> {
	let current = input.appliedTagIds;
	if (!current) {
		const thread = (await globalClient.rest.get(Routes.channel(input.threadId))) as ForumThreadPayload;
		current = thread.applied_tags ?? [];
	}
	const statusIds = new Set(QUALITY_CHECK_TAGS.map(name => input.tagIds[name]));
	const kept = current.filter(id => !statusIds.has(id));
	const applied = [...kept, input.tagIds[input.status]].slice(0, 5);
	await globalClient.rest.patch(Routes.channel(input.threadId), {
		body: { applied_tags: applied, archived: false }
	});
}

export async function sendThreadMessage(threadId: string, content: string, mentionUserIds: string[]): Promise<void> {
	await globalClient.rest.post(Routes.channelMessages(threadId), {
		body: {
			content,
			allowed_mentions: {
				parse: [],
				roles: [qualityCheckConfig.roleId],
				users: mentionUserIds
			}
		}
	});
}
