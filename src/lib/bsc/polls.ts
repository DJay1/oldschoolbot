import { EmbedBuilder } from '@oldschoolgg/discord';
import { Time } from '@oldschoolgg/toolkit';
import { Duration } from '@sapphire/time-utilities';
import { DateTime } from 'luxon';


export const POLL_DJ_USER_ID = '290167629966999552';
export const POLL_STAFF_CHANNEL_ID = '1510687250420072498';
export const POLL_STAFF_CHANNEL_NAME = 'staffy-waffys';
export const POLL_STAFF_ROLE_NAMES = ['Developer', 'Contributor'] as const;
export const POLL_DEFAULT_DURATION_MS = Time.Day * 2;
export const POLL_MIN_DURATION_MS = Time.Hour;
export const POLL_MAX_DURATION_MS = Time.Day * 14;
export const POLL_MIN_VOTES = 7;
export const POLL_PASS_RATIO = 0.7;
export const POLL_REPOLL_RATIO = 0.6;
export const POLL_REPOLL_WINDOW_MS = Time.Day * 5;
export const POLL_TIMEZONE = 'America/Chicago';
export const POLL_UPDATE_PICK_ID = 'POLL_UPD_PICK';
export const POLL_UPDATE_STATUS_PREFIX = 'POLL_UPD_STATUS:';

export const POLL_STATUSES = [
	'Open',
	'Passed',
	'In progress',
	'Done',
	'Rejected',
	'Repoll',
	'Failed'
] as const;

export type PollStatus = (typeof POLL_STATUSES)[number];
export const POLL_UPDATEABLE_STATUSES: PollStatus[] = ['Passed', 'In progress', 'Repoll'];
export const POLL_UPDATE_TARGET_STATUSES: PollStatus[] = ['In progress', 'Done', 'Rejected'];

export interface PollRecord {
	id: string;
	guildId: string;
	channelId: string;
	messageId: string;
	question: string;
	creatorId: string;
	createdAt: number;
	closesAt: number;
	status: PollStatus;
	yes: number;
	no: number;
	total: number;
	percent: number | null;
	note: string | null;
	isRepoll: boolean;
	originalPollId: string | null;
	repollId: string | null;
	repollDeadline: number | null;
	updatedAt: number;
}

export function parsePollDuration(input?: string | null): { ok: true; ms: number } | { ok: false; message: string } {
	if (!input || !input.trim()) {
		return { ok: true, ms: POLL_DEFAULT_DURATION_MS };
	}
	const duration = new Duration(input.trim());
	const ms = duration.offset;
	if (!ms || !Number.isFinite(ms) || ms <= 0) {
		return { ok: false, message: 'Duration must look like 12h, 2d, or 7d.' };
	}
	if (ms < POLL_MIN_DURATION_MS || ms > POLL_MAX_DURATION_MS) {
		return {
			ok: false,
			message: 'Poll duration must be between 1 hour and 14 days (default is 2 days).'
		};
	}
	return { ok: true, ms };
}

export function countedPollVotes(
	yesUsers: string[],
	noUsers: string[],
	minionUserIds: Set<string>,
	botId: string
): { yes: number; no: number; total: number; percent: number | null; excluded: number } {
	const yesSet = new Set(yesUsers.filter(id => id !== botId));
	const noSet = new Set(noUsers.filter(id => id !== botId));
	const both = new Set<string>();
	for (const id of yesSet) {
		if (noSet.has(id)) both.add(id);
	}
	let yes = 0;
	let no = 0;
	let excluded = both.size;
	for (const id of yesSet) {
		if (both.has(id)) continue;
		if (!minionUserIds.has(id)) {
			excluded++;
			continue;
		}
		yes++;
	}
	for (const id of noSet) {
		if (both.has(id)) continue;
		if (!minionUserIds.has(id)) {
			excluded++;
			continue;
		}
		no++;
	}
	const total = yes + no;
	const percent = total === 0 ? null : (yes / total) * 100;
	return { yes, no, total, percent, excluded };
}

export function pollCloseOutcome(
	yes: number,
	no: number,
	isRepoll: boolean
): { status: 'Passed' | 'Repoll' | 'Failed'; total: number; percent: number } {
	const total = yes + no;
	const percent = total === 0 ? 0 : (yes / total) * 100;
	if (total < POLL_MIN_VOTES) return { status: 'Failed', total, percent };
	if (percent >= POLL_PASS_RATIO * 100) return { status: 'Passed', total, percent };
	if (percent >= POLL_REPOLL_RATIO * 100) {
		return { status: isRepoll ? 'Failed' : 'Repoll', total, percent };
	}
	return { status: 'Failed', total, percent };
}

export function canCreateRepoll(poll: PollRecord, userId: string, now = Date.now()): boolean {
	if (userId !== POLL_DJ_USER_ID && userId !== poll.creatorId) return false;
	if (poll.status !== 'Repoll') return false;
	if (poll.isRepoll || poll.repollId) return false;
	if (poll.repollDeadline && now > poll.repollDeadline) return false;
	return true;
}

export function canDeletePoll(userId: string): boolean {
	return userId === POLL_DJ_USER_ID;
}

export function canUpdatePollStatus(userId: string, staffRole: boolean): boolean {
	return userId === POLL_DJ_USER_ID || staffRole;
}

export function isPollStillUpdateable(poll: PollRecord): boolean {
	return POLL_UPDATEABLE_STATUSES.includes(poll.status);
}

export function isAllowedUpdateTarget(status: string): status is PollStatus {
	return POLL_UPDATE_TARGET_STATUSES.includes(status as PollStatus);
}

export function weeklyPollReminderWeekId(now = Date.now()): string {
	const local = DateTime.fromMillis(now, { zone: POLL_TIMEZONE });
	const monday = local.minus({ days: local.weekday - 1 }).startOf('day');
	return monday.toISODate() ?? monday.toFormat('yyyy-MM-dd');
}

export function shouldPostWeeklyPollReminder(now = Date.now()): boolean {
	const local = DateTime.fromMillis(now, { zone: POLL_TIMEZONE });
	if (local.weekday !== 1) return false;
	return local.hour > 10 || (local.hour === 10 && local.minute >= 0);
}

export function truncatePollText(text: string, max: number): string {
	const trimmed = text.replace(/\s+/g, ' ').trim();
	if (trimmed.length <= max) return trimmed;
	return `${trimmed.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function formatPollPercent(percent: number | null): string {
	if (percent === null) return '—';
	return `${percent.toFixed(1)}%`;
}

export function pollMessageUrl(poll: PollRecord): string {
	return `https://discord.com/channels/${poll.guildId}/${poll.channelId}/${poll.messageId}`;
}

export function formatPollListLine(poll: PollRecord): string {
	const title = truncatePollText(poll.question, 80);
	const pct = poll.status === 'Open' ? 'open' : formatPollPercent(poll.percent);
	const note = poll.note ? ` — ${truncatePollText(poll.note, 60)}` : '';
	return `[${title}](${pollMessageUrl(poll)}) · ${pct} · ${poll.status}${note}`;
}

export function groupPollsByStatus(polls: PollRecord[]): { status: PollStatus; polls: PollRecord[] }[] {
	return POLL_STATUSES.map(status => ({
		status,
		polls: polls.filter(p => p.status === status).sort((a, b) => b.updatedAt - a.updatedAt)
	})).filter(group => group.polls.length > 0);
}

export function buildPollListPages(polls: PollRecord[], pageSize = 12): { embeds: EmbedBuilder[] }[] {
	const groups = groupPollsByStatus(polls);
	const chunks: { heading: string; lines: string[] }[] = [];
	for (const group of groups) {
		const heading = group.status === 'Passed' ? 'Passed (waiting implementation)' : group.status;
		const lines = group.polls.map(formatPollListLine);
		for (let i = 0; i < lines.length; i += pageSize) {
			chunks.push({ heading, lines: lines.slice(i, i + pageSize) });
		}
	}
	if (chunks.length === 0) {
		return [
			{
				embeds: [
					new EmbedBuilder().setColor(0x58_65_f2).setTitle('Polls').setDescription('No tracked polls yet.')
				]
			}
		];
	}
	return chunks.map((chunk, index) => ({
		embeds: [
			new EmbedBuilder()
				.setColor(0x58_65_f2)
				.setTitle(chunks.length > 1 ? `Polls (${index + 1}/${chunks.length})` : 'Polls')
				.setDescription(`**${chunk.heading}**\n${chunk.lines.join('\n')}`)
				
		]
	}));
}

export function closeResultSummary(poll: PollRecord): string {
	const pct = formatPollPercent(poll.percent);
	const scores = `${poll.yes} Yes / ${poll.total} counted (${pct} yes)`;
	switch (poll.status) {
		case 'Passed':
			return `Your poll passed and is waiting for implementation. ${scores}`;
		case 'Repoll':
			return `Your poll is eligible for a repoll (60–69% yes). Use /poll repoll within 5 days or it will fail. ${scores}`;
		case 'Failed':
			return `Your poll failed. ${scores}`;
		default:
			return `Your poll closed as ${poll.status}. ${scores}`;
	}
}

export function pollResultEmbed(poll: PollRecord): EmbedBuilder {
	const closes = poll.status === 'Open' ? `\n\nCloses <t:${Math.floor(poll.closesAt / 1000)}:R>.` : '';
	const result =
		poll.status === 'Open'
			? '\n\nReact with Yes / No.'
			: `\n\n**${poll.status === 'Passed' ? 'Passed (waiting implementation)' : poll.status}** — ${poll.yes} Yes / ${poll.no} No (${formatPollPercent(poll.percent)} yes, ${poll.total} counted).`;
	const note = poll.note ? `\nNote: ${poll.note}` : '';
	const footer = poll.isRepoll ? 'Repoll' : 'Poll';
	return new EmbedBuilder()
		.setColor(0x58_65_f2)
		.setTitle('Poll')
		.setDescription(`**${poll.question}**${result}${closes}${note}`)
		.setFooter({ text: footer });
}