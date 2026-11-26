import { describe, expect, test } from 'vitest';

import { STAFF_TIER_NAMES, staffActionsFor } from '@/lib/bsc/staffTiers.js';
import {
	actionsForStatus,
	buildTicketList,
	buildTicketOverwrites,
	buildTicketTranscript,
	cleanScreenshotLink,
	DISCORD_BUTTON_LABEL_LIMIT,
	DISCORD_CONTENT_LIMIT,
	DISCORD_CUSTOM_ID_LIMIT,
	DISCORD_EMBED_FIELD_VALUE_LIMIT,
	DISCORD_EMBED_TITLE_LIMIT,
	DISCORD_EMBED_TOTAL_LIMIT,
	DISCORD_MODAL_TITLE_LIMIT,
	DISCORD_TEXT_INPUT_LABEL_LIMIT,
	embedTotalLength,
	maskTicketOverwrite,
	neutralizeMentions,
	parseTicketCustomId,
	playerTicketLimitError,
	prepareNewTicket,
	readModalInputs,
	reporterHasChannelAccess,
	resolveTicketStaffRoleId,
	TEST_TICKET_STAFF_ROLE_FALLBACK_ID,
	TICKET_ACTION_RULES,
	TICKET_ACTIONS,
	TICKET_LENGTH_MARGIN,
	TICKET_MAX_OPEN_PER_PLAYER,
	TICKET_PERMS,
	TICKET_PLAYER_COOLDOWN_MS,
	TICKET_STATUSES,
	TICKET_TOOLS,
	TICKET_TYPES,
	type TicketRecord,
	ticketActionButtonId,
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
	ticketFormButtonId,
	ticketFormButtonLabel,
	ticketHelpPrompt,
	ticketMemberOverwrite,
	ticketNewModal,
	ticketNoticeContent,
	ticketPlayerReplyWithChannel,
	ticketReasonModal,
	ticketReasonModalId,
	ticketStaffContent,
	ticketToolButtonId,
	ticketToolNote,
	ticketToolsFor,
	ticketTranscriptFileName,
	ticketTranscriptLogContent,
	ticketUserSelectId,
	ticketUserSelectRow
} from '@/lib/bsc/tickets.js';

const ID = '123456789012345678';
const BIG_ID = 999_999_999;

function worstTicket(overrides: Partial<TicketRecord> = {}): TicketRecord {
	const prepared = prepareNewTicket({
		type: 'suggestion',
		source: 'player',
		reporterId: ID,
		filedBy: ID,
		guildId: ID,
		originChannelId: ID,
		// Markdown escaping can double characters; the cap still applies after cleaning.
		what: '*_`~|>'.repeat(400),
		command: '`*_'.repeat(200),
		screenshot: `https://cdn.discordapp.com/${'a'.repeat(260)}`
	});
	if (!prepared.ok) throw new Error(prepared.error);
	return {
		id: BIG_ID,
		...prepared.ticket,
		status: 'wont_fix',
		staffChannelId: ID,
		staffMessageId: ID,
		noticeMessageId: ID,
		handledBy: ID,
		handledByTier: 'developer',
		reason: 'r'.repeat(200),
		createdAt: new Date(0),
		updatedAt: new Date(0),
		...overrides
	};
}

describe('ticket Discord length limits (150 under)', () => {
	test('staff embed worst case', () => {
		for (const status of TICKET_STATUSES) {
			for (const source of ['player', 'staff', 'auto'] as const) {
				const embed = ticketEmbed(worstTicket({ status, source }));
				expect(embed.title.length).toBeLessThanOrEqual(DISCORD_EMBED_TITLE_LIMIT - TICKET_LENGTH_MARGIN);
				for (const f of embed.fields) {
					expect(f.value.length).toBeLessThanOrEqual(DISCORD_EMBED_FIELD_VALUE_LIMIT - TICKET_LENGTH_MARGIN);
					expect(f.name.length).toBeLessThanOrEqual(256 - TICKET_LENGTH_MARGIN);
				}
				expect(embedTotalLength(embed)).toBeLessThanOrEqual(DISCORD_EMBED_TOTAL_LIMIT - TICKET_LENGTH_MARGIN);
			}
		}
	});

	test('staff content, notices and replies', () => {
		const t = worstTicket();
		for (const source of ['player', 'staff', 'auto'] as const) {
			expect(ticketStaffContent({ ...t, source }, ID).length).toBeLessThanOrEqual(
				DISCORD_CONTENT_LIMIT - TICKET_LENGTH_MARGIN
			);
		}
		for (const type of TICKET_TYPES) {
			for (const action of TICKET_ACTIONS) {
				const notice = ticketNoticeContent({ ...t, type }, action);
				if (notice) expect(notice.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - TICKET_LENGTH_MARGIN);
			}
			expect(ticketFiledReply({ id: BIG_ID, type }, true, 'channel').length).toBeLessThanOrEqual(
				DISCORD_CONTENT_LIMIT - TICKET_LENGTH_MARGIN
			);
			expect(ticketHelpPrompt(type).length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - TICKET_LENGTH_MARGIN);
			expect(ticketFormButtonLabel(type).length).toBeLessThanOrEqual(DISCORD_BUTTON_LABEL_LIMIT - 40);
		}
	});

	test('staff list always fits with many long tickets', () => {
		const many = Array.from({ length: 200 }, (_, i) => worstTicket({ id: BIG_ID - i, status: 'open' }));
		const text = buildTicketList(many, 'Tickets not closed', Date.now());
		expect(text.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - TICKET_LENGTH_MARGIN);
		expect(text).toContain('more');
		expect(buildTicketList([], 'Tickets: Open', Date.now())).toContain('No tickets');
	}, 30_000);

	test('/staff help (admin, the longest) still fits with the ticket lines', () => {
		const lines = [`**Your staff role: ${STAFF_TIER_NAMES.admin}**`, ''];
		for (const a of staffActionsFor('admin')) lines.push(`**${a.command}**: ${a.help}`);
		lines.push(
			'',
			'**Boosts left this week** (each adds 30 min, resets Monday 12:00 AM CT):',
			'Double Loot: 4/4',
			'Double XP: 4/4'
		);
		expect(lines.join('\n').length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - TICKET_LENGTH_MARGIN);
	});

	test('buttons, custom ids and modals', () => {
		for (const status of TICKET_STATUSES) {
			for (const row of ticketButtonRows({ id: BIG_ID, status })) {
				expect(row.components.length).toBeLessThanOrEqual(5);
				for (const b of row.components) {
					expect(b.label.length).toBeLessThanOrEqual(DISCORD_BUTTON_LABEL_LIMIT - 40);
					expect(b.custom_id.length).toBeLessThanOrEqual(DISCORD_CUSTOM_ID_LIMIT - 40);
				}
			}
		}
		for (const type of TICKET_TYPES) {
			const m = ticketNewModal(type);
			expect(m.title.length).toBeLessThanOrEqual(DISCORD_MODAL_TITLE_LIMIT);
			expect(m.components.length).toBeLessThanOrEqual(5);
			for (const row of m.components) {
				expect(row.components[0].label.length).toBeLessThanOrEqual(DISCORD_TEXT_INPUT_LABEL_LIMIT);
				expect((row.components[0].placeholder ?? '').length).toBeLessThanOrEqual(100);
			}
		}
		for (const action of TICKET_ACTIONS) {
			const m = ticketReasonModal(action, BIG_ID);
			expect(m.title.length).toBeLessThanOrEqual(DISCORD_MODAL_TITLE_LIMIT);
			expect(m.components[0].components[0].label.length).toBeLessThanOrEqual(DISCORD_TEXT_INPUT_LABEL_LIMIT);
		}
	});
});

describe('ticket safety', () => {
	test('player text can never ping @everyone, roles or users', () => {
		const p = prepareNewTicket({
			type: 'bug',
			source: 'player',
			reporterId: ID,
			filedBy: ID,
			guildId: null,
			originChannelId: null,
			what: 'hey @everyone and @here look <@&1325179339641458749> <@123456789012345678>',
			command: '@everyone'
		});
		expect(p.ok).toBe(true);
		if (!p.ok) return;
		expect(p.ticket.what).not.toMatch(/@(everyone|here)/);
		expect(p.ticket.what).not.toMatch(/<@[!&]?\d+>/);
		expect(p.ticket.command).not.toMatch(/@everyone/);
		expect(neutralizeMentions('<@!1234567>')).not.toMatch(/<@!?\d+>/);
	});

	test('staff post only pings the staff role, notices only the reporter', () => {
		const content = ticketStaffContent({ id: 1, type: 'bug', source: 'auto' }, '42424242');
		expect(content).toContain('<@&42424242>');
		expect(content).not.toContain('<@1');
		expect(ticketStaffContent({ id: 1, type: 'bug', source: 'player' }, null)).not.toContain('<@');
		const notice = ticketNoticeContent({ id: 1, type: 'bug', reporterId: ID }, 'confirm')!;
		expect(notice.startsWith(`<@${ID}>`)).toBe(true);
		expect(ticketNoticeContent({ id: 1, type: 'bug', reporterId: ID }, 'ignore')).toBeNull();
		expect(ticketNoticeContent({ id: 1, type: 'bug', reporterId: ID }, 'ontest')).toBeNull();
		expect(ticketNoticeContent({ id: 1, type: 'bug', reporterId: null }, 'confirm')).toBeNull();
	});

	test('validation and caps', () => {
		const base = {
			type: 'bug' as const,
			source: 'player' as const,
			reporterId: ID,
			filedBy: ID,
			guildId: null,
			originChannelId: null
		};
		expect(prepareNewTicket({ ...base, what: 'short' }).ok).toBe(false);
		expect(prepareNewTicket({ ...base, type: 'admin' as unknown as 'bug', what: 'long enough text here' }).ok).toBe(
			false
		);
		expect(prepareNewTicket({ ...base, reporterId: 'abc', what: 'long enough text here' }).ok).toBe(false);
		const ok = prepareNewTicket({ ...base, what: 'x'.repeat(5000), screenshot: 'javascript:alert(1)' });
		expect(ok.ok).toBe(true);
		if (ok.ok) {
			expect(ok.ticket.what.length).toBeLessThanOrEqual(500);
			expect(ok.ticket.screenshot).toBeNull();
			expect(ok.ticket.screenshotDropped).toBe(true);
		}
		expect(cleanScreenshotLink('https://i.imgur.com/abc.png')).toBe('https://i.imgur.com/abc.png');
		expect(cleanScreenshotLink('http://x.com/a.png')).toBeNull();
		expect(cleanScreenshotLink('https://x.com/a) [x](https://evil')).toBeNull();
	});

	test('player anti-spam', () => {
		const now = Date.now();
		expect(playerTicketLimitError({ openCount: 0, lastCreatedAt: null, now })).toBeNull();
		expect(playerTicketLimitError({ openCount: TICKET_MAX_OPEN_PER_PLAYER, lastCreatedAt: null, now })).toMatch(
			/already/
		);
		expect(playerTicketLimitError({ openCount: 0, lastCreatedAt: new Date(now - 1000), now })).toMatch(/min/);
		expect(
			playerTicketLimitError({ openCount: 0, lastCreatedAt: new Date(now - TICKET_PLAYER_COOLDOWN_MS - 1), now })
		).toBeNull();
	});

	test('status moves and tiers', () => {
		expect(actionsForStatus('open')).toEqual(['confirm', 'ignore']);
		expect(actionsForStatus('confirmed')).toEqual(['ontest', 'live', 'wontfix']);
		expect(actionsForStatus('on_test')).toEqual(['live', 'wontfix']);
		for (const closed of ['live', 'ignored', 'wont_fix'] as const) expect(actionsForStatus(closed)).toEqual([]);
		expect(TICKET_ACTION_RULES.confirm.minTier).toBe('moderator');
		expect(TICKET_ACTION_RULES.ignore.minTier).toBe('moderator');
		expect(TICKET_ACTION_RULES.live.minTier).toBe('developer');
	});

	test('custom ids round trip and reject junk', () => {
		expect(parseTicketCustomId(ticketFormButtonId('bug'))).toEqual({ kind: 'form', type: 'bug' });
		expect(parseTicketCustomId(ticketActionButtonId('confirm', 12))).toEqual({
			kind: 'act',
			action: 'confirm',
			id: 12
		});
		expect(parseTicketCustomId(ticketReasonModalId('ignore', 7))).toEqual({ kind: 'rsn', action: 'ignore', id: 7 });
		expect(parseTicketCustomId('TKT:act:delete:1')).toBeNull();
		expect(parseTicketCustomId('TKT:act:confirm:1;DROP')).toBeNull();
		expect(parseTicketCustomId('QC:x')).toBeNull();
	});

	test('reads modal inputs by id', () => {
		const out = readModalInputs({
			components: [
				{ components: [{ type: 4, custom_id: 'what', value: 'hello' }] },
				{ components: [{ type: 4, custom_id: 'command', value: '/fish' }] }
			]
		});
		expect(out).toEqual({ what: 'hello', command: '/fish' });
	});

	test('filer copy never pings and stays under the Discord length limit', () => {
		for (const type of TICKET_TYPES) {
			for (const copy of ['channel', 'dm', 'none'] as const) {
				expect(ticketFiledReply({ id: BIG_ID, type }, true, copy).length).toBeLessThanOrEqual(
					DISCORD_CONTENT_LIMIT - TICKET_LENGTH_MARGIN
				);
			}
			const copy = ticketFilerCopyContent({ id: BIG_ID, type });
			expect(copy.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - TICKET_LENGTH_MARGIN);
			expect(copy).not.toMatch(/<@/);
			expect(copy).not.toMatch(/@(everyone|here)/);
		}
	});

	test('test bot falls back to the test Mod role when no staff role env is set', () => {
		expect(resolveTicketStaffRoleId(null, false)).toBe(TEST_TICKET_STAFF_ROLE_FALLBACK_ID);
		expect(resolveTicketStaffRoleId(null, true)).toBeNull();
		expect(resolveTicketStaffRoleId(ID, true)).toBe(ID);
		expect(resolveTicketStaffRoleId(ID, false)).toBe(ID);
	});
});

describe('ticket channels (Krypt-style, private by default)', () => {
	const limit = DISCORD_CONTENT_LIMIT - TICKET_LENGTH_MARGIN;
	const channelTicket = (o: Partial<TicketRecord> = {}) =>
		worstTicket({
			ticketChannelId: ID,
			claimedBy: ID,
			visibility: 'private',
			closedAt: null,
			channelDeletedAt: null,
			addedUserIds: [],
			...o
		});

	test('channel names look like bug-0007-salty and always fit', () => {
		expect(ticketChannelName({ id: 7, type: 'bug' }, 'Salty')).toBe('bug-0007-salty');
		expect(ticketChannelName({ id: 8, type: 'suggestion' }, 'Name')).toBe('suggestion-0008-name');
		expect(ticketChannelName({ id: 9, type: 'bug' }, '!!!')).toBe('bug-0009-player');
		expect(ticketChannelName({ id: 10, type: 'bug' }, null)).toBe('bug-0010-player');
		const worst = ticketChannelName({ id: BIG_ID, type: 'suggestion' }, `${'Ab_c.'.repeat(40)}`);
		expect(worst.length).toBeLessThanOrEqual(100 - TICKET_LENGTH_MARGIN / 3);
		expect(worst).toMatch(/^[a-z0-9-]+$/);
		expect(worst.endsWith('-')).toBe(false);
	});

	test('worst-case channel messages stay 150 under the limits', () => {
		const t = channelTicket();
		for (const content of [
			ticketChannelOpenContent({ ...t, source: 'player' }, ID),
			ticketChannelOpenContent({ ...t, source: 'auto' }, ID),
			ticketChannelOpenContent({ ...t, source: 'staff' }, ID),
			ticketPlayerReplyWithChannel(t, ID, true),
			ticketTranscriptLogContent(t, ID, ID),
			ticketDeletedLogContent(t, ID),
			...(['claim', 'public', 'private', 'close', 'reopen', 'added', 'removed'] as const).map(k =>
				ticketToolNote(k, ID, ID)
			),
			'🔒 <@123456789012345678> closed this ticket. The transcript could not be saved.'
		]) {
			expect(content.length).toBeLessThan(limit);
		}
		expect(ticketChannelTopic(t).length).toBeLessThan(1024 - TICKET_LENGTH_MARGIN);
		expect(ticketTranscriptFileName(t)).toBe('suggestion-999999999-transcript.txt');
	});

	test('embed with claim and state footer stays under every embed limit', () => {
		for (const o of [{}, { visibility: 'public' as const }, { closedAt: new Date(0) }]) {
			const embed = ticketEmbed(channelTicket(o));
			expect(embed.title.length).toBeLessThan(DISCORD_EMBED_TITLE_LIMIT - TICKET_LENGTH_MARGIN);
			for (const f of embed.fields) {
				expect(f.value.length).toBeLessThan(DISCORD_EMBED_FIELD_VALUE_LIMIT - TICKET_LENGTH_MARGIN);
			}
			expect(embed.fields.length).toBeLessThanOrEqual(25);
			expect(embedTotalLength(embed)).toBeLessThan(DISCORD_EMBED_TOTAL_LIMIT - TICKET_LENGTH_MARGIN);
		}
	});

	test('tool buttons: labels, ids, row sizes', () => {
		for (const tool of TICKET_TOOLS) {
			expect(ticketToolButtonId(tool, BIG_ID).length).toBeLessThan(DISCORD_CUSTOM_ID_LIMIT - 50);
			expect(parseTicketCustomId(ticketToolButtonId(tool, BIG_ID))).toEqual({ kind: 'tool', tool, id: BIG_ID });
		}
		for (const status of TICKET_STATUSES) {
			for (const o of [{}, { claimedBy: null }, { closedAt: new Date(0) }, { visibility: 'public' as const }]) {
				const rows = ticketControlRows(channelTicket({ status, ...o }));
				expect(rows.length).toBeLessThanOrEqual(5);
				for (const row of rows) {
					expect(row.components.length).toBeLessThanOrEqual(5);
					for (const b of row.components) {
						expect(b.label.length).toBeLessThan(DISCORD_BUTTON_LABEL_LIMIT - 50);
						expect(b.custom_id.length).toBeLessThanOrEqual(DISCORD_CUSTOM_ID_LIMIT);
					}
				}
			}
		}
		const select = ticketUserSelectRow('remove', BIG_ID)[0].components[0];
		expect(select.type).toBe(5);
		expect(select.placeholder.length).toBeLessThan(150 - TICKET_LENGTH_MARGIN + 100);
		expect(parseTicketCustomId(ticketUserSelectId('add', 5))).toEqual({ kind: 'usr', mode: 'add', id: 5 });
		expect(parseTicketCustomId('TKT:tool:nuke:1')).toBeNull();
		expect(parseTicketCustomId('TKT:usr:ban:1')).toBeNull();
		expect(parseTicketCustomId('TKT:tool:close:1:2')).toBeNull();
	});

	test('which tools show in each state', () => {
		const base = channelTicket({ claimedBy: null });
		expect(ticketToolsFor(base)).toEqual(['claim', 'add', 'remove', 'public', 'close']);
		expect(ticketToolsFor({ ...base, claimedBy: ID, visibility: 'public' })).toEqual([
			'add',
			'remove',
			'private',
			'close'
		]);
		expect(ticketToolsFor({ ...base, closedAt: new Date(0) })).toEqual(['reopen', 'delete']);
		expect(ticketToolsFor({ ...base, ticketChannelId: null })).toEqual([]);
		expect(ticketToolsFor({ ...base, channelDeletedAt: new Date(0) })).toEqual([]);
		// Old tickets in the staff channel keep exactly the old buttons.
		expect(ticketControlRows({ ...base, ticketChannelId: null })).toEqual(ticketButtonRows(base));
	});

	test('private by default: only the player, staff role and bot can see it', () => {
		const has = (bits: string, flag: bigint) => (BigInt(bits) & flag) === flag;
		const ows = buildTicketOverwrites({
			guildId: '1',
			botId: '2',
			staffRoleId: '3',
			memberIds: ['4', '4', '2', '1'],
			visibility: 'private',
			closed: false
		});
		expect(ows.map(o => o.id)).toEqual(['1', '2', '3', '4']);
		expect(has(ows[0].deny, TICKET_PERMS.VIEW)).toBe(true);
		expect(has(ows[3].allow, TICKET_PERMS.SEND)).toBe(true);
		expect(has(ows[3].deny, TICKET_PERMS.MENTION_EVERYONE)).toBe(true);
		// Never hands out Manage Channels (1<<4), Manage Roles (1<<28) or Administrator (1<<3).
		for (const o of ows) {
			const allow = BigInt(o.allow);
			expect(allow & ((1n << 3n) | (1n << 4n) | (1n << 28n))).toBe(0n);
		}
		const pub = ticketEveryoneOverwrite('1', 'public');
		expect(has(pub.allow, TICKET_PERMS.VIEW)).toBe(true);
		expect(has(pub.deny, TICKET_PERMS.SEND)).toBe(true);
		expect(has(pub.deny, TICKET_PERMS.CREATE_PUBLIC_THREADS)).toBe(true);
		// Trimmed to what the bot has, but View is never dropped (privacy can't silently fail open).
		const trimmed = maskTicketOverwrite(ticketMemberOverwrite('4', false), TICKET_PERMS.SEND);
		expect(BigInt(trimmed.allow)).toBe(TICKET_PERMS.SEND | TICKET_PERMS.VIEW);
		expect(BigInt(trimmed.deny)).toBe(0n);
		const everyone = maskTicketOverwrite(ticketEveryoneOverwrite('1', 'private'), 0n);
		expect(BigInt(everyone.deny)).toBe(TICKET_PERMS.VIEW);
		const locked = ticketMemberOverwrite('4', true);
		expect(has(locked.deny, TICKET_PERMS.SEND)).toBe(true);
		expect(has(locked.allow, TICKET_PERMS.VIEW)).toBe(true);
	});

	test('auto and staff-filed tickets stay staff-only until Confirm', () => {
		const t = { reporterId: ID };
		expect(reporterHasChannelAccess({ ...t, source: 'player', status: 'open' })).toBe(true);
		expect(reporterHasChannelAccess({ ...t, source: 'auto', status: 'open' })).toBe(false);
		expect(reporterHasChannelAccess({ ...t, source: 'staff', status: 'open' })).toBe(false);
		expect(reporterHasChannelAccess({ ...t, source: 'auto', status: 'ignored' })).toBe(false);
		expect(reporterHasChannelAccess({ ...t, source: 'auto', status: 'confirmed' })).toBe(true);
		expect(reporterHasChannelAccess({ reporterId: null, source: 'auto', status: 'live' })).toBe(false);
	});

	test('channel open message pings the staff role (and the player only on their own ticket)', () => {
		expect(ticketChannelOpenMentions({ source: 'player', reporterId: ID }, '3')).toEqual({
			parse: [],
			users: [ID],
			roles: ['3']
		});
		expect(ticketChannelOpenMentions({ source: 'auto', reporterId: ID }, '3')).toEqual({
			parse: [],
			users: [],
			roles: ['3']
		});
		expect(ticketChannelOpenContent({ id: 7, type: 'bug', source: 'auto', reporterId: ID }, '3')).not.toContain(ID);
		expect(ticketChannelOpenContent({ id: 7, type: 'bug', source: 'player', reporterId: ID }, '3')).toContain(
			'<@&3>'
		);
	});

	test('one waiting ticket per type per player', () => {
		expect(
			playerTicketLimitError({ openCount: 1, openSameType: 1, type: 'bug', lastCreatedAt: null, now: 0 })
		).toContain('bug ticket waiting');
		expect(
			playerTicketLimitError({ openCount: 1, openSameType: 0, type: 'suggestion', lastCreatedAt: null, now: 0 })
		).toBeNull();
	});

	test('transcript is oldest first with a header', () => {
		const text = buildTicketTranscript(
			{ id: 7, type: 'bug', reporterId: ID },
			'bug-0007-salty',
			'5',
			[
				{
					authorName: 'b',
					authorId: '2',
					bot: false,
					content: 'second',
					timestamp: 't2',
					attachmentUrls: ['https://x/y.png'],
					embedTitles: []
				},
				{
					authorName: 'a',
					authorId: '1',
					bot: true,
					content: '',
					timestamp: 't1',
					attachmentUrls: [],
					embedTitles: ['Bug #7']
				}
			],
			new Date(0)
		);
		const lines = text.split('\n');
		expect(lines[0]).toContain('Bug #7 (#bug-0007-salty)');
		expect(lines.at(-2)).toContain('a [BOT] (1): [embed: Bug #7]');
		expect(lines.at(-1)).toContain('b (2): second [file: https://x/y.png]');
	});
});
