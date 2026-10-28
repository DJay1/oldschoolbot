import { roleMention, userMention } from '@oldschoolgg/discord';
import { DiscordSnowflake } from '@sapphire/snowflake';

import {
	configuredThreadId,
	findQualityCheckItem,
	type QualityCheckBountyStatus,
	type QualityCheckItem,
	qualityCheckCampaign,
	qualityCheckConfig
} from '@/lib/qualityChecks/config.js';
import {
	createBountyThread,
	editBountyStarter,
	ensureBountyTags,
	ensureQualityCheckRoleMentionable,
	type ForumMessage,
	type ForumThreadPayload,
	fetchThreadMessages,
	isMissingDiscordResource,
	listForumThreads,
	loadForumChannel,
	oldestMessage,
	QualityCheckBoardError,
	readThread,
	sendThreadMessage,
	setThreadStatusTag,
	statusFromAppliedTags
} from '@/lib/qualityChecks/forum.js';
import { isImageAttachment, latestClaimerId, matchBountyItem } from '@/lib/qualityChecks/parse.js';
import { renderBountyPost } from '@/lib/qualityChecks/render.js';
import {
	closeQualityCheckCampaignRecord,
	getQualityCheckBounty,
	getQualityCheckCampaign,
	getQualityCheckLeaderboard,
	listQualityCheckBounties,
	markQualityCheckReminded,
	openQualityCheckCampaign,
	type StoredBounty,
	saveQualityCheckBounty
} from '@/lib/qualityChecks/store.js';

interface DiscoveredThread {
	thread: ForumThreadPayload;
	messages: ForumMessage[];
	starter: ForumMessage | null;
	itemId: string;
}

function djMentions(): { text: string; userIds: string[] } {
	const userIds = qualityCheckConfig.djUserId ? [qualityCheckConfig.djUserId] : [];
	const text = [roleMention(qualityCheckConfig.roleId), ...userIds.map(id => userMention(id))].join(' ');
	return { text, userIds };
}

function viewFrom(status: QualityCheckBountyStatus, claimerId: string | null, reviewNote: string | null) {
	return { status, claimerId, reviewNote };
}

async function requireOpenCampaign() {
	const campaign = await getQualityCheckCampaign();
	if (!campaign || campaign.closed_at) {
		throw new QualityCheckBoardError('This quality-check campaign is closed. Staff can post it again.');
	}
	return campaign;
}

function canCheck(user: MUser, roles: readonly string[]): boolean {
	return user.isAdmin() || user.isMod() || roles.includes(qualityCheckConfig.roleId);
}

function evidenceMessage(
	messages: readonly ForumMessage[],
	claimerId: string,
	claimedAt: Date | null
): ForumMessage | null {
	for (const message of messages) {
		if (message.bot || message.authorId !== claimerId) continue;
		if (!message.attachments.some(attachment => isImageAttachment(attachment))) continue;
		if (claimedAt) {
			const createdAt = DiscordSnowflake.timestampFrom(message.id);
			if (createdAt + 5000 < claimedAt.getTime()) continue;
		}
		return message;
	}
	return null;
}

async function publishView(input: {
	item: QualityCheckItem;
	threadId: string;
	starterMessageId: string | null;
	appliedTagIds: readonly string[] | undefined;
	tagIds: Record<QualityCheckBountyStatus, string>;
	status: QualityCheckBountyStatus;
	claimerId: string | null;
	reviewNote: string | null;
}): Promise<string | null> {
	const rendered = renderBountyPost(input.item, viewFrom(input.status, input.claimerId, input.reviewNote));
	await setThreadStatusTag({
		threadId: input.threadId,
		appliedTagIds: input.appliedTagIds,
		tagIds: input.tagIds,
		status: input.status
	});
	return editBountyStarter({
		threadId: input.threadId,
		starterMessageId: input.starterMessageId,
		content: rendered.content,
		buttons: rendered.buttons
	});
}

async function discoverThreads(stored: StoredBounty[]): Promise<Map<string, DiscoveredThread>> {
	const listed = await listForumThreads();
	const byId = new Map(listed.map(thread => [thread.id, thread]));
	const queue: ForumThreadPayload[] = [];
	const seen = new Set<string>();
	const push = (thread: ForumThreadPayload) => {
		if (seen.has(thread.id)) return;
		seen.add(thread.id);
		queue.push(thread);
	};
	for (const bounty of stored) {
		if (!bounty.threadId) continue;
		push(byId.get(bounty.threadId) ?? { id: bounty.threadId, parent_id: qualityCheckConfig.channelId });
	}
	for (const item of qualityCheckCampaign.items) {
		const configured = configuredThreadId(item.id);
		if (!configured) continue;
		push(byId.get(configured) ?? { id: configured, parent_id: qualityCheckConfig.channelId });
	}
	for (const thread of listed) push(thread);

	const found = new Map<string, DiscoveredThread>();
	let fetched = 0;
	for (const candidate of queue) {
		if (found.size >= qualityCheckCampaign.items.length || fetched >= 40) break;
		fetched++;
		let thread = candidate;
		if (!thread.applied_tags) {
			const hydrated = await readThread(thread.id);
			if (!hydrated) continue;
			thread = { ...hydrated, applied_tags: hydrated.applied_tags ?? [] };
		}
		if (thread.parent_id && thread.parent_id !== qualityCheckConfig.channelId) continue;
		let messages: ForumMessage[] = [];
		try {
			messages = await fetchThreadMessages(thread.id);
		} catch (err) {
			if (!isMissingDiscordResource(err)) {
				Logging.logError(err as Error, { type: 'QUALITY_CHECK_MESSAGES', thread_id: thread.id });
			}
			continue;
		}
		const starter = oldestMessage(messages);
		const storedItem = stored.find(bounty => bounty.threadId === thread.id)?.itemId ?? null;
		const envItem = qualityCheckCampaign.items.find(item => configuredThreadId(item.id) === thread.id)?.id ?? null;
		const itemId = storedItem ?? envItem ?? matchBountyItem(starter?.content ?? '', thread.name);
		if (!itemId || !findQualityCheckItem(itemId) || found.has(itemId)) continue;
		found.set(itemId, { thread, messages, starter, itemId });
	}
	return found;
}

export async function postQualityCheckBoard(): Promise<string> {
	const mentionable = await ensureQualityCheckRoleMentionable();
	const forum = await loadForumChannel();
	const tagIds = await ensureBountyTags(forum);
	await openQualityCheckCampaign(qualityCheckConfig.channelId);
	const stored = await listQualityCheckBounties();
	const discovered = await discoverThreads(stored);
	const lines: string[] = [];
	const failures: string[] = [];
	let created = 0;
	for (const item of qualityCheckCampaign.items) {
		try {
			const existing = stored.find(bounty => bounty.itemId === item.id) ?? null;
			const known = discovered.get(item.id);
			const tagStatus = known ? statusFromAppliedTags(known.thread.applied_tags, tagIds) : null;
			const status = existing?.status ?? tagStatus ?? 'open';
			let claimerId = existing?.claimerId ?? null;
			if (!claimerId && known && status !== 'open') {
				const ordered = [...known.messages].sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
				claimerId = latestClaimerId(ordered.map(message => message.content));
			}
			if (status === 'open') claimerId = null;
			const reviewNote = existing?.reviewNote ?? null;
			const rendered = renderBountyPost(item, viewFrom(status, claimerId, reviewNote));
			let threadId = known?.thread.id ?? existing?.threadId ?? configuredThreadId(item.id);
			let starterMessageId = known?.starter?.id ?? existing?.starterMessageId ?? null;
			let applied = known?.thread.applied_tags;
			if (!threadId) {
				const createdThread = await createBountyThread({
					name: item.label,
					content: rendered.content,
					buttons: rendered.buttons,
					tagId: tagIds[status]
				});
				threadId = createdThread.threadId;
				starterMessageId = createdThread.starterMessageId;
				applied = [tagIds[status]];
				created++;
			}
			starterMessageId = await publishView({
				item,
				threadId,
				starterMessageId,
				appliedTagIds: applied,
				tagIds,
				status,
				claimerId,
				reviewNote
			});
			await saveQualityCheckBounty({
				itemId: item.id,
				threadId,
				starterMessageId,
				status,
				claimerId,
				claimedAt: existing?.claimedAt ?? null,
				reviewerId: existing?.reviewerId ?? null,
				reviewNote,
				evidenceMessageId: existing?.evidenceMessageId ?? null
			});
			lines.push(`\`${item.id}\` → \`${threadId}\``);
		} catch (err) {
			Logging.logError(err as Error, { type: 'QUALITY_CHECK_POST', item_id: item.id });
			const reason = err instanceof QualityCheckBoardError ? err.message : 'could not update that post';
			failures.push(`\`${item.id}\`: ${reason}`);
		}
	}
	let updatesNote = '';
	if (created > 0 && qualityCheckConfig.updatesChannelId !== qualityCheckConfig.channelId) {
		try {
			await globalClient.sendMessage(qualityCheckConfig.updatesChannelId, {
				content: `Quality-check bounties are open in <#${qualityCheckConfig.channelId}>.`,
				allowedMentions: { parse: [], roles: [], users: [] }
			});
			updatesNote = ` Notice posted in <#${qualityCheckConfig.updatesChannelId}>.`;
		} catch (err) {
			Logging.logError(err as Error, { type: 'QUALITY_CHECK_UPDATES' });
			updatesNote = ' Could not post a notice in the updates channel.';
		}
	}
	const mentionNote = mentionable
		? ''
		: ' The Quality Checkers role could not be set mentionable, so the Done ping may not notify anyone.';
	const failureNote = failures.length > 0 ? `\nFailed: ${failures.join('; ')}` : '';
	return `Bounty threads in <#${qualityCheckConfig.channelId}>:\n${lines.join('\n')}${failureNote}${updatesNote}${mentionNote}`;
}

export async function syncQualityCheckBoard(): Promise<string> {
	const forum = await loadForumChannel();
	const tagIds = await ensureBountyTags(forum);
	const stored = await listQualityCheckBounties();
	const discovered = await discoverThreads(stored);
	const lines: string[] = [];
	for (const item of qualityCheckCampaign.items) {
		const known = discovered.get(item.id);
		const existing = stored.find(bounty => bounty.itemId === item.id) ?? null;
		if (!known && !existing?.threadId && !configuredThreadId(item.id)) {
			lines.push(`\`${item.id}\`: no thread yet`);
			continue;
		}
		const threadId = known?.thread.id ?? existing?.threadId ?? configuredThreadId(item.id);
		if (!threadId) continue;
		const messages = known?.messages ?? [];
		const ordered = [...messages].sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
		const tagStatus = known ? statusFromAppliedTags(known.thread.applied_tags, tagIds) : null;
		const status = tagStatus ?? existing?.status ?? 'open';
		let claimerId = latestClaimerId(ordered.map(message => message.content)) ?? existing?.claimerId ?? null;
		if (status === 'open') claimerId = null;
		const evidence = claimerId ? evidenceMessage(messages, claimerId, existing?.claimedAt ?? null) : null;
		const reviewNote = existing?.reviewNote ?? null;
		let starterMessageId = known?.starter?.id ?? existing?.starterMessageId ?? null;
		try {
			starterMessageId = await publishView({
				item,
				threadId,
				starterMessageId,
				appliedTagIds: known?.thread.applied_tags,
				tagIds,
				status,
				claimerId,
				reviewNote
			});
		} catch (err) {
			Logging.logError(err as Error, { type: 'QUALITY_CHECK_SYNC', item_id: item.id });
		}
		await saveQualityCheckBounty({
			itemId: item.id,
			threadId,
			starterMessageId,
			status,
			claimerId,
			claimedAt: status === 'open' ? null : (existing?.claimedAt ?? (claimerId ? new Date() : null)),
			reviewerId: existing?.reviewerId ?? null,
			reviewNote,
			evidenceMessageId: evidence?.id ?? existing?.evidenceMessageId ?? null
		});
		const who = claimerId ? ` ${userMention(claimerId)}` : '';
		lines.push(`\`${item.id}\`: \`${status}\` \`${threadId}\`${who}`);
	}
	return `Synced bounty threads:\n${lines.join('\n')}`;
}

async function loadTagIds() {
	const forum = await loadForumChannel();
	return ensureBountyTags(forum);
}

export async function claimQualityCheckBounty(user: MUser, itemId: string, roles: readonly string[]): Promise<string> {
	if (!canCheck(user, roles)) {
		throw new QualityCheckBoardError('Only Quality Checkers or staff can claim a bounty.');
	}
	await requireOpenCampaign();
	const item = findQualityCheckItem(itemId);
	if (!item) throw new QualityCheckBoardError('Unknown bounty.');
	const bounty = await getQualityCheckBounty(item.id);
	if (!bounty?.threadId)
		throw new QualityCheckBoardError('That bounty has no forum post yet. Staff need to post the board.');
	if (bounty.status === 'passed') throw new QualityCheckBoardError('This bounty is already confirmed.');
	if (bounty.status === 'claimed' || bounty.status === 'needs-DJ') {
		const who = bounty.claimerId ? userMention(bounty.claimerId) : 'someone else';
		throw new QualityCheckBoardError(`Already taken by ${who}.`);
	}
	const tagIds = await loadTagIds();
	const claimedAt = new Date();
	const starterMessageId = await publishView({
		item,
		threadId: bounty.threadId,
		starterMessageId: bounty.starterMessageId,
		appliedTagIds: undefined,
		tagIds,
		status: 'claimed',
		claimerId: user.id,
		reviewNote: null
	});
	await sendThreadMessage(
		bounty.threadId,
		`Claimed by ${userMention(user.id)}. Upload a screenshot in this thread, then click Done.`,
		[user.id]
	);
	await saveQualityCheckBounty({
		itemId: item.id,
		threadId: bounty.threadId,
		starterMessageId,
		status: 'claimed',
		claimerId: user.id,
		claimedAt,
		reviewerId: null,
		reviewNote: null,
		evidenceMessageId: null
	});
	return `You claimed **${item.label}**. Upload a screenshot in the thread, then click Done.`;
}

export async function submitQualityCheckBounty(user: MUser, itemId: string, roles: readonly string[]): Promise<string> {
	const item = findQualityCheckItem(itemId);
	if (!item) throw new QualityCheckBoardError('Unknown bounty.');
	const bounty = await getQualityCheckBounty(item.id);
	if (!bounty?.threadId) throw new QualityCheckBoardError('That bounty has no forum post yet.');
	if (bounty.status !== 'claimed') throw new QualityCheckBoardError('Claim this bounty before you click Done.');
	const staff = user.isAdmin() || user.isMod();
	if (bounty.claimerId !== user.id && !staff) {
		throw new QualityCheckBoardError('Only the person who claimed this bounty can click Done.');
	}
	if (!canCheck(user, roles) && !staff) {
		throw new QualityCheckBoardError('Only Quality Checkers or staff can submit a bounty.');
	}
	const claimerId = bounty.claimerId;
	if (!claimerId) throw new QualityCheckBoardError('Nobody is recorded as the claimer.');
	const messages = await fetchThreadMessages(bounty.threadId);
	const evidence = evidenceMessage(messages, claimerId, bounty.claimedAt);
	if (!evidence) {
		throw new QualityCheckBoardError('Upload a screenshot in this thread after you claim it, then click Done.');
	}
	const tagIds = await loadTagIds();
	const starterMessageId = await publishView({
		item,
		threadId: bounty.threadId,
		starterMessageId: bounty.starterMessageId,
		appliedTagIds: undefined,
		tagIds,
		status: 'needs-DJ',
		claimerId,
		reviewNote: bounty.reviewNote
	});
	const ping = djMentions();
	await ensureQualityCheckRoleMentionable();
	await sendThreadMessage(
		bounty.threadId,
		`${ping.text} Ready for DJ to confirm **${item.label}**. Credit is not counted until Confirm.`,
		ping.userIds
	);
	await saveQualityCheckBounty({
		itemId: item.id,
		threadId: bounty.threadId,
		starterMessageId,
		status: 'needs-DJ',
		claimerId,
		claimedAt: bounty.claimedAt,
		reviewerId: null,
		reviewNote: bounty.reviewNote,
		evidenceMessageId: evidence.id
	});
	return `Submitted **${item.label}** for DJ. Credit is not counted yet.`;
}

export async function confirmQualityCheckBounty(user: MUser, itemId: string): Promise<string> {
	if (!user.isAdmin() && !user.isMod()) throw new QualityCheckBoardError('Only staff can confirm a bounty.');
	const item = findQualityCheckItem(itemId);
	if (!item) throw new QualityCheckBoardError('Unknown bounty.');
	const bounty = await getQualityCheckBounty(item.id);
	if (!bounty?.threadId) throw new QualityCheckBoardError('That bounty has no forum post yet.');
	if (bounty.status !== 'needs-DJ') throw new QualityCheckBoardError('This bounty is not waiting for DJ.');
	if (!bounty.claimerId)
		throw new QualityCheckBoardError('Nobody has claimed this bounty, so there is nobody to credit.');
	const tagIds = await loadTagIds();
	const starterMessageId = await publishView({
		item,
		threadId: bounty.threadId,
		starterMessageId: bounty.starterMessageId,
		appliedTagIds: undefined,
		tagIds,
		status: 'passed',
		claimerId: bounty.claimerId,
		reviewNote: null
	});
	await sendThreadMessage(
		bounty.threadId,
		`Confirmed by ${userMention(user.id)}. Credit recorded for ${userMention(bounty.claimerId)}.`,
		[user.id, bounty.claimerId]
	);
	await saveQualityCheckBounty({
		itemId: item.id,
		threadId: bounty.threadId,
		starterMessageId,
		status: 'passed',
		claimerId: bounty.claimerId,
		claimedAt: bounty.claimedAt,
		reviewerId: user.id,
		reviewNote: null,
		evidenceMessageId: bounty.evidenceMessageId
	});
	return `Confirmed **${item.label}**. Credit recorded for ${userMention(bounty.claimerId)}.`;
}

export async function rejectQualityCheckBounty(user: MUser, itemId: string, note?: string | null): Promise<string> {
	if (!user.isAdmin() && !user.isMod()) throw new QualityCheckBoardError('Only staff can reject a bounty.');
	const item = findQualityCheckItem(itemId);
	if (!item) throw new QualityCheckBoardError('Unknown bounty.');
	const bounty = await getQualityCheckBounty(item.id);
	if (!bounty?.threadId) throw new QualityCheckBoardError('That bounty has no forum post yet.');
	if (bounty.status !== 'needs-DJ') throw new QualityCheckBoardError('This bounty is not waiting for DJ.');
	const reviewNote = note?.trim() ? note.trim().slice(0, 400) : null;
	const tagIds = await loadTagIds();
	const starterMessageId = await publishView({
		item,
		threadId: bounty.threadId,
		starterMessageId: bounty.starterMessageId,
		appliedTagIds: undefined,
		tagIds,
		status: 'failed',
		claimerId: bounty.claimerId,
		reviewNote
	});
	const reason = reviewNote ? ` ${reviewNote}` : '';
	await sendThreadMessage(
		bounty.threadId,
		`Rejected by ${userMention(user.id)}.${reason} No credit was recorded. Claim it again after the check is fixed.`,
		[user.id, ...(bounty.claimerId ? [bounty.claimerId] : [])]
	);
	await saveQualityCheckBounty({
		itemId: item.id,
		threadId: bounty.threadId,
		starterMessageId,
		status: 'failed',
		claimerId: bounty.claimerId,
		claimedAt: bounty.claimedAt,
		reviewerId: user.id,
		reviewNote,
		evidenceMessageId: bounty.evidenceMessageId
	});
	return `Rejected **${item.label}**. No credit was recorded.`;
}

export async function qualityCheckStatusText(): Promise<string> {
	const campaign = await getQualityCheckCampaign();
	const bounties = await listQualityCheckBounties();
	const lines = [
		`**${qualityCheckCampaign.title}** (\`${qualityCheckCampaign.id}\`)`,
		campaign
			? campaign.closed_at
				? 'Campaign is closed.'
				: 'Campaign is open.'
			: 'Board has not been posted yet.',
		'Tags: `open` `claimed` `needs-DJ` `passed` `failed`. Credit is the `passed` tag only.'
	];
	for (const item of qualityCheckCampaign.items) {
		const bounty = bounties.find(entry => entry.itemId === item.id);
		if (!bounty) {
			lines.push(`**${item.label}** (\`${item.id}\`) — not posted`);
			continue;
		}
		const who = bounty.claimerId ? ` ${userMention(bounty.claimerId)}` : '';
		const link = bounty.threadId
			? ` https://discord.com/channels/${qualityCheckConfig.guildId}/${bounty.threadId}`
			: '';
		lines.push(`**${item.label}** \`${bounty.status}\`${who}${link}`);
	}
	return lines.join('\n');
}

export async function qualityCheckLeaderboardText(): Promise<string> {
	const rows = await getQualityCheckLeaderboard(qualityCheckCampaign.id, 10);
	const lines = [
		`**Confirmed quality-check credits** (\`${qualityCheckCampaign.id}\`)`,
		'Only DJ confirms count. Rejected bounties are not included.'
	];
	if (rows.length === 0) {
		lines.push('No confirmed credits yet.');
		return lines.join('\n');
	}
	for (const [index, row] of rows.entries()) {
		lines.push(`${index + 1}. ${userMention(row.userId)} — ${row.credits} confirmed`);
	}
	return lines.join('\n');
}

export async function closeQualityCheckCampaign(): Promise<string> {
	const existing = await getQualityCheckCampaign();
	if (!existing || existing.closed_at) return 'There is no open quality-check campaign.';
	await closeQualityCheckCampaignRecord();
	return `Closed quality-check campaign \`${qualityCheckCampaign.id}\`. Reminders will stay quiet. DJ can still confirm a bounty that is already waiting.`;
}

export function qualityCheckStaffDenial(user: MUser, guildId: string | null): string | null {
	if (!user.isAdmin() && !user.isMod()) return 'Only staff can use this command.';
	if (guildId !== qualityCheckConfig.guildId) return 'Run this command in the configured quality-check server.';
	return null;
}

/** Quiet reminder in #updates. No-op when the ticker is off, the campaign is closed, or every bounty is passed. */
export async function remindQualityChecksIfNeeded(): Promise<void> {
	if (qualityCheckConfig.tickerIntervalMinutes <= 0) return;
	const campaign = await getQualityCheckCampaign();
	if (!campaign || campaign.closed_at) return;
	const bounties = await listQualityCheckBounties();
	const waiting = qualityCheckCampaign.items.filter(item => {
		const bounty = bounties.find(entry => entry.itemId === item.id);
		return bounty?.status !== 'passed';
	});
	if (waiting.length === 0) return;
	const intervalMs = qualityCheckConfig.tickerIntervalMinutes * 60_000;
	if (campaign.last_reminded_at && Date.now() - campaign.last_reminded_at.getTime() < intervalMs) return;
	const ping = djMentions();
	await ensureQualityCheckRoleMentionable();
	const names = waiting.map(item => `\`${item.id}\``).join(', ');
	await globalClient.sendMessage(qualityCheckConfig.updatesChannelId, {
		content: `${ping.text} ${waiting.length} quality-check bounties are still short of a DJ confirm: ${names}.`,
		allowedMentions: { parse: [], roles: [qualityCheckConfig.roleId], users: ping.userIds }
	});
	await markQualityCheckReminded();
}
