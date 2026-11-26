import {
	ChannelType,
	EmbedBuilder,
	InteractionResponseType,
	MessageFlags,
	Routes,
	SpecialResponse
} from '@oldschoolgg/discord';

import { corgoDeniedReply } from '@/lib/bsc/corgoGifs.js';
import { staffGuildAllowed, staffTierOf } from '@/lib/bsc/staffAccess.js';
import { STAFF_TIER_NAMES, type StaffTier, tierAtLeast } from '@/lib/bsc/staffTiers.js';
import {
	actionPingsReporter,
	buildTicketOverwrites,
	buildTicketTranscript,
	type CleanTicketInput,
	cleanTicketLine,
	isTicketStatus,
	isTicketType,
	maskTicketOverwrite,
	type NewTicketInput,
	parseTicketCustomId,
	playerTicketLimitError,
	prepareNewTicket,
	readModalInputs,
	reporterHasChannelAccess,
	resolveTicketStaffRoleId,
	TICKET_ACTION_RULES,
	TICKET_INPUT_COMMAND,
	TICKET_INPUT_REASON,
	TICKET_INPUT_SCREENSHOT,
	TICKET_INPUT_WHAT,
	TICKET_MAX_ADDED_USERS,
	TICKET_MAX_OPEN_PER_PLAYER,
	TICKET_PLAYER_COOLDOWN_MS,
	TICKET_REASON_MAX,
	TICKET_TOOL_RULES,
	TICKET_TRANSCRIPT_MAX_MESSAGES,
	type TicketAction,
	type TicketModalSpec,
	type TicketOverwrite,
	type TicketRecord,
	type TicketStatus,
	type TicketTool,
	type TicketType,
	type TicketVisibility,
	type TranscriptMessage,
	ticketButtonRows,
	ticketChannelName,
	ticketChannelOpenContent,
	ticketChannelOpenMentions,
	ticketChannelTopic,
	ticketControlRows,
	ticketDeletedLogContent,
	ticketEmbed,
	ticketEveryoneOverwrite,
	ticketFiledReply,
	ticketFilerCopyContent,
	ticketMemberOverwrite,
	ticketNewModal,
	ticketNoticeContent,
	ticketPlayerReplyWithChannel,
	ticketReasonModal,
	ticketStaffContent,
	ticketToolNote,
	ticketTranscriptFileName,
	ticketTranscriptLogContent,
	ticketUserSelectRow
} from '@/lib/bsc/tickets.js';
import { Channel, globalConfig } from '@/lib/constants.js';

const SNOWFLAKE = /^\d{5,20}$/;
const NOT_SET_UP = "Tickets aren't set up on this bot yet. Please tell a staff member instead.";
const MAX_POST_ATTEMPTS = 5;

/** The parts of a modal submit interaction the ticket code reads. */
export interface TicketModalSubmit {
	id: string;
	token: string;
	guild_id?: string;
	channel?: { id: string };
	message?: unknown;
	data: {
		custom_id: string;
		components?: readonly { components?: readonly { type: number; custom_id?: string; value?: string }[] }[];
	};
}

function envId(name: string): string | null {
	const raw = process.env[name]?.trim();
	return raw && SNOWFLAKE.test(raw) ? raw : null;
}

/** See the config notes at the top of tickets.ts. */
export function ticketConfig(): {
	channelId: string | null;
	staffRoleId: string | null;
	noticeChannelId: string | null;
	categoryId: string | null;
} {
	const fallback = globalConfig.isProduction ? null : Channel.BotLogs;
	return {
		channelId: envId('TICKET_CHANNEL_ID') ?? (fallback && SNOWFLAKE.test(fallback) ? fallback : null),
		staffRoleId: resolveTicketStaffRoleId(envId('TICKET_STAFF_ROLE_ID'), globalConfig.isProduction),
		noticeChannelId: envId('TICKET_NOTICE_CHANNEL_ID'),
		categoryId: envId('TICKET_CATEGORY_ID')
	};
}

interface TicketRow {
	id: number;
	type: string;
	source: string;
	reporter_id: string | null;
	filed_by: string;
	guild_id: string | null;
	origin_channel_id: string | null;
	what: string;
	command: string | null;
	screenshot: string | null;
	status: string;
	staff_channel_id: string | null;
	staff_message_id: string | null;
	notice_message_id: string | null;
	handled_by: string | null;
	handled_by_tier: string | null;
	reason: string | null;
	created_at: Date;
	updated_at: Date;
	ticket_channel_id?: string | null;
	claimed_by?: string | null;
	added_user_ids?: string[] | null;
	visibility?: string | null;
	closed_at?: Date | null;
	closed_by?: string | null;
	channel_deleted_at?: Date | null;
}

function toRecord(row: TicketRow): TicketRecord {
	const tier = row.handled_by_tier;
	return {
		id: Number(row.id),
		type: isTicketType(row.type) ? row.type : 'bug',
		source: row.source === 'auto' || row.source === 'staff' ? row.source : 'player',
		reporterId: row.reporter_id,
		filedBy: row.filed_by,
		guildId: row.guild_id,
		originChannelId: row.origin_channel_id,
		what: row.what,
		command: row.command,
		screenshot: row.screenshot,
		status: isTicketStatus(row.status) ? row.status : 'open',
		staffChannelId: row.staff_channel_id,
		staffMessageId: row.staff_message_id,
		noticeMessageId: row.notice_message_id,
		handledBy: row.handled_by,
		handledByTier: tier && tier in STAFF_TIER_NAMES ? (tier as StaffTier) : null,
		reason: row.reason,
		createdAt: new Date(row.created_at),
		updatedAt: new Date(row.updated_at),
		ticketChannelId: row.ticket_channel_id ?? null,
		claimedBy: row.claimed_by ?? null,
		addedUserIds: row.added_user_ids ?? [],
		visibility: row.visibility === 'public' ? 'public' : 'private',
		closedAt: row.closed_at ? new Date(row.closed_at) : null,
		closedBy: row.closed_by ?? null,
		channelDeletedAt: row.channel_deleted_at ? new Date(row.channel_deleted_at) : null
	};
}

export async function getTicket(id: number): Promise<TicketRecord | null> {
	const rows = await prisma.$queryRaw<TicketRow[]>`SELECT * FROM bsc_tickets WHERE id = ${id} LIMIT 1`;
	return rows[0] ? toRecord(rows[0]) : null;
}

/** Read-only list for /staff tickets (and DJ's daily list). Oldest first. */
export async function listTickets(statuses: TicketStatus[], limit = 200): Promise<TicketRecord[]> {
	const rows = await prisma.$queryRaw<TicketRow[]>`
		SELECT * FROM bsc_tickets WHERE status = ANY(${statuses}::text[]) ORDER BY id ASC LIMIT ${limit}
	`;
	return rows.map(toRecord);
}

async function playerLimitError(userId: string, type?: TicketType): Promise<string | null> {
	const rows = await prisma.$queryRaw<
		{
			open_count: number;
			same_type: number;
			same_id: number | null;
			same_channel: string | null;
			last_created: Date | null;
		}[]
	>`
		SELECT
			(SELECT COUNT(*)::int FROM bsc_tickets WHERE reporter_id = ${userId} AND source = 'player' AND status = 'open') AS open_count,
			(SELECT COUNT(*)::int FROM bsc_tickets WHERE reporter_id = ${userId} AND source = 'player' AND status = 'open' AND type = ${type ?? ''}) AS same_type,
			(SELECT id FROM bsc_tickets WHERE reporter_id = ${userId} AND source = 'player' AND status = 'open' AND type = ${type ?? ''} ORDER BY id ASC LIMIT 1) AS same_id,
			(SELECT CASE WHEN channel_deleted_at IS NULL THEN ticket_channel_id END FROM bsc_tickets WHERE reporter_id = ${userId} AND source = 'player' AND status = 'open' AND type = ${type ?? ''} ORDER BY id ASC LIMIT 1) AS same_channel,
			(SELECT MAX(created_at) FROM bsc_tickets WHERE reporter_id = ${userId} AND source = 'player') AS last_created
	`;
	return playerTicketLimitError({
		openCount: Number(rows[0]?.open_count ?? 0),
		openSameType: Number(rows[0]?.same_type ?? 0),
		openTicket: rows[0]?.same_id ? { id: Number(rows[0].same_id), channelId: rows[0].same_channel ?? null } : null,
		type,
		lastCreatedAt: rows[0]?.last_created ? new Date(rows[0].last_created) : null,
		now: Date.now()
	});
}

async function insertTicket(t: CleanTicketInput): Promise<TicketRecord | null> {
	if (t.source !== 'player') {
		const rows = await prisma.$queryRaw<TicketRow[]>`
			INSERT INTO bsc_tickets (type, source, reporter_id, filed_by, guild_id, origin_channel_id, what, command, screenshot)
			VALUES (${t.type}, ${t.source}, ${t.reporterId}, ${t.filedBy}, ${t.guildId}, ${t.originChannelId}, ${t.what}, ${t.command}, ${t.screenshot})
			RETURNING *
		`;
		return rows[0] ? toRecord(rows[0]) : null;
	}
	// Player tickets: the cooldown and open cap are re-checked inside the insert, so a double submit can't skip them.
	const cooldownMs = TICKET_PLAYER_COOLDOWN_MS;
	const rows = await prisma.$queryRaw<TicketRow[]>`
		INSERT INTO bsc_tickets (type, source, reporter_id, filed_by, guild_id, origin_channel_id, what, command, screenshot)
		SELECT ${t.type}, 'player', ${t.reporterId}, ${t.filedBy}, ${t.guildId}, ${t.originChannelId}, ${t.what}, ${t.command}, ${t.screenshot}
		WHERE NOT EXISTS (
			SELECT 1 FROM bsc_tickets
			WHERE reporter_id = ${t.reporterId} AND source = 'player'
			AND created_at > NOW() - (${cooldownMs}::int * INTERVAL '1 millisecond')
		)
		AND (
			SELECT COUNT(*) FROM bsc_tickets WHERE reporter_id = ${t.reporterId} AND source = 'player' AND status = 'open'
		) < ${TICKET_MAX_OPEN_PER_PLAYER}
		AND NOT EXISTS (
			SELECT 1 FROM bsc_tickets
			WHERE reporter_id = ${t.reporterId} AND source = 'player' AND status = 'open' AND type = ${t.type}
		)
		RETURNING *
	`;
	return rows[0] ? toRecord(rows[0]) : null;
}

export type FileTicketResult =
	| { ok: true; ticket: TicketRecord; screenshotDropped: boolean }
	| { ok: false; error: string };

/**
 * Files a ticket. Use this for player tickets, /staff ticket_file and the bug scan (source 'auto').
 * The staff post pings the staff role. Player-filed tickets also get a visible copy in the origin
 * channel (or a DM if that fails). The player is pinged once, as a new message, when staff press
 * Confirm (and again on Live).
 */
export async function fileTicket(input: NewTicketInput, opts: { post?: boolean } = {}): Promise<FileTicketResult> {
	if (!ticketConfig().channelId) return { ok: false, error: NOT_SET_UP };
	const prepared = prepareNewTicket(input);
	if (!prepared.ok) return prepared;
	if (input.source === 'player' && input.reporterId) {
		const limit = await playerLimitError(input.reporterId, input.type);
		if (limit) return { ok: false, error: limit };
	}
	const ticket = await insertTicket(prepared.ticket);
	if (!ticket) {
		const limit = input.reporterId ? await playerLimitError(input.reporterId, input.type) : null;
		return { ok: false, error: limit ?? 'Could not file that ticket. Please try again in a minute.' };
	}
	if (opts.post !== false) {
		await postTicketToStaff(ticket.id);
		if (input.source === 'player') {
			const fresh = await getTicket(ticket.id);
			if (fresh && !fresh.ticketChannelId) await postTicketFilerCopy(fresh);
		}
	}
	return { ok: true, ticket, screenshotDropped: prepared.ticket.screenshotDropped };
}

export type TicketFilerCopyResult = 'channel' | 'dm' | 'none';

const FILER_COPY_NO_PINGS = { users: [] as string[], roles: [] as string[] };

/** Visible copy for the player who filed. No staff buttons, and nobody is pinged. */
export async function postTicketFilerCopy(ticket: TicketRecord): Promise<TicketFilerCopyResult> {
	if (ticket.source !== 'player' || !ticket.reporterId) return 'none';
	// Ticket channels are private. Never post a public copy of a ticket that has its own channel.
	if (ticket.ticketChannelId) return 'none';
	const { channelId } = ticketConfig();
	const raw = ticketEmbed(ticket);
	const body = {
		content: ticketFilerCopyContent(ticket),
		embeds: [
			new EmbedBuilder()
				.setTitle(raw.title)
				.setColor(raw.color)
				.setFields(raw.fields)
				.setFooter(raw.footer)
				.setTimestamp(new Date(raw.timestamp))
		],
		allowedMentions: FILER_COPY_NO_PINGS
	};
	const origin = ticket.originChannelId;
	if (origin && origin !== channelId) {
		try {
			await globalClient.sendMessage(origin, body);
			return 'channel';
		} catch (err) {
			Logging.logError(err as Error, { type: 'TICKET_FILER_COPY', ticket_id: ticket.id, channel_id: origin });
		}
	}
	try {
		await globalClient.sendDm(ticket.reporterId, body);
		return 'dm';
	} catch (err) {
		Logging.logError(err as Error, {
			type: 'TICKET_FILER_COPY_DM',
			ticket_id: ticket.id,
			user_id: ticket.reporterId
		});
		return 'none';
	}
}

/** Posts a ticket to the staff channel once. Safe to call from the ticker and the filer at the same time. */
export async function postTicketToStaff(id: number): Promise<boolean> {
	const { channelId, staffRoleId } = ticketConfig();
	if (!channelId) return false;
	const claimed = await prisma.$queryRaw<TicketRow[]>`
		UPDATE bsc_tickets SET posting_at = NOW()
		WHERE id = ${id} AND staff_message_id IS NULL AND post_attempts < ${MAX_POST_ATTEMPTS}
		AND (posting_at IS NULL OR posting_at < NOW() - INTERVAL '2 minutes')
		RETURNING *
	`;
	if (!claimed[0]) return false;
	const ticket = toRecord(claimed[0]);
	if (await postTicketToOwnChannel(ticket)) return true;
	try {
		const msg = (await globalClient.rest.post(Routes.channelMessages(channelId), {
			body: {
				content: ticketStaffContent(ticket, staffRoleId),
				embeds: [ticketEmbed(ticket)],
				components: ticketButtonRows(ticket),
				// Only the staff role may ping. Never @everyone, never players (they are only shown in the embed).
				allowed_mentions: { parse: [], users: [], roles: staffRoleId ? [staffRoleId] : [] }
			}
		})) as { id: string; channel_id: string; guild_id?: string };
		const guildId = msg.guild_id ?? ticket.guildId ?? globalConfig.supportServerID ?? null;
		await prisma.$executeRaw`
			UPDATE bsc_tickets SET staff_channel_id = ${channelId}, staff_message_id = ${msg.id},
				guild_id = COALESCE(guild_id, ${guildId}), posting_at = NULL, updated_at = NOW()
			WHERE id = ${id}
		`;
		return true;
	} catch (err) {
		Logging.logError(err as Error, { type: 'TICKET_POST', ticket_id: id });
		await prisma.$executeRaw`
			UPDATE bsc_tickets SET posting_at = NULL, post_attempts = post_attempts + 1 WHERE id = ${id}
		`;
		return false;
	}
}

/** Ticker: posts tickets that were filed by a script (bug scan) or whose first post failed. */
export async function processTicketTicker(): Promise<void> {
	if (!ticketConfig().channelId) return;
	const rows = await prisma.$queryRaw<{ id: number }[]>`
		SELECT id FROM bsc_tickets
		WHERE staff_message_id IS NULL AND status = 'open' AND post_attempts < ${MAX_POST_ATTEMPTS}
		AND (posting_at IS NULL OR posting_at < NOW() - INTERVAL '2 minutes')
		ORDER BY id ASC LIMIT 5
	`;
	for (const row of rows) await postTicketToStaff(Number(row.id));
}

async function respond(interactionId: string, token: string, type: InteractionResponseType, data: unknown) {
	await globalClient.rest.post(Routes.interactionCallback(interactionId, token), { body: { type, data } });
}

async function showModal(interactionId: string, token: string, modal: TicketModalSpec) {
	await respond(interactionId, token, InteractionResponseType.Modal, modal);
}

async function followUpEphemeral(token: string, content: string) {
	await globalClient.rest
		.post(Routes.webhook(globalClient.applicationId, token), {
			body: { content, flags: MessageFlags.Ephemeral, allowed_mentions: { parse: [] } }
		})
		.catch(err => Logging.logError(err as Error));
}

function staffMessageBody(ticket: TicketRecord) {
	return {
		embeds: [ticketEmbed(ticket)],
		components: ticketControlRows(ticket),
		allowed_mentions: { parse: [], users: [], roles: [] }
	};
}

type ActionResult = { ok: true; ticket: TicketRecord } | { ok: false; error: string };

/** Moves a ticket. Atomic: two staff pressing at once only apply (and ping) once. */
export async function applyTicketAction(
	id: number,
	action: TicketAction,
	staffId: string,
	tier: StaffTier,
	reason: string | null
): Promise<ActionResult> {
	const rule = TICKET_ACTION_RULES[action];
	if (!tierAtLeast(tier, rule.minTier)) {
		return { ok: false, error: `${rule.label} needs the ${STAFF_TIER_NAMES[rule.minTier]} role.` };
	}
	const cleanReason = reason ? cleanTicketLine(reason, TICKET_REASON_MAX) || null : null;
	const rows = await prisma.$queryRaw<TicketRow[]>`
		UPDATE bsc_tickets SET status = ${rule.to}, handled_by = ${staffId}, handled_by_tier = ${tier},
			reason = COALESCE(${cleanReason}, reason), updated_at = NOW()
		WHERE id = ${id} AND status = ANY(${rule.from}::text[])
		RETURNING *
	`;
	if (!rows[0]) {
		const current = await getTicket(id);
		if (!current) return { ok: false, error: `Ticket #${id} could not be found.` };
		return { ok: false, error: `Ticket #${id} is already ${current.status.replace('_', ' ')}. Nothing changed.` };
	}
	return { ok: true, ticket: toRecord(rows[0]) };
}

/** Sends the one-time player notice as a NEW message (edits never notify), pinging only that player. */
export async function sendTicketNotice(ticket: TicketRecord, action: TicketAction): Promise<boolean> {
	const content = ticketNoticeContent(ticket, action);
	if (!content || !ticket.reporterId) return true;
	const { noticeChannelId } = ticketConfig();
	// A ticket with its own channel pings the player there (they can see it by now). Otherwise as before.
	const ownChannel =
		ticket.ticketChannelId && !ticket.channelDeletedAt && reporterHasChannelAccess(ticket)
			? ticket.ticketChannelId
			: null;
	const fallbackStaff = ticket.ticketChannelId ? ticketConfig().channelId : ticket.staffChannelId;
	const targets = [ownChannel, ticket.originChannelId, noticeChannelId, fallbackStaff].filter(
		(id, i, arr): id is string => Boolean(id) && arr.indexOf(id) === i
	);
	for (const channelId of targets) {
		try {
			const msg = (await globalClient.rest.post(Routes.channelMessages(channelId), {
				body: { content, allowed_mentions: { parse: [], users: [ticket.reporterId], roles: [] } }
			})) as { id: string };
			await prisma.$executeRaw`UPDATE bsc_tickets SET notice_message_id = ${msg.id} WHERE id = ${ticket.id}`;
			return true;
		} catch (err) {
			Logging.logError(err as Error, { type: 'TICKET_NOTICE', ticket_id: ticket.id, channel_id: channelId });
		}
	}
	return false;
}

async function finishAction(
	itx: { id: string; token: string },
	ticket: TicketRecord,
	action: TicketAction
): Promise<void> {
	// Update the staff post in place (no ping), then ping the player in a new message.
	await respond(itx.id, itx.token, InteractionResponseType.UpdateMessage, staffMessageBody(ticket));
	// Auto-filed and staff-filed tickets start staff-only. Confirm lets the player into the channel first.
	if (action === 'confirm') await grantReporterAccess(ticket);
	if (actionPingsReporter(action) && ticket.reporterId) {
		const sent = await sendTicketNotice(ticket, action);
		if (!sent)
			await followUpEphemeral(
				itx.token,
				`Ticket #${ticket.id} updated, but the player notice could not be sent.`
			);
	}
}

/** Non-staff pressing any ticket staff button gets a random Corgo gif from the shared list (same set as /staff and /admin). */
function staffDenied(user: MUser, guildId: string | null): ReturnType<typeof corgoDeniedReply> | null {
	const tier = staffTierOf(user);
	if (!staffGuildAllowed(guildId) || tier === 'none') return corgoDeniedReply();
	return null;
}

function deniedResponse(denied: ReturnType<typeof corgoDeniedReply>) {
	return {
		content: denied.content,
		embeds: denied.embeds.map(e => new EmbedBuilder().setImage(e.image.url)),
		ephemeral: true
	};
}

/** Buttons with ids starting "TKT:". Returns null if the id is not a ticket button. */
export async function handleTicketButton(user: MUser, customId: string, interaction: OSInteraction): CommandResponse {
	const parsed = parseTicketCustomId(customId);
	if (!parsed) return { content: 'That ticket button is not valid.', ephemeral: true };
	const token = interaction.rawInteraction.token;

	if (parsed.kind === 'form') {
		if (!ticketConfig().channelId) return { content: NOT_SET_UP, ephemeral: true };
		const limit = await playerLimitError(user.id, parsed.type);
		if (limit) return { content: limit, ephemeral: true };
		await showModal(interaction.id, token, ticketNewModal(parsed.type));
		return SpecialResponse.RespondedManually;
	}

	if (parsed.kind === 'tool') {
		const denied = staffDenied(user, interaction.guildId);
		if (denied) return deniedResponse(denied);
		return handleTicketTool(user, parsed.tool, parsed.id, interaction);
	}

	if (parsed.kind !== 'act') return { content: 'That ticket button is not valid.', ephemeral: true };
	const denied = staffDenied(user, interaction.guildId);
	if (denied) return deniedResponse(denied);
	const tier = staffTierOf(user);
	const rule = TICKET_ACTION_RULES[parsed.action];
	if (!tierAtLeast(tier, rule.minTier)) {
		return { content: `${rule.label} needs the ${STAFF_TIER_NAMES[rule.minTier]} role.`, ephemeral: true };
	}
	const ticket = await getTicket(parsed.id);
	if (!ticket || (ticket.staffMessageId && ticket.staffMessageId !== interaction.messageId)) {
		return { content: `Ticket #${parsed.id} could not be found on this message.`, ephemeral: true };
	}
	if (!rule.from.includes(ticket.status)) {
		return { content: `Ticket #${ticket.id} is already ${ticket.status.replace('_', ' ')}.`, ephemeral: true };
	}
	if (rule.needsReason) {
		await showModal(interaction.id, token, ticketReasonModal(parsed.action, ticket.id));
		return SpecialResponse.RespondedManually;
	}
	const result = await applyTicketAction(ticket.id, parsed.action, user.id, tier, null);
	if (!result.ok) return { content: result.error, ephemeral: true };
	await finishAction({ id: interaction.id, token }, result.ticket, parsed.action);
	return SpecialResponse.RespondedManually;
}

export function isTicketModalId(customId: string): boolean {
	const parsed = parseTicketCustomId(customId);
	return parsed?.kind === 'new' || parsed?.kind === 'rsn';
}

/** Modal submits for the player form and the staff reason box. */
export async function handleTicketModalSubmit(itx: TicketModalSubmit, user: MUser): Promise<void> {
	const parsed = parseTicketCustomId(itx.data.custom_id);
	if (!parsed) return;
	const reply = (content: string) =>
		respond(itx.id, itx.token, InteractionResponseType.ChannelMessageWithSource, {
			content,
			flags: MessageFlags.Ephemeral,
			allowed_mentions: { parse: [] }
		});
	const inputs = readModalInputs(itx.data);

	if (parsed.kind === 'new') {
		const result = await fileTicket(
			{
				type: parsed.type,
				source: 'player',
				reporterId: user.id,
				filedBy: user.id,
				guildId: itx.guild_id ?? null,
				originChannelId: itx.channel?.id ?? null,
				what: inputs[TICKET_INPUT_WHAT] ?? '',
				command: inputs[TICKET_INPUT_COMMAND] ?? null,
				screenshot: inputs[TICKET_INPUT_SCREENSHOT] ?? null
			},
			{ post: false }
		);
		if (!result.ok) {
			await reply(result.error);
			return;
		}
		await postTicketToStaff(result.ticket.id);
		const fresh = (await getTicket(result.ticket.id)) ?? result.ticket;
		if (fresh.ticketChannelId) {
			await reply(ticketPlayerReplyWithChannel(fresh, fresh.ticketChannelId, result.screenshotDropped));
			return;
		}
		const copy = await postTicketFilerCopy(fresh);
		await reply(ticketFiledReply(fresh, result.screenshotDropped, copy));
		return;
	}

	if (parsed.kind !== 'rsn') return;
	const denied = staffDenied(user, itx.guild_id ?? null);
	if (denied) {
		return respond(itx.id, itx.token, InteractionResponseType.ChannelMessageWithSource, {
			...denied,
			flags: MessageFlags.Ephemeral,
			allowed_mentions: { parse: [] }
		});
	}
	const tier = staffTierOf(user);
	const result = await applyTicketAction(
		parsed.id,
		parsed.action,
		user.id,
		tier,
		inputs[TICKET_INPUT_REASON] ?? null
	);
	if (!result.ok) return reply(result.error);
	if (itx.message) {
		await finishAction({ id: itx.id, token: itx.token }, result.ticket, parsed.action);
	} else {
		await reply(`Ticket #${result.ticket.id} is now ${result.ticket.status.replace('_', ' ')}.`);
	}
}

// ---------------------------------------------------------------------------------------------------------
// Ticket channels. Idea from Krypt's Server Helper bot (channel per ticket, Claim, Add/Remove User, Close with
// a transcript, Reopen/Delete), rewritten for BSC on top of bsc_tickets. Only used when TICKET_CATEGORY_ID is
// set; otherwise tickets keep posting in TICKET_CHANNEL_ID exactly as before.

let cachedBotId: string | null = null;
async function botUserId(): Promise<string> {
	if (!cachedBotId) {
		const me = (await globalClient.rest.get(Routes.user())) as { id: string };
		cachedBotId = me.id;
	}
	return cachedBotId;
}

const categoryGuilds = new Map<string, string>();
async function categoryGuildId(categoryId: string): Promise<string | null> {
	const cached = categoryGuilds.get(categoryId);
	if (cached) return cached;
	const ch = (await globalClient.rest.get(Routes.channel(categoryId))) as { type: number; guild_id?: string };
	if (ch.type !== ChannelType.GuildCategory || !ch.guild_id) {
		Logging.logError(new Error('TICKET_CATEGORY_ID is not a category'), { type: 'TICKET_CATEGORY', categoryId });
		return null;
	}
	categoryGuilds.set(categoryId, ch.guild_id);
	return ch.guild_id;
}

async function discordUsername(userId: string): Promise<string | null> {
	try {
		const u = (await globalClient.rest.get(Routes.user(userId))) as { username?: string };
		return u.username ?? null;
	} catch {
		return null;
	}
}

const ADMINISTRATOR = 1n << 3n;
const botPermsCache = new Map<string, { perms: bigint; at: number }>();

/**
 * The bot's server-wide permissions. Discord refuses an overwrite that allows or denies a permission the bot
 * does not have itself, so every overwrite is trimmed to these first.
 */
async function botGuildPerms(guildId: string): Promise<bigint | null> {
	const cached = botPermsCache.get(guildId);
	if (cached && Date.now() - cached.at < 5 * 60_000) return cached.perms;
	try {
		const botId = await botUserId();
		const [roles, member] = (await Promise.all([
			globalClient.rest.get(Routes.guildRoles(guildId)),
			globalClient.rest.get(Routes.guildMember(guildId, botId))
		])) as [{ id: string; permissions: string }[], { roles: string[] }];
		let perms = 0n;
		for (const r of roles) if (r.id === guildId || member.roles.includes(r.id)) perms |= BigInt(r.permissions);
		if ((perms & ADMINISTRATOR) === ADMINISTRATOR) perms = (1n << 60n) - 1n;
		botPermsCache.set(guildId, { perms, at: Date.now() });
		return perms;
	} catch (err) {
		Logging.logError(err as Error, { type: 'TICKET_BOT_PERMS', guild_id: guildId });
		return null;
	}
}

async function ticketGuildId(ticket: TicketRecord): Promise<string | null> {
	if (ticket.guildId) return ticket.guildId;
	const { categoryId } = ticketConfig();
	return categoryId ? categoryGuildId(categoryId).catch(() => null) : null;
}

async function putOverwrite(channelId: string, o: TicketOverwrite, guildId: string | null): Promise<void> {
	const perms = guildId ? await botGuildPerms(guildId) : null;
	const m = perms === null ? o : maskTicketOverwrite(o, perms);
	await globalClient.rest.put(Routes.channelPermission(channelId, m.id), {
		body: { type: m.type, allow: m.allow, deny: m.deny }
	});
}

async function postNote(channelId: string, content: string, pingUserIds: string[] = []): Promise<void> {
	await globalClient.rest
		.post(Routes.channelMessages(channelId), {
			body: { content, allowed_mentions: { parse: [], users: pingUserIds, roles: [] } }
		})
		.catch(err => Logging.logError(err as Error, { type: 'TICKET_NOTE', channel_id: channelId }));
}

/**
 * Makes the ticket's private channel and posts the control message there (staff role ping, plus the player on
 * tickets they filed). Returns false so the caller falls back to the staff channel if anything fails
 * (no category set, missing Manage Channels / Manage Roles, or the category is full at 50 channels).
 */
async function postTicketToOwnChannel(ticket: TicketRecord): Promise<boolean> {
	const { categoryId, staffRoleId } = ticketConfig();
	if (!categoryId) return false;
	let channelId: string | null = null;
	try {
		const guildId = await categoryGuildId(categoryId);
		if (!guildId) return false;
		const botId = await botUserId();
		const perms = await botGuildPerms(guildId);
		const name = ticketChannelName(ticket, ticket.reporterId ? await discordUsername(ticket.reporterId) : 'scan');
		const memberIds = ticket.reporterId && reporterHasChannelAccess(ticket) ? [ticket.reporterId] : [];
		const channel = (await globalClient.rest.post(Routes.guildChannels(guildId), {
			body: {
				name,
				type: ChannelType.GuildText,
				parent_id: categoryId,
				topic: ticketChannelTopic(ticket),
				permission_overwrites: buildTicketOverwrites({
					guildId,
					botId,
					staffRoleId,
					memberIds,
					visibility: 'private',
					closed: false
				}).map(o => (perms === null ? o : maskTicketOverwrite(o, perms)))
			},
			reason: `BSC ticket #${ticket.id}`
		})) as { id: string };
		channelId = channel.id;
		const withChannel: TicketRecord = { ...ticket, ticketChannelId: channel.id, visibility: 'private' };
		const msg = (await globalClient.rest.post(Routes.channelMessages(channel.id), {
			body: {
				content: ticketChannelOpenContent(ticket, staffRoleId),
				embeds: [ticketEmbed(withChannel)],
				components: ticketControlRows(withChannel),
				allowed_mentions: ticketChannelOpenMentions(ticket, staffRoleId)
			}
		})) as { id: string };
		await prisma.$executeRaw`
			UPDATE bsc_tickets SET ticket_channel_id = ${channel.id}, staff_channel_id = ${channel.id},
				staff_message_id = ${msg.id}, guild_id = COALESCE(guild_id, ${guildId}), visibility = 'private',
				posting_at = NULL, updated_at = NOW()
			WHERE id = ${ticket.id}
		`;
		return true;
	} catch (err) {
		Logging.logError(err as Error, { type: 'TICKET_CHANNEL_CREATE', ticket_id: ticket.id });
		// The channel was made but the first post failed: drop the empty channel and use the staff channel.
		if (channelId) await globalClient.rest.delete(Routes.channel(channelId)).catch(() => null);
		return false;
	}
}

/** Confirm on an auto-filed or staff-filed ticket: the player can now see (and type in) the channel. */
async function grantReporterAccess(ticket: TicketRecord): Promise<void> {
	if (!ticket.ticketChannelId || ticket.channelDeletedAt || !ticket.reporterId || ticket.source === 'player') return;
	try {
		await putOverwrite(
			ticket.ticketChannelId,
			ticketMemberOverwrite(ticket.reporterId, Boolean(ticket.closedAt)),
			await ticketGuildId(ticket)
		);
	} catch (err) {
		Logging.logError(err as Error, { type: 'TICKET_GRANT_REPORTER', ticket_id: ticket.id });
	}
}

/** Locks (Close) or unlocks (Reopen) typing for the player and everyone staff added. Staff can always type. */
async function setMembersLocked(ticket: TicketRecord, closed: boolean): Promise<boolean> {
	if (!ticket.ticketChannelId) return false;
	const ids = [
		...(ticket.reporterId && reporterHasChannelAccess(ticket) ? [ticket.reporterId] : []),
		...(ticket.addedUserIds ?? [])
	];
	let ok = true;
	const guildId = await ticketGuildId(ticket);
	for (const id of [...new Set(ids)]) {
		try {
			await putOverwrite(ticket.ticketChannelId, ticketMemberOverwrite(id, closed), guildId);
		} catch (err) {
			ok = false;
			Logging.logError(err as Error, { type: 'TICKET_LOCK', ticket_id: ticket.id, user_id: id });
		}
	}
	return ok;
}

interface ApiMessageLite {
	id: string;
	content?: string;
	timestamp: string;
	author: { id: string; username: string; bot?: boolean };
	attachments?: { url: string }[];
	embeds?: { title?: string }[];
}

/** Saves the last 100 messages as a .txt in the staff ticket log channel. Returns false if it could not. */
async function saveTranscript(ticket: TicketRecord, closedById: string): Promise<boolean> {
	const logChannelId = ticketConfig().channelId;
	if (!ticket.ticketChannelId || !logChannelId) return false;
	try {
		const messages = (await globalClient.rest.get(Routes.channelMessages(ticket.ticketChannelId), {
			query: new URLSearchParams({ limit: String(TICKET_TRANSCRIPT_MAX_MESSAGES) })
		})) as ApiMessageLite[];
		const channel = (await globalClient.rest.get(Routes.channel(ticket.ticketChannelId))) as { name?: string };
		const mapped: TranscriptMessage[] = messages.map(m => ({
			authorName: m.author.username,
			authorId: m.author.id,
			bot: Boolean(m.author.bot),
			content: m.content ?? '',
			timestamp: m.timestamp,
			attachmentUrls: (m.attachments ?? []).map(a => a.url),
			embedTitles: (m.embeds ?? []).map(e => e.title ?? 'embed')
		}));
		const channelName = channel.name ?? `ticket-${ticket.id}`;
		const [closedByName, playerName] = await Promise.all([
			discordUsername(closedById),
			ticket.reporterId ? discordUsername(ticket.reporterId) : Promise.resolve(null)
		]);
		const text = buildTicketTranscript(
			ticket,
			channelName,
			{ id: closedById, name: closedByName },
			mapped,
			new Date(),
			playerName
		);
		await globalClient.rest.post(Routes.channelMessages(logChannelId), {
			body: {
				content: ticketTranscriptLogContent(ticket, closedById, channelName),
				allowed_mentions: { parse: [], users: [], roles: [] }
			},
			files: [{ name: ticketTranscriptFileName(ticket), data: Buffer.from(text, 'utf8') }]
		});
		return true;
	} catch (err) {
		Logging.logError(err as Error, { type: 'TICKET_TRANSCRIPT', ticket_id: ticket.id });
		return false;
	}
}

async function finishTool(
	itx: { id: string; token: string },
	ticket: TicketRecord,
	note: string | null
): Promise<CommandResponse> {
	await respond(itx.id, itx.token, InteractionResponseType.UpdateMessage, staffMessageBody(ticket));
	if (note && ticket.ticketChannelId) await postNote(ticket.ticketChannelId, note);
	return SpecialResponse.RespondedManually;
}

const NO_PERMS_HINT = 'Discord said no. The bot needs Manage Channels and Manage Roles for ticket channels.';

/** Staff-only channel tools on the ticket's control message. The caller has already checked staff. */
async function handleTicketTool(
	user: MUser,
	tool: TicketTool,
	id: number,
	interaction: OSInteraction
): CommandResponse {
	const tier = staffTierOf(user);
	const rule = TICKET_TOOL_RULES[tool];
	if (!tierAtLeast(tier, rule.minTier)) {
		return { content: `${rule.label} needs the ${STAFF_TIER_NAMES[rule.minTier]} role.`, ephemeral: true };
	}
	const ticket = await getTicket(id);
	if (
		!ticket ||
		!ticket.ticketChannelId ||
		ticket.channelDeletedAt ||
		ticket.ticketChannelId !== interaction.channelId ||
		ticket.staffMessageId !== interaction.messageId
	) {
		return { content: `Ticket #${id} could not be found on this message.`, ephemeral: true };
	}
	const channelId = ticket.ticketChannelId;
	const token = interaction.rawInteraction.token;
	const itx = { id: interaction.id, token };

	if (ticket.closedAt && tool !== 'reopen' && tool !== 'delete') {
		return { content: 'Reopen the ticket first.', ephemeral: true };
	}

	if (tool === 'add' || tool === 'remove') {
		await respond(interaction.id, token, InteractionResponseType.ChannelMessageWithSource, {
			content: tool === 'add' ? 'Who should be added to this ticket?' : 'Who should be removed from this ticket?',
			components: ticketUserSelectRow(tool, ticket.id),
			flags: MessageFlags.Ephemeral,
			allowed_mentions: { parse: [] }
		});
		return SpecialResponse.RespondedManually;
	}

	if (tool === 'claim') {
		const rows = await prisma.$queryRaw<TicketRow[]>`
			UPDATE bsc_tickets SET claimed_by = ${user.id}, updated_at = NOW()
			WHERE id = ${id} AND claimed_by IS NULL AND closed_at IS NULL AND channel_deleted_at IS NULL
			RETURNING *
		`;
		if (!rows[0]) return { content: 'Someone already claimed this ticket.', ephemeral: true };
		return finishTool(itx, toRecord(rows[0]), ticketToolNote('claim', user.id));
	}

	if (tool === 'public' || tool === 'private') {
		const from: TicketVisibility = tool === 'public' ? 'private' : 'public';
		const guildId = ticket.guildId ?? interaction.guildId;
		if (!guildId) return { content: 'This ticket has no server saved.', ephemeral: true };
		const rows = await prisma.$queryRaw<TicketRow[]>`
			UPDATE bsc_tickets SET visibility = ${tool}, updated_at = NOW()
			WHERE id = ${id} AND visibility = ${from} AND closed_at IS NULL AND channel_deleted_at IS NULL
			RETURNING *
		`;
		if (!rows[0]) return { content: `Ticket #${id} is already ${tool}.`, ephemeral: true };
		try {
			await putOverwrite(channelId, ticketEveryoneOverwrite(guildId, tool), guildId);
		} catch (err) {
			Logging.logError(err as Error, { type: 'TICKET_VISIBILITY', ticket_id: id });
			await prisma.$executeRaw`UPDATE bsc_tickets SET visibility = ${from} WHERE id = ${id}`;
			return { content: NO_PERMS_HINT, ephemeral: true };
		}
		// A second channel update after the permission change. Discord's app only adds a channel that just became
		// visible when it gets a fresh channel update; without it, people who were pinged bounce back out of it.
		await globalClient.rest
			.patch(Routes.channel(channelId), { body: { topic: ticketChannelTopic(ticket, tool) } })
			.catch(err => Logging.logError(err as Error, { type: 'TICKET_TOPIC', ticket_id: id }));
		return finishTool(itx, toRecord(rows[0]), ticketToolNote(tool, user.id));
	}

	if (tool === 'close') {
		const rows = await prisma.$queryRaw<TicketRow[]>`
			UPDATE bsc_tickets SET closed_at = NOW(), closed_by = ${user.id}, updated_at = NOW()
			WHERE id = ${id} AND closed_at IS NULL AND channel_deleted_at IS NULL
			RETURNING *
		`;
		if (!rows[0]) return { content: `Ticket #${id} is already closed.`, ephemeral: true };
		const closed = toRecord(rows[0]);
		// Answer Discord first; the lock and transcript can take a few seconds.
		await respond(interaction.id, token, InteractionResponseType.UpdateMessage, staffMessageBody(closed));
		const locked = await setMembersLocked(closed, true);
		const saved = await saveTranscript(closed, user.id);
		await postNote(
			channelId,
			saved
				? ticketToolNote('close', user.id)
				: `🔒 <@${user.id}> closed this ticket. The transcript could not be saved.`
		);
		if (!locked) await followUpEphemeral(token, `Closed, but some people could not be locked. ${NO_PERMS_HINT}`);
		return SpecialResponse.RespondedManually;
	}

	if (tool === 'reopen') {
		const rows = await prisma.$queryRaw<TicketRow[]>`
			UPDATE bsc_tickets SET closed_at = NULL, closed_by = NULL, updated_at = NOW()
			WHERE id = ${id} AND closed_at IS NOT NULL AND channel_deleted_at IS NULL
			RETURNING *
		`;
		if (!rows[0]) return { content: `Ticket #${id} is already open.`, ephemeral: true };
		const reopened = toRecord(rows[0]);
		const unlocked = await setMembersLocked(reopened, false);
		const res = await finishTool(itx, reopened, ticketToolNote('reopen', user.id));
		if (!unlocked) await followUpEphemeral(token, `Reopened, but some people are still locked. ${NO_PERMS_HINT}`);
		return res;
	}

	// Delete: only a closed ticket, so there is always a transcript first.
	if (!ticket.closedAt) return { content: 'Close the ticket first. That saves the transcript.', ephemeral: true };
	const rows = await prisma.$queryRaw<TicketRow[]>`
		UPDATE bsc_tickets SET channel_deleted_at = NOW(), updated_at = NOW()
		WHERE id = ${id} AND closed_at IS NOT NULL AND channel_deleted_at IS NULL
		RETURNING *
	`;
	if (!rows[0]) return { content: `Ticket #${id} is already deleted.`, ephemeral: true };
	// Grab the name before the channel is gone, for the staff log line.
	const deletedName = await globalClient.rest
		.get(Routes.channel(channelId))
		.then(c => (c as { name?: string }).name ?? `ticket-${id}`)
		.catch(() => `ticket-${id}`);
	await respond(interaction.id, token, InteractionResponseType.ChannelMessageWithSource, {
		content: 'Deleting this ticket channel…',
		flags: MessageFlags.Ephemeral,
		allowed_mentions: { parse: [] }
	});
	try {
		await globalClient.rest.delete(Routes.channel(channelId), { reason: `BSC ticket #${id} deleted by staff` });
	} catch (err) {
		Logging.logError(err as Error, { type: 'TICKET_DELETE', ticket_id: id });
		await prisma.$executeRaw`UPDATE bsc_tickets SET channel_deleted_at = NULL WHERE id = ${id}`;
		await followUpEphemeral(token, `Could not delete the channel. ${NO_PERMS_HINT}`);
		return SpecialResponse.RespondedManually;
	}
	const logChannelId = ticketConfig().channelId;
	if (logChannelId && logChannelId !== channelId)
		await postNote(logChannelId, ticketDeletedLogContent(ticket, user.id, deletedName));
	return SpecialResponse.RespondedManually;
}

/** The parts of a user-select interaction the ticket code reads (Add User / Remove User). */
export interface TicketUserSelectInteraction {
	id: string;
	token: string;
	guild_id?: string;
	channel?: { id: string };
	data: {
		custom_id: string;
		values?: string[];
		resolved?: { users?: Record<string, { id: string; bot?: boolean }> };
	};
}

export function isTicketUserSelectId(customId: string): boolean {
	return parseTicketCustomId(customId)?.kind === 'usr';
}

export async function handleTicketUserSelect(itx: TicketUserSelectInteraction, user: MUser): Promise<void> {
	const parsed = parseTicketCustomId(itx.data.custom_id);
	if (!parsed || parsed.kind !== 'usr') return;
	const reply = (content: string) =>
		respond(itx.id, itx.token, InteractionResponseType.UpdateMessage, {
			content,
			components: [],
			allowed_mentions: { parse: [] }
		});
	const denied = staffDenied(user, itx.guild_id ?? null);
	if (denied) {
		return respond(itx.id, itx.token, InteractionResponseType.UpdateMessage, {
			...denied,
			components: [],
			allowed_mentions: { parse: [] }
		});
	}
	const tier = staffTierOf(user);
	const rule = TICKET_TOOL_RULES[parsed.mode];
	if (!tierAtLeast(tier, rule.minTier))
		return reply(`${rule.label} needs the ${STAFF_TIER_NAMES[rule.minTier]} role.`);

	const targetId = itx.data.values?.[0] ?? '';
	if (!SNOWFLAKE.test(targetId)) return reply('That user is not valid.');
	if (itx.data.resolved?.users?.[targetId]?.bot) return reply("Bots can't be added to or removed from tickets.");
	const ticket = await getTicket(parsed.id);
	if (!ticket || !ticket.ticketChannelId || ticket.channelDeletedAt || ticket.ticketChannelId !== itx.channel?.id) {
		return reply(`Ticket #${parsed.id} could not be found in this channel.`);
	}
	if (ticket.closedAt) return reply('Reopen the ticket first.');
	const channelId = ticket.ticketChannelId;

	if (parsed.mode === 'add') {
		if (targetId === ticket.reporterId && reporterHasChannelAccess(ticket)) {
			return reply(`<@${targetId}> filed this ticket and can already see it.`);
		}
		const rows = await prisma.$queryRaw<TicketRow[]>`
			UPDATE bsc_tickets SET added_user_ids = array_append(added_user_ids, ${targetId}::text), updated_at = NOW()
			WHERE id = ${ticket.id} AND NOT (${targetId}::text = ANY(added_user_ids))
			AND cardinality(added_user_ids) < ${TICKET_MAX_ADDED_USERS} AND closed_at IS NULL AND channel_deleted_at IS NULL
			RETURNING *
		`;
		if (!rows[0]) {
			return reply(
				`<@${targetId}> is already in this ticket, or it has the max of ${TICKET_MAX_ADDED_USERS} added people.`
			);
		}
		try {
			await putOverwrite(channelId, ticketMemberOverwrite(targetId, false), await ticketGuildId(ticket));
		} catch (err) {
			Logging.logError(err as Error, { type: 'TICKET_ADD_USER', ticket_id: ticket.id });
			await prisma.$executeRaw`
				UPDATE bsc_tickets SET added_user_ids = array_remove(added_user_ids, ${targetId}::text) WHERE id = ${ticket.id}
			`;
			return reply(NO_PERMS_HINT);
		}
		await reply(`Added <@${targetId}>.`);
		// New message so the added person actually gets a notification.
		await postNote(channelId, ticketToolNote('added', user.id, targetId), [targetId]);
		return;
	}

	if (targetId === ticket.reporterId) return reply("The player this ticket is about can't be removed.");
	const rows = await prisma.$queryRaw<TicketRow[]>`
		UPDATE bsc_tickets SET added_user_ids = array_remove(added_user_ids, ${targetId}::text), updated_at = NOW()
		WHERE id = ${ticket.id} AND ${targetId}::text = ANY(added_user_ids) AND channel_deleted_at IS NULL
		RETURNING *
	`;
	if (!rows[0]) return reply(`<@${targetId}> was not added to this ticket (staff see it through the staff role).`);
	try {
		await globalClient.rest.delete(Routes.channelPermission(channelId, targetId));
	} catch (err) {
		Logging.logError(err as Error, { type: 'TICKET_REMOVE_USER', ticket_id: ticket.id });
		await prisma.$executeRaw`
			UPDATE bsc_tickets SET added_user_ids = array_append(added_user_ids, ${targetId}::text) WHERE id = ${ticket.id}
		`;
		return reply(NO_PERMS_HINT);
	}
	await reply(`Removed <@${targetId}>.`);
	await postNote(channelId, ticketToolNote('removed', user.id, targetId));
}
