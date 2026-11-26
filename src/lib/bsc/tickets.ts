/**
 * BSC ticket system: pure helpers only (no Discord or DB), so they are easy to test.
 *
 * Flow: a player files a ticket with `/help ticket:Bug` (or Suggestion), or staff/the bug scan files one.
 * It is posted to the staff ticket channel, and the filer also gets a visible copy in the channel they
 * filed from (or a DM if that post fails). Staff press Confirm or Ignore. Confirm pings the player once
 * as a new message. Devs then move it to On test, Live or Won't fix. Live pings the player once more.
 *
 * Config (env, all optional on the test bot):
 *   TICKET_CHANNEL_ID         Staff-only channel the tickets are posted in. Test default: the bot log channel.
 *                             Prod: required, tickets are off until it is set.
 *   TICKET_STAFF_ROLE_ID      Role pinged on each new ticket. On the test bot, unset falls back to the
 *                             test Mod role. Prod: set this or staff will not be pinged.
 *   TICKET_NOTICE_CHANNEL_ID  Where player notices go for tickets with no channel of their own
 *                             (auto-filed ones). Unset = the staff ticket channel.
 *   TICKET_CATEGORY_ID        Optional. A Discord category. When set, every new ticket gets its own private
 *                             channel there (bug-0007-name / suggestion-0008-name). Unset = the old flow,
 *                             tickets are posted in TICKET_CHANNEL_ID. TICKET_CHANNEL_ID becomes the staff
 *                             ticket log (close transcripts).
 *
 * Ticket channels: the channel-per-ticket idea, Claim, Add/Remove User, Close with a transcript, and
 * Reopen/Delete are based on Krypt's Server Helper bot. Rewritten for BSC (no code copied). Thanks Krypt!
 */
import { escapeMarkdown } from '@oldschoolgg/discord';

import { STAFF_TIER_NAMES, type StaffTier } from '@/lib/bsc/staffTiers.js';

export const TICKET_TYPES = ['bug', 'suggestion'] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

export const TICKET_STATUSES = ['open', 'confirmed', 'on_test', 'live', 'ignored', 'wont_fix'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const TICKET_ACTIVE_STATUSES: TicketStatus[] = ['open', 'confirmed', 'on_test'];

export type TicketSource = 'player' | 'staff' | 'auto';

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
	open: 'Open',
	confirmed: 'Confirmed',
	on_test: 'On test',
	live: 'Live',
	ignored: 'Ignored',
	wont_fix: "Won't fix"
};

export const TICKET_STATUS_ICONS: Record<TicketStatus, string> = {
	open: '🟡',
	confirmed: '🔨',
	on_test: '🧪',
	live: '✅',
	ignored: '⚪',
	wont_fix: '⛔'
};

export const TICKET_TYPE_ICONS: Record<TicketType, string> = { bug: '🐞', suggestion: '💡' };
export const TICKET_TYPE_LABELS: Record<TicketType, string> = { bug: 'Bug', suggestion: 'Suggestion' };

/** OSRS-ish colours: parchment yellow, bronze, rune blue, green, grey, red. */
export const TICKET_STATUS_COLORS: Record<TicketStatus, number> = {
	open: 0xd4a72c,
	confirmed: 0xb87333,
	on_test: 0x4a7fbd,
	live: 0x3fa34d,
	ignored: 0x7a7a7a,
	wont_fix: 0xb33a3a
};

// Anti-spam and length caps.
export const TICKET_WHAT_MAX = 500;
export const TICKET_WHAT_MIN = 10;
export const TICKET_COMMAND_MAX = 100;
export const TICKET_SCREENSHOT_MAX = 300;
export const TICKET_REASON_MAX = 200;
export const TICKET_PLAYER_COOLDOWN_MS = 10 * 60 * 1000;
export const TICKET_MAX_OPEN_PER_PLAYER = 3;
export const TICKET_LIST_MAX_LINES = 20;

// Discord limits (checked by tests with a 150 margin).
export const DISCORD_CONTENT_LIMIT = 2000;
export const DISCORD_EMBED_TITLE_LIMIT = 256;
export const DISCORD_EMBED_FIELD_VALUE_LIMIT = 1024;
export const DISCORD_EMBED_DESCRIPTION_LIMIT = 4096;
export const DISCORD_EMBED_TOTAL_LIMIT = 6000;
export const DISCORD_BUTTON_LABEL_LIMIT = 80;
export const DISCORD_CUSTOM_ID_LIMIT = 100;
export const DISCORD_MODAL_TITLE_LIMIT = 45;
export const DISCORD_TEXT_INPUT_LABEL_LIMIT = 45;
export const TICKET_LENGTH_MARGIN = 150;

/** Test-server Mod role, used only when TICKET_STAFF_ROLE_ID is unset on the test bot. */
export const TEST_TICKET_STAFF_ROLE_FALLBACK_ID = '1564759392795099148';

/** Prod Los Perros staff roles to set as TICKET_STAFF_ROLE_ID (pick one, usually Mod). */
export const PROD_TICKET_STAFF_ROLE_IDS = {
	moderator: '1325179339641458749',
	headMod: '1353916725086785646',
	developer: '1569683439190286346',
	contributor: '1569683812621881454'
} as const;

export function resolveTicketStaffRoleId(envRoleId: string | null, isProduction: boolean): string | null {
	if (envRoleId) return envRoleId;
	if (isProduction) return null;
	return TEST_TICKET_STAFF_ROLE_FALLBACK_ID;
}

export interface TicketRecord {
	id: number;
	type: TicketType;
	source: TicketSource;
	reporterId: string | null;
	filedBy: string;
	guildId: string | null;
	originChannelId: string | null;
	what: string;
	command: string | null;
	screenshot: string | null;
	status: TicketStatus;
	staffChannelId: string | null;
	staffMessageId: string | null;
	noticeMessageId: string | null;
	handledBy: string | null;
	handledByTier: StaffTier | null;
	reason: string | null;
	createdAt: Date;
	updatedAt: Date;
	/** Ticket channel mode (null for tickets posted in the staff channel). */
	ticketChannelId?: string | null;
	claimedBy?: string | null;
	addedUserIds?: string[];
	visibility?: TicketVisibility;
	closedAt?: Date | null;
	closedBy?: string | null;
	channelDeletedAt?: Date | null;
}

export type TicketVisibility = 'private' | 'public';

export function isTicketType(value: unknown): value is TicketType {
	return typeof value === 'string' && (TICKET_TYPES as readonly string[]).includes(value);
}

export function isTicketStatus(value: unknown): value is TicketStatus {
	return typeof value === 'string' && (TICKET_STATUSES as readonly string[]).includes(value);
}

/** Stops @everyone, @here, role and user mentions from ever pinging, even if a message forgets allowedMentions. */
export function neutralizeMentions(text: string): string {
	return text.replace(/@(everyone|here)/gi, '@\u200b$1').replace(/<@([!&]?)(\d+)>/g, '<@\u200b$1$2>');
}

export function truncateTicketText(text: string, max: number): string {
	if (text.length <= max) return text;
	return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/** One line, no markdown tricks, no pings. */
export function cleanTicketLine(text: string | null | undefined, max: number): string {
	const oneLine = (text ?? '').replace(/\s+/g, ' ').trim();
	return truncateTicketText(neutralizeMentions(escapeMarkdown(oneLine)), max);
}

/** Multi-line player text: keeps line breaks (max 8), no pings, capped. */
export function cleanTicketBody(text: string | null | undefined, max: number): string {
	const lines = (text ?? '')
		.replace(/\r/g, '')
		.split('\n')
		.map(l => l.replace(/[ \t]+/g, ' ').trim())
		.filter((l, i, arr) => l.length > 0 || (i > 0 && arr[i - 1].length > 0));
	const joined = lines.slice(0, 8).join('\n').trim();
	return truncateTicketText(neutralizeMentions(escapeMarkdown(joined)), max);
}

export function cleanScreenshotLink(text: string | null | undefined): string | null {
	const trimmed = (text ?? '').trim();
	if (!trimmed) return null;
	if (trimmed.length > TICKET_SCREENSHOT_MAX) return null;
	if (!/^https:\/\/[^\s<>()[\]`|]+$/i.test(trimmed)) return null;
	return trimmed;
}

export interface NewTicketInput {
	type: TicketType;
	source: TicketSource;
	reporterId: string | null;
	filedBy: string;
	guildId: string | null;
	originChannelId: string | null;
	what: string;
	command?: string | null;
	screenshot?: string | null;
}

export type CleanTicketInput = Omit<NewTicketInput, 'command' | 'screenshot'> & {
	command: string | null;
	screenshot: string | null;
	screenshotDropped: boolean;
};

/** Validates and cleans a new ticket. Shared by the bot and scripts/file-ticket.ts. */
export function prepareNewTicket(
	input: NewTicketInput
): { ok: true; ticket: CleanTicketInput } | { ok: false; error: string } {
	if (!isTicketType(input.type)) return { ok: false, error: 'Ticket type must be Bug or Suggestion.' };
	const snowflake = /^\d{5,20}$/;
	if (input.reporterId !== null && !snowflake.test(input.reporterId)) {
		return { ok: false, error: 'That player ID is not valid.' };
	}
	const what = cleanTicketBody(input.what, TICKET_WHAT_MAX);
	if (what.replace(/\s/g, '').length < TICKET_WHAT_MIN) {
		return { ok: false, error: `Please describe what happened (at least ${TICKET_WHAT_MIN} characters).` };
	}
	const command = cleanTicketLine(input.command, TICKET_COMMAND_MAX) || null;
	const screenshot = cleanScreenshotLink(input.screenshot);
	return {
		ok: true,
		ticket: {
			type: input.type,
			source: input.source,
			reporterId: input.reporterId,
			filedBy: input.filedBy,
			guildId: input.guildId,
			originChannelId: input.originChannelId,
			what,
			command,
			screenshot,
			screenshotDropped: Boolean(input.screenshot?.trim()) && screenshot === null
		}
	};
}

/** Player anti-spam. Auto and staff tickets skip this. */
export function playerTicketLimitError(input: {
	openCount: number;
	lastCreatedAt: Date | null;
	now: number;
	/** Open (not yet looked at) tickets of the type being filed. One per type at a time. */
	openSameType?: number;
	type?: TicketType;
	/** The waiting ticket of that type, so the refusal can say which one and where it is. */
	openTicket?: { id: number; channelId: string | null } | null;
}): string | null {
	if (input.type && (input.openSameType ?? 0) > 0) {
		const kind = TICKET_TYPE_LABELS[input.type].toLowerCase();
		const t = input.openTicket;
		if (t) {
			const where = t.channelId
				? ` in <#${t.channelId}>. Add any extra details there.`
				: '. Staff are reviewing it.';
			return `You already have ${kind} ticket **#${t.id}** waiting for staff${where} You can file another ${kind} once it is looked at.`;
		}
		return `You already have a ${kind} ticket waiting for staff. Please wait until it is looked at.`;
	}
	if (input.openCount >= TICKET_MAX_OPEN_PER_PLAYER) {
		return `You already have ${TICKET_MAX_OPEN_PER_PLAYER} tickets waiting for staff. Please wait until one is looked at.`;
	}
	if (input.lastCreatedAt) {
		const wait = input.lastCreatedAt.getTime() + TICKET_PLAYER_COOLDOWN_MS - input.now;
		if (wait > 0) {
			const minutes = Math.max(1, Math.ceil(wait / 60_000));
			return `You just filed a ticket. You can file another in ${minutes} min.`;
		}
	}
	return null;
}

// Staff actions and status moves.
export const TICKET_ACTIONS = ['confirm', 'ignore', 'ontest', 'live', 'wontfix'] as const;
export type TicketAction = (typeof TICKET_ACTIONS)[number];

export const TICKET_ACTION_RULES: Record<
	TicketAction,
	{ from: TicketStatus[]; to: TicketStatus; minTier: StaffTier; label: string; needsReason: boolean }
> = {
	confirm: { from: ['open'], to: 'confirmed', minTier: 'moderator', label: 'Confirm', needsReason: false },
	ignore: { from: ['open'], to: 'ignored', minTier: 'moderator', label: 'Ignore', needsReason: true },
	ontest: { from: ['confirmed'], to: 'on_test', minTier: 'developer', label: 'On test', needsReason: false },
	live: { from: ['confirmed', 'on_test'], to: 'live', minTier: 'developer', label: 'Live', needsReason: false },
	wontfix: {
		from: ['confirmed', 'on_test'],
		to: 'wont_fix',
		minTier: 'developer',
		label: "Won't fix",
		needsReason: true
	}
};

export function isTicketAction(value: unknown): value is TicketAction {
	return typeof value === 'string' && (TICKET_ACTIONS as readonly string[]).includes(value);
}

export function actionsForStatus(status: TicketStatus): TicketAction[] {
	return TICKET_ACTIONS.filter(a => TICKET_ACTION_RULES[a].from.includes(status));
}

/** True when this action should ping the player (as a new message). */
export function actionPingsReporter(action: TicketAction): boolean {
	return action === 'confirm' || action === 'live';
}

// Custom IDs. Kept short and parseable. Prefix "TKT:".
export const TICKET_ID_PREFIX = 'TKT:';

export function ticketFormButtonId(type: TicketType): string {
	return `${TICKET_ID_PREFIX}form:${type}`;
}
export function ticketNewModalId(type: TicketType): string {
	return `${TICKET_ID_PREFIX}new:${type}`;
}
export function ticketActionButtonId(action: TicketAction, id: number): string {
	return `${TICKET_ID_PREFIX}act:${action}:${id}`;
}
export function ticketReasonModalId(action: TicketAction, id: number): string {
	return `${TICKET_ID_PREFIX}rsn:${action}:${id}`;
}
export function ticketToolButtonId(tool: TicketTool, id: number): string {
	return `${TICKET_ID_PREFIX}tool:${tool}:${id}`;
}
export function ticketUserSelectId(mode: TicketUserSelectMode, id: number): string {
	return `${TICKET_ID_PREFIX}usr:${mode}:${id}`;
}
export const TICKET_INPUT_WHAT = 'what';
export const TICKET_INPUT_COMMAND = 'command';
export const TICKET_INPUT_SCREENSHOT = 'screenshot';
export const TICKET_INPUT_REASON = 'reason';

export type ParsedTicketId =
	| { kind: 'form'; type: TicketType }
	| { kind: 'new'; type: TicketType }
	| { kind: 'act'; action: TicketAction; id: number }
	| { kind: 'rsn'; action: TicketAction; id: number }
	| { kind: 'tool'; tool: TicketTool; id: number }
	| { kind: 'usr'; mode: TicketUserSelectMode; id: number };

export function parseTicketCustomId(customId: string): ParsedTicketId | null {
	if (!customId.startsWith(TICKET_ID_PREFIX)) return null;
	const parts = customId.slice(TICKET_ID_PREFIX.length).split(':');
	const [kind, a, b] = parts;
	if ((kind === 'form' || kind === 'new') && parts.length === 2 && isTicketType(a)) return { kind, type: a };
	if ((kind === 'act' || kind === 'rsn') && parts.length === 3 && isTicketAction(a) && /^\d{1,9}$/.test(b)) {
		return { kind, action: a, id: Number(b) };
	}
	if (kind === 'tool' && parts.length === 3 && isTicketTool(a) && /^\d{1,9}$/.test(b)) {
		return { kind, tool: a, id: Number(b) };
	}
	if (kind === 'usr' && parts.length === 3 && (a === 'add' || a === 'remove') && /^\d{1,9}$/.test(b)) {
		return { kind, mode: a, id: Number(b) };
	}
	return null;
}

// Rendering. Raw Discord API JSON so it can be posted or edited directly.
const BUTTON = 2;
const ACTION_ROW = 1;
const TEXT_INPUT = 4;
const TEXT_SHORT = 1;
const TEXT_PARAGRAPH = 2;
const STYLE_PRIMARY = 1;
const STYLE_SECONDARY = 2;
const STYLE_SUCCESS = 3;
const STYLE_DANGER = 4;

const ACTION_STYLES: Record<TicketAction, number> = {
	confirm: STYLE_SUCCESS,
	ignore: STYLE_SECONDARY,
	ontest: STYLE_PRIMARY,
	live: STYLE_SUCCESS,
	wontfix: STYLE_DANGER
};

const ACTION_EMOJI: Record<TicketAction, string> = {
	confirm: '✅',
	ignore: '🗑️',
	ontest: '🧪',
	live: '🚀',
	wontfix: '⛔'
};

export function ticketButtonRows(ticket: Pick<TicketRecord, 'id' | 'status'>) {
	const actions = actionsForStatus(ticket.status);
	if (actions.length === 0) return [];
	return [
		{
			type: ACTION_ROW,
			components: actions.map(action => ({
				type: BUTTON,
				style: ACTION_STYLES[action],
				label: TICKET_ACTION_RULES[action].label,
				emoji: { name: ACTION_EMOJI[action] },
				custom_id: ticketActionButtonId(action, ticket.id)
			}))
		}
	];
}

export function ticketFormButtonLabel(type: TicketType): string {
	return type === 'bug' ? '🐞 Write bug report' : '💡 Write suggestion';
}

export function ticketTitle(ticket: Pick<TicketRecord, 'id' | 'type' | 'status'>): string {
	return `${TICKET_TYPE_ICONS[ticket.type]} ${TICKET_TYPE_LABELS[ticket.type]} #${ticket.id} · ${TICKET_STATUS_ICONS[ticket.status]} ${TICKET_STATUS_LABELS[ticket.status]}`;
}

/** Who handled it, with the central staff tier name. Embed mentions never ping. */
export function handledByLabel(userId: string, tier: StaffTier | null): string {
	const role = tier && tier !== 'none' ? ` [${STAFF_TIER_NAMES[tier]}]` : '';
	return `<@${userId}>${role}`;
}

export function ticketEmbed(ticket: TicketRecord) {
	const fields: { name: string; value: string; inline?: boolean }[] = [];
	const who = ticket.reporterId ? `<@${ticket.reporterId}>` : 'None';
	const sourceLabel =
		ticket.source === 'player'
			? 'Filed by'
			: ticket.source === 'auto'
				? 'Player (auto scan)'
				: 'Player (staff filed)';
	fields.push({ name: sourceLabel, value: who, inline: true });
	if (ticket.command)
		fields.push({ name: 'Command', value: `\`${ticket.command.replace(/`/g, "'")}\``, inline: true });
	fields.push({ name: 'What happened', value: ticket.what || '—' });
	if (ticket.screenshot) fields.push({ name: 'Screenshot', value: ticket.screenshot });
	if (ticket.handledBy) {
		fields.push({
			name: `${TICKET_STATUS_LABELS[ticket.status]} by`,
			value: handledByLabel(ticket.handledBy, ticket.handledByTier),
			inline: true
		});
	}
	if (ticket.reason) fields.push({ name: 'Reason', value: ticket.reason });
	if (ticket.claimedBy) fields.push({ name: 'Claimed by', value: `<@${ticket.claimedBy}>`, inline: true });
	const state = ticket.ticketChannelId
		? ` · ${ticket.closedAt ? '🔒 Closed' : ticket.visibility === 'public' ? '👀 Public' : '🔐 Private'}`
		: '';
	return {
		title: ticketTitle(ticket),
		color: TICKET_STATUS_COLORS[ticket.status],
		fields,
		footer: { text: `BSC tickets${state} · /staff tickets to see the queue` },
		timestamp: ticket.createdAt.toISOString()
	};
}

/** Content of the staff post. Only the staff role can ping (players are only shown in the embed, which never pings). */
export function ticketStaffContent(
	ticket: Pick<TicketRecord, 'id' | 'type' | 'source'>,
	staffRoleId: string | null
): string {
	const role = staffRoleId ? `<@&${staffRoleId}> ` : '';
	const kind = TICKET_TYPE_LABELS[ticket.type].toLowerCase();
	const lead =
		ticket.source === 'auto'
			? `🤖 Auto-filed ${kind}`
			: ticket.source === 'staff'
				? `📋 Staff-filed ${kind}`
				: `New ${kind}`;
	return `${role}${TICKET_TYPE_ICONS[ticket.type]} ${lead} ticket **#${ticket.id}**. Confirm or Ignore below.`;
}

/** The one-time player notice. Posted as a NEW message so the mention actually notifies. */
export function ticketNoticeContent(
	ticket: Pick<TicketRecord, 'id' | 'type' | 'reporterId'>,
	action: TicketAction
): string | null {
	if (!ticket.reporterId || !actionPingsReporter(action)) return null;
	const mention = `<@${ticket.reporterId}>`;
	const ref = `**Ticket #${ticket.id}**`;
	if (action === 'confirm') {
		return ticket.type === 'bug'
			? `${mention} ✅ ${ref}: staff confirmed your bug report. We're working on a fix.`
			: `${mention} ✅ ${ref}: staff picked up your suggestion. We're working on it.`;
	}
	return ticket.type === 'bug'
		? `${mention} 🚀 ${ref}: the fix for your bug report is now live. Thanks for reporting it!`
		: `${mention} 🚀 ${ref}: your suggestion is now live. Thanks for the idea!`;
}

export function ticketFiledReply(
	ticket: Pick<TicketRecord, 'id' | 'type'>,
	screenshotDropped: boolean,
	copy: 'channel' | 'dm' | 'none' = 'none'
): string {
	const skipped = screenshotDropped ? '\nThe screenshot link was skipped (it has to start with https://).' : '';
	const where =
		copy === 'channel'
			? ' A copy is in this channel so you can see it.'
			: copy === 'dm'
				? ' A copy was sent to your DMs.'
				: '';
	return `${TICKET_TYPE_ICONS[ticket.type]} **Ticket #${ticket.id}** sent to staff.${where} You'll get a ping here if staff confirm it.${skipped}`;
}

/** Visible filer copy. Never pings; staff buttons stay on the staff post only. */
export function ticketFilerCopyContent(ticket: Pick<TicketRecord, 'id' | 'type'>): string {
	const kind = TICKET_TYPE_LABELS[ticket.type].toLowerCase();
	return `${TICKET_TYPE_ICONS[ticket.type]} **Ticket #${ticket.id}** (${kind}) sent to staff. This is your copy. You'll get a ping if staff confirm it.`;
}

export function ticketHelpPrompt(type: TicketType): string {
	return type === 'bug'
		? '🐞 Found a bug? Press the button and tell us what happened. Staff will look at it.'
		: '💡 Got an idea? Press the button and tell us about it. Staff will look at it.';
}

export interface TicketModalSpec {
	custom_id: string;
	title: string;
	components: {
		type: number;
		components: {
			type: number;
			custom_id: string;
			style: number;
			label: string;
			required: boolean;
			placeholder?: string;
			min_length?: number;
			max_length: number;
		}[];
	}[];
}

function input(
	customId: string,
	label: string,
	style: number,
	required: boolean,
	max: number,
	placeholder?: string,
	min?: number
) {
	return {
		type: ACTION_ROW,
		components: [
			{
				type: TEXT_INPUT,
				custom_id: customId,
				style,
				label,
				required,
				placeholder,
				min_length: min,
				max_length: max
			}
		]
	};
}

export function ticketNewModal(type: TicketType): TicketModalSpec {
	const bug = type === 'bug';
	return {
		custom_id: ticketNewModalId(type),
		title: bug ? 'Report a bug' : 'Make a suggestion',
		components: [
			input(
				TICKET_INPUT_WHAT,
				bug ? 'What happened?' : 'What is your idea?',
				TEXT_PARAGRAPH,
				true,
				TICKET_WHAT_MAX,
				bug ? 'What you expected, and what happened instead.' : 'What should change, and why.',
				TICKET_WHAT_MIN
			),
			input(
				TICKET_INPUT_COMMAND,
				'Command used (optional)',
				TEXT_SHORT,
				false,
				TICKET_COMMAND_MAX,
				'/fish name:Leechfin'
			),
			input(
				TICKET_INPUT_SCREENSHOT,
				'Screenshot link (optional)',
				TEXT_SHORT,
				false,
				TICKET_SCREENSHOT_MAX,
				'https://...'
			)
		]
	};
}

export function ticketReasonModal(action: TicketAction, id: number): TicketModalSpec {
	return {
		custom_id: ticketReasonModalId(action, id),
		title: `${TICKET_ACTION_RULES[action].label} ticket #${id}`,
		components: [
			input(
				TICKET_INPUT_REASON,
				'Reason (optional, staff only)',
				TEXT_SHORT,
				false,
				TICKET_REASON_MAX,
				'Not a bug / duplicate of #12'
			)
		]
	};
}

/** Reads text inputs from a modal submit by custom_id. */
export function readModalInputs(data: {
	components?: readonly { components?: readonly { type: number; custom_id?: string; value?: string }[] }[];
}): Record<string, string> {
	const out: Record<string, string> = {};
	for (const row of data.components ?? []) {
		for (const comp of row.components ?? []) {
			if (comp.type === TEXT_INPUT && comp.custom_id && typeof comp.value === 'string')
				out[comp.custom_id] = comp.value;
		}
	}
	return out;
}

export function formatTicketAge(createdAt: Date, now: number): string {
	const mins = Math.max(0, Math.floor((now - createdAt.getTime()) / 60_000));
	if (mins < 60) return `${mins}m`;
	const hours = Math.floor(mins / 60);
	if (hours < 48) return `${hours}h`;
	return `${Math.floor(hours / 24)}d`;
}

export function ticketListLine(ticket: TicketRecord, now: number): string {
	const summary = cleanTicketLine(ticket.what.replace(/\\/g, ''), 70);
	const link =
		ticket.guildId && ticket.staffChannelId && ticket.staffMessageId && !ticket.channelDeletedAt
			? ` [view](<https://discord.com/channels/${ticket.guildId}/${ticket.staffChannelId}/${ticket.staffMessageId}>)`
			: '';
	const auto = ticket.source === 'auto' ? ' 🤖' : '';
	return `\`#${ticket.id}\` ${TICKET_TYPE_ICONS[ticket.type]}${auto} ${TICKET_STATUS_ICONS[ticket.status]} ${TICKET_STATUS_LABELS[ticket.status]} · ${formatTicketAge(ticket.createdAt, now)} · ${summary}${link}`;
}

/** Compact staff list. Always fits one message (drops extra lines and says how many). */
export function buildTicketList(tickets: TicketRecord[], heading: string, now: number): string {
	if (tickets.length === 0) return `**${heading}**\nNo tickets here. 🐶`;
	const head = `**${heading}** (${tickets.length})`;
	const lines: string[] = [];
	const budget = DISCORD_CONTENT_LIMIT - TICKET_LENGTH_MARGIN - 40;
	let length = head.length;
	for (const ticket of tickets.slice(0, TICKET_LIST_MAX_LINES)) {
		const line = ticketListLine(ticket, now);
		if (length + line.length + 1 > budget) break;
		lines.push(line);
		length += line.length + 1;
	}
	const hidden = tickets.length - lines.length;
	const more = hidden > 0 ? `\n…and ${hidden} more` : '';
	return `${head}\n${lines.join('\n')}${more}`;
}

export function embedTotalLength(embed: ReturnType<typeof ticketEmbed>): number {
	return (
		embed.title.length +
		(embed.footer?.text.length ?? 0) +
		embed.fields.reduce((sum, f) => sum + f.name.length + f.value.length, 0)
	);
}

// ---------------------------------------------------------------------------------------------------------
// Ticket channels (idea from Krypt's Server Helper bot, rewritten for BSC).
// Every ticket gets a private channel: the player who filed it, the staff role and the bot. Auto-filed and
// staff-filed tickets start staff-only; Confirm adds the player. Staff tools: Claim, Add User, Remove User,
// Make Public / Make Private, Close (locks + transcript), then Reopen / Delete.

export const TICKET_TOOLS = ['claim', 'add', 'remove', 'public', 'private', 'close', 'reopen', 'delete'] as const;
export type TicketTool = (typeof TICKET_TOOLS)[number];
export type TicketUserSelectMode = 'add' | 'remove';

export function isTicketTool(value: unknown): value is TicketTool {
	return typeof value === 'string' && (TICKET_TOOLS as readonly string[]).includes(value);
}

/**
 * The player who filed a ticket may Close it themselves (like Krypt's Server Helper bot). Only Close: Reopen,
 * Delete and every other tool stay staff-only. Closing only locks the channel and saves the transcript; the
 * ticket's status (open/confirmed/...) is untouched, so it still counts toward the one-waiting-ticket limit.
 */
export function filerCanClose(
	ticket: Pick<TicketRecord, 'reporterId' | 'ticketChannelId' | 'closedAt' | 'channelDeletedAt'>,
	userId: string
): boolean {
	return Boolean(
		ticket.reporterId &&
			ticket.reporterId === userId &&
			ticket.ticketChannelId &&
			!ticket.closedAt &&
			!ticket.channelDeletedAt
	);
}

/** Every channel tool is staff-only, except the filer may Close their own ticket. Delete only works on a closed ticket. */
export const TICKET_TOOL_RULES: Record<
	TicketTool,
	{ label: string; emoji: string; style: number; minTier: StaffTier }
> = {
	claim: { label: 'Claim', emoji: '🙋', style: STYLE_PRIMARY, minTier: 'moderator' },
	add: { label: 'Add User', emoji: '➕', style: STYLE_SECONDARY, minTier: 'moderator' },
	remove: { label: 'Remove User', emoji: '➖', style: STYLE_SECONDARY, minTier: 'moderator' },
	public: { label: 'Make Public', emoji: '👀', style: STYLE_SECONDARY, minTier: 'moderator' },
	private: { label: 'Make Private', emoji: '🔐', style: STYLE_SECONDARY, minTier: 'moderator' },
	close: { label: 'Close', emoji: '🔒', style: STYLE_DANGER, minTier: 'moderator' },
	reopen: { label: 'Reopen', emoji: '🔓', style: STYLE_SUCCESS, minTier: 'moderator' },
	delete: { label: 'Delete Channel', emoji: '🗑️', style: STYLE_DANGER, minTier: 'moderator' }
};

/** Max extra people staff can add to one ticket (on top of the player who filed it). */
export const TICKET_MAX_ADDED_USERS = 10;

type ChannelTicket = Pick<
	TicketRecord,
	'id' | 'status' | 'ticketChannelId' | 'claimedBy' | 'visibility' | 'closedAt' | 'channelDeletedAt'
>;

/** Which channel tools to show right now. Empty for tickets without a channel. */
export function ticketToolsFor(ticket: ChannelTicket): TicketTool[] {
	if (!ticket.ticketChannelId || ticket.channelDeletedAt) return [];
	if (ticket.closedAt) return ['reopen', 'delete'];
	return [
		...(ticket.claimedBy ? [] : (['claim'] as const)),
		'add',
		'remove',
		ticket.visibility === 'public' ? 'private' : 'public',
		'close'
	];
}

export function ticketToolRow(ticket: ChannelTicket) {
	const tools = ticketToolsFor(ticket);
	if (tools.length === 0) return [];
	return [
		{
			type: ACTION_ROW,
			components: tools.map(tool => ({
				type: BUTTON,
				style: TICKET_TOOL_RULES[tool].style,
				label: TICKET_TOOL_RULES[tool].label,
				emoji: { name: TICKET_TOOL_RULES[tool].emoji },
				custom_id: ticketToolButtonId(tool, ticket.id)
			}))
		}
	];
}

/** Status buttons (Confirm/Ignore, On test/Live/Won't fix) plus the channel tools row. */
export function ticketControlRows(ticket: ChannelTicket) {
	return [...ticketButtonRows(ticket), ...ticketToolRow(ticket)];
}

/** Ephemeral user picker for Add User / Remove User. */
export function ticketUserSelectRow(mode: TicketUserSelectMode, id: number) {
	return [
		{
			type: ACTION_ROW,
			components: [
				{
					type: 5, // User select
					custom_id: ticketUserSelectId(mode, id),
					placeholder: mode === 'add' ? 'Pick someone to add' : 'Pick someone to remove',
					min_values: 1,
					max_values: 1
				}
			]
		}
	];
}

/** Discord channel names: lowercase a-z, 0-9 and dashes, max 100. */
export function ticketChannelSlug(name: string | null | undefined): string {
	const slug = (name ?? '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 24)
		.replace(/-+$/g, '');
	return slug || 'player';
}

export function ticketChannelName(ticket: Pick<TicketRecord, 'id' | 'type'>, name: string | null | undefined): string {
	const num = String(ticket.id).padStart(4, '0');
	return `${ticket.type}-${num}-${ticketChannelSlug(name)}`;
}

export function ticketChannelTopic(
	ticket: Pick<TicketRecord, 'id' | 'type'>,
	visibility: TicketVisibility = 'private'
): string {
	const who =
		visibility === 'public'
			? 'Public: everyone can read and react. Only people in the ticket can type.'
			: 'Only the player, staff and anyone staff add can see this.';
	return `${TICKET_TYPE_ICONS[ticket.type]} ${TICKET_TYPE_LABELS[ticket.type]} ticket #${ticket.id}. ${who}`;
}

/** First message in a ticket channel. Pings the staff role; also the player on tickets they filed themselves. */
export function ticketChannelOpenContent(
	ticket: Pick<TicketRecord, 'id' | 'type' | 'source' | 'reporterId'>,
	staffRoleId: string | null
): string {
	const role = staffRoleId ? `<@&${staffRoleId}> ` : '';
	const kind = TICKET_TYPE_LABELS[ticket.type].toLowerCase();
	if (ticket.source === 'player' && ticket.reporterId) {
		return `${role}${TICKET_TYPE_ICONS[ticket.type]} New ${kind} ticket **#${ticket.id}** from <@${ticket.reporterId}>.\nThanks! Add any extra details or screenshots here. Only you and staff can see this channel.`;
	}
	const lead = ticket.source === 'auto' ? `🤖 Auto-filed ${kind}` : `📋 Staff-filed ${kind}`;
	return `${role}${TICKET_TYPE_ICONS[ticket.type]} ${lead} ticket **#${ticket.id}**. Staff only for now. Confirm adds the player.`;
}

/** Who the channel-open message may ping. */
export function ticketChannelOpenMentions(
	ticket: Pick<TicketRecord, 'source' | 'reporterId'>,
	staffRoleId: string | null
): { parse: never[]; users: string[]; roles: string[] } {
	return {
		parse: [],
		users: ticket.source === 'player' && ticket.reporterId ? [ticket.reporterId] : [],
		roles: staffRoleId ? [staffRoleId] : []
	};
}

/** Short, ping-free notes posted in the ticket channel when staff use a tool. */
export function ticketToolNote(
	tool: TicketTool | 'added' | 'removed',
	staffId: string,
	targetId?: string | null
): string {
	const who = `<@${staffId}>`;
	const target = targetId ? `<@${targetId}>` : 'someone';
	switch (tool) {
		case 'claim':
			return `🙋 ${who} claimed this ticket.`;
		case 'added':
			return `➕ ${who} added ${target} to this ticket.`;
		case 'removed':
			return `➖ ${who} removed ${target} from this ticket.`;
		case 'public':
			return `👀 ${who} made this ticket public. Everyone can read it and react, but only people in the ticket can type.`;
		case 'private':
			return `🔐 ${who} made this ticket private again.`;
		case 'close':
			return `🔒 ${who} closed this ticket. The transcript was saved for staff.`;
		case 'reopen':
			return `🔓 ${who} reopened this ticket.`;
		default:
			return `${who} updated this ticket.`;
	}
}

export function ticketPlayerReplyWithChannel(
	ticket: Pick<TicketRecord, 'id' | 'type'>,
	channelId: string,
	screenshotDropped: boolean
): string {
	const skipped = screenshotDropped ? '\nThe screenshot link was skipped (it has to start with https://).' : '';
	return `${TICKET_TYPE_ICONS[ticket.type]} **Ticket #${ticket.id}** is open in <#${channelId}>. Only you and staff can see it. Add any extra details there.${skipped}`;
}

// Channel permission overwrites (Discord bitfield strings).
export const TICKET_PERMS = {
	REACT: 1n << 6n,
	VIEW: 1n << 10n,
	SEND: 1n << 11n,
	EMBED: 1n << 14n,
	ATTACH: 1n << 15n,
	HISTORY: 1n << 16n,
	MENTION_EVERYONE: 1n << 17n,
	CREATE_PUBLIC_THREADS: 1n << 35n,
	CREATE_PRIVATE_THREADS: 1n << 36n,
	SEND_IN_THREADS: 1n << 38n
} as const;

const P = TICKET_PERMS;
const MEMBER_PERMS = P.VIEW | P.SEND | P.EMBED | P.ATTACH | P.HISTORY | P.REACT;
const READ_ONLY_PERMS = P.VIEW | P.HISTORY | P.REACT;
const NO_THREADS = P.CREATE_PUBLIC_THREADS | P.CREATE_PRIVATE_THREADS | P.SEND_IN_THREADS;

export interface TicketOverwrite {
	id: string;
	type: 0 | 1; // 0 role, 1 member
	allow: string;
	deny: string;
}

function ow(id: string, type: 0 | 1, allow: bigint, deny: bigint): TicketOverwrite {
	return { id, type, allow: allow.toString(), deny: deny.toString() };
}

/** @everyone: hidden when private; read + react only when public. Nobody but staff can make threads. */
export function ticketEveryoneOverwrite(guildId: string, visibility: TicketVisibility): TicketOverwrite {
	return visibility === 'public'
		? ow(guildId, 0, READ_ONLY_PERMS, P.SEND | NO_THREADS)
		: ow(guildId, 0, 0n, P.VIEW | NO_THREADS);
}

/** The player and anyone staff add. Closed tickets are read-only for them. Never @everyone pings. */
export function ticketMemberOverwrite(userId: string, closed: boolean): TicketOverwrite {
	return closed
		? ow(userId, 1, READ_ONLY_PERMS, P.SEND | NO_THREADS | P.MENTION_EVERYONE)
		: ow(userId, 1, MEMBER_PERMS, NO_THREADS | P.MENTION_EVERYONE);
}

/**
 * Discord only lets the bot allow or deny permissions it has itself. Trims an overwrite to the bot's server
 * permissions, so a missing optional one (like Mention Everyone) never blocks the ticket. VIEW is always kept,
 * so privacy never silently drops (Discord then refuses the change and the ticket falls back).
 */
export function maskTicketOverwrite(o: TicketOverwrite, botPerms: bigint): TicketOverwrite {
	const keep = botPerms | P.VIEW;
	return { ...o, allow: (BigInt(o.allow) & keep).toString(), deny: (BigInt(o.deny) & keep).toString() };
}

export function ticketStaffOverwrite(roleId: string): TicketOverwrite {
	return ow(roleId, 0, MEMBER_PERMS, 0n);
}

export function ticketBotOverwrite(botId: string): TicketOverwrite {
	return ow(botId, 1, MEMBER_PERMS, 0n);
}

/** The full overwrite list for a new ticket channel. */
export function buildTicketOverwrites(opts: {
	guildId: string;
	botId: string;
	staffRoleId: string | null;
	memberIds: string[];
	visibility: TicketVisibility;
	closed: boolean;
}): TicketOverwrite[] {
	const out = [ticketEveryoneOverwrite(opts.guildId, opts.visibility), ticketBotOverwrite(opts.botId)];
	if (opts.staffRoleId) out.push(ticketStaffOverwrite(opts.staffRoleId));
	for (const id of [...new Set(opts.memberIds)]) {
		if (id !== opts.botId && id !== opts.guildId) out.push(ticketMemberOverwrite(id, opts.closed));
	}
	return out;
}

/** True once the player who the ticket is about should see the channel. */
export function reporterHasChannelAccess(ticket: Pick<TicketRecord, 'source' | 'status' | 'reporterId'>): boolean {
	if (!ticket.reporterId) return false;
	return ticket.source === 'player' || !['open', 'ignored'].includes(ticket.status);
}

// Transcripts.
export interface TranscriptMessage {
	authorName: string;
	authorId: string;
	bot: boolean;
	content: string;
	timestamp: string;
	attachmentUrls: string[];
	embedTitles: string[];
}

export const TICKET_TRANSCRIPT_MAX_MESSAGES = 100;

/** Plain text transcript, oldest first. Runs as a .txt attachment, so it never pings anyone. */
/** "Nov 25, 2026, 9:15 PM CT". Ticket logs and transcripts use the server's time zone (America/Chicago). */
export function formatTicketTimeCT(date: Date): string {
	const text = new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/Chicago',
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	}).format(date);
	return `${text} CT`;
}

/** "Blaf (179896682337665024)", or just the id if the name could not be looked up. */
export function ticketPersonLabel(name: string | null | undefined, id: string | null): string {
	if (!id) return 'none';
	const clean = (name ?? '')
		.replace(/[\r\n]/g, ' ')
		.trim()
		.slice(0, 40);
	return clean ? `${clean} (${id})` : id;
}

export function buildTicketTranscript(
	ticket: Pick<TicketRecord, 'id' | 'type' | 'reporterId'>,
	channelName: string,
	closedBy: { id: string; name: string | null },
	messagesNewestFirst: TranscriptMessage[],
	now: Date,
	playerName: string | null = null
): string {
	const lines = [
		`BSC ticket transcript: ${TICKET_TYPE_LABELS[ticket.type]} #${ticket.id} (#${channelName})`,
		`Player: ${ticketPersonLabel(playerName, ticket.reporterId)}`,
		`Closed by: ${ticketPersonLabel(closedBy.name, closedBy.id)}`,
		`Closed at: ${formatTicketTimeCT(now)}`,
		`Messages: ${messagesNewestFirst.length} (most recent ${TICKET_TRANSCRIPT_MAX_MESSAGES} max)`,
		''.padEnd(60, '-')
	];
	for (const m of [...messagesNewestFirst].reverse()) {
		const extras = [...m.embedTitles.map(t => `[embed: ${t}]`), ...m.attachmentUrls.map(u => `[file: ${u}]`)].join(
			' '
		);
		const body = [m.content.replace(/\r/g, ''), extras].filter(Boolean).join(' ');
		const when = Number.isNaN(Date.parse(m.timestamp)) ? m.timestamp : formatTicketTimeCT(new Date(m.timestamp));
		lines.push(`[${when}] ${m.authorName}${m.bot ? ' [BOT]' : ''} (${m.authorId}): ${body || '(no text)'}`);
	}
	return lines.join('\n');
}

export function ticketTranscriptFileName(ticket: Pick<TicketRecord, 'id' | 'type'>): string {
	return `${ticket.type}-${String(ticket.id).padStart(4, '0')}-transcript.txt`;
}

/** The staff-log message the transcript file is attached to. Never pings. */
export function ticketTranscriptLogContent(
	ticket: Pick<TicketRecord, 'id' | 'type' | 'reporterId'>,
	closedById: string,
	channelName: string
): string {
	const player = ticket.reporterId ? ` Player: <@${ticket.reporterId}>.` : '';
	const filer = ticket.reporterId === closedById ? ' (filer)' : '';
	// Plain channel name, not a <#id> mention: the mention shows #unknown once the channel is deleted.
	return `📜 ${TICKET_TYPE_ICONS[ticket.type]} ${TICKET_TYPE_LABELS[ticket.type]} **#${ticket.id}** closed by <@${closedById}>${filer} in \`#${ticketChannelSlugName(channelName)}\`.${player}`;
}

/** Channel names are already a-z0-9 and dashes; this just guards the log line against anything odd. */
function ticketChannelSlugName(name: string): string {
	return name.replace(/[^a-z0-9-]/gi, '').slice(0, 100) || 'ticket';
}

export function ticketDeletedLogContent(
	ticket: Pick<TicketRecord, 'id' | 'type'>,
	staffId: string,
	channelName: string
): string {
	return `🗑️ ${TICKET_TYPE_ICONS[ticket.type]} ${TICKET_TYPE_LABELS[ticket.type]} **#${ticket.id}** channel \`#${ticketChannelSlugName(channelName)}\` deleted by <@${staffId}>.`;
}
