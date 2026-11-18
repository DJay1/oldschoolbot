import { Time } from '@oldschoolgg/toolkit';
import { describe, expect, test } from 'vitest';

import {
	POLL_DJ_USER_ID,
	POLL_DEFAULT_DURATION_MS,
	POLL_MIN_VOTES,
	canCreateRepoll,
	canDeletePoll,
	canUpdatePollStatus,
	countedPollVotes,
	closeResultSummary,
	formatPollListLine,
	isAllowedUpdateTarget,
	isPollStillUpdateable,
	parsePollDuration,
	pollCloseOutcome,
	pollJumpUrl,
	pollViewLink,
	repollExpiredSummary,
	shouldPostWeeklyPollReminder,
	truncatePollText,
	weeklyPollReminderWeekId,
	type PollRecord
} from '@/lib/bsc/polls.js';

function poll(overrides: Partial<PollRecord> = {}): PollRecord {
	return {
		id: '1',
		guildId: 'g',
		channelId: 'c',
		messageId: '1',
		question: 'Add more corgos?',
		creatorId: '111',
		createdAt: 0,
		closesAt: 10,
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
		updatedAt: 0,
		...overrides
	};
}

describe('poll duration', () => {
	test('defaults to 2 days and rejects out-of-range values', () => {
		const unset = parsePollDuration(undefined);
		expect(unset.ok).toBe(true);
		if (unset.ok) expect(unset.ms).toBe(POLL_DEFAULT_DURATION_MS);
		const empty = parsePollDuration('');
		expect(empty.ok).toBe(true);
		if (empty.ok) expect(empty.ms).toBe(POLL_DEFAULT_DURATION_MS);
		const twoDays = parsePollDuration('2d');
		expect(twoDays.ok).toBe(true);
		if (twoDays.ok) expect(twoDays.ms).toBe(Time.Day * 2);
		expect(parsePollDuration('30m').ok).toBe(false);
		expect(parsePollDuration('30d').ok).toBe(false);
		expect(parsePollDuration('nope').ok).toBe(false);
	});
});

describe('poll vote counting', () => {
	test('excludes the bot, users without a minion, and double voters', () => {
		const minions = new Set(['a', 'b', 'c', 'double']);
		const result = countedPollVotes(
			['a', 'double', 'nomain', 'bot'],
			['b', 'c', 'double', 'bot'],
			minions,
			'bot'
		);
		expect(result).toEqual({ yes: 1, no: 2, total: 3, percent: (1 / 3) * 100, excluded: 2 });
	});
});

describe('poll close outcomes', () => {
	test('fails below 7 counted votes', () => {
		expect(pollCloseOutcome(5, 1, false).status).toBe('Failed');
		expect(pollCloseOutcome(6, 0, false).total).toBe(6);
	});

	test('passes at 70% or more, repolls at 60-69%, fails below 60%', () => {
		expect(pollCloseOutcome(7, 3, false)).toMatchObject({ status: 'Passed', total: 10, percent: 70 });
		expect(pollCloseOutcome(6, 4, false)).toMatchObject({ status: 'Repoll', total: 10, percent: 60 });
		expect(pollCloseOutcome(69, 31, false).status).toBe('Repoll');
		expect(pollCloseOutcome(5, 5, false)).toMatchObject({ status: 'Failed', percent: 50 });
	});

	test('a failed or 60-69% repoll cannot be repolled again', () => {
		expect(pollCloseOutcome(6, 4, true).status).toBe('Failed');
		expect(pollCloseOutcome(5, 5, true).status).toBe('Failed');
		expect(pollCloseOutcome(7, 3, true).status).toBe('Passed');
		const eligible = poll({ status: 'Repoll', creatorId: '111', isRepoll: false, repollDeadline: 100 });
		expect(canCreateRepoll(eligible, '111', 50)).toBe(true);
		expect(canCreateRepoll(eligible, '222', 50)).toBe(false);
		expect(canCreateRepoll(eligible, POLL_DJ_USER_ID, 50)).toBe(true);
		expect(canCreateRepoll({ ...eligible, isRepoll: true }, '111', 50)).toBe(false);
		expect(canCreateRepoll({ ...eligible, repollId: '2' }, '111', 50)).toBe(false);
		expect(canCreateRepoll(eligible, '111', 101)).toBe(false);
		expect(canCreateRepoll({ ...eligible, status: 'Failed' }, '111', 50)).toBe(false);
	});
});

describe('poll permissions and list lines', () => {
	test('only DJ can delete; DJ or staff can update', () => {
		expect(canDeletePoll(POLL_DJ_USER_ID)).toBe(true);
		expect(canDeletePoll('111')).toBe(false);
		expect(canUpdatePollStatus(POLL_DJ_USER_ID, false)).toBe(true);
		expect(canUpdatePollStatus('111', true)).toBe(true);
		expect(canUpdatePollStatus('111', false)).toBe(false);
		expect(isPollStillUpdateable(poll({ status: 'Passed' }))).toBe(true);
		expect(isPollStillUpdateable(poll({ status: 'Done' }))).toBe(false);
		expect(isAllowedUpdateTarget('Done')).toBe(true);
		expect(isAllowedUpdateTarget('Open')).toBe(false);
	});

	test('list lines include a message link, percent, status, and optional note', () => {
		const line = formatPollListLine(
			poll({
				status: 'Passed',
				percent: 80,
				guildId: '1',
				channelId: '2',
				messageId: '3',
				note: 'Working on it'
			})
		);
		expect(line).toContain('https://discord.com/channels/1/2/3');
		expect(line).toContain('80.0%');
		expect(line).toContain('Passed');
		expect(line).toContain('Working on it');
		expect(truncatePollText('short', 80)).toBe('short');
		expect(truncatePollText('x'.repeat(10), 5).endsWith('…')).toBe(true);
	});

	test('weekly reminder is due Monday at or after 10am Chicago time', () => {
		// 2026-11-16 is a Monday. 16:00 UTC = 10:00 AM CT.
		const monday10 = Date.UTC(2026, 10, 16, 16, 0, 0);
		const monday9 = Date.UTC(2026, 10, 16, 15, 0, 0);
		const sunday = Date.UTC(2026, 10, 15, 16, 0, 0);
		expect(shouldPostWeeklyPollReminder(monday10)).toBe(true);
		expect(shouldPostWeeklyPollReminder(monday9)).toBe(false);
		expect(shouldPostWeeklyPollReminder(sunday)).toBe(false);
		expect(weeklyPollReminderWeekId(monday10)).toBe('2026-11-16');
		expect(weeklyPollReminderWeekId(Date.UTC(2026, 10, 18, 16, 0, 0))).toBe('2026-11-16');
	});
});

describe('min vote threshold', () => {
	test('uses the agreed floor of 7 counted votes', () => {
		expect(POLL_MIN_VOTES).toBe(7);
		expect(pollCloseOutcome(7, 0, false).status).toBe('Passed');
	});
});

describe('poll result jump links', () => {
	const linked = {
		guildId: '1323755235793178655',
		channelId: '1510687250420072498',
		messageId: '1439111111111111111'
	};
	const url = `https://discord.com/channels/${linked.guildId}/${linked.channelId}/${linked.messageId}`;

	test('builds a Discord jump URL only when all IDs look valid', () => {
		expect(pollJumpUrl(poll(linked))).toBe(url);
		expect(pollJumpUrl(poll({ guildId: '', channelId: '2', messageId: '3' }))).toBeNull();
		expect(pollJumpUrl(poll({ guildId: '1', channelId: '', messageId: '3' }))).toBeNull();
		expect(pollJumpUrl(poll({ guildId: '1', channelId: '2', messageId: '' }))).toBeNull();
		expect(pollJumpUrl(poll({ guildId: 'not-an-id', channelId: '2', messageId: '3' }))).toBeNull();
		expect(pollViewLink(poll({ guildId: '', channelId: '2', messageId: '3' }))).toBe('');
		expect(pollViewLink(poll(linked))).toBe(` [View poll](${url})`);
	});

	test('close and expired-repoll updates include a View poll link, and skip it when IDs are missing', () => {
		const passed = closeResultSummary(poll({ ...linked, status: 'Passed', yes: 13, no: 1, total: 14, percent: 92.857 }));
		expect(passed).toContain('Your poll passed and is waiting for implementation.');
		expect(passed).toContain('13 Yes / 14 counted (92.9% yes)');
		expect(passed).toContain(`[View poll](${url})`);

		const repoll = closeResultSummary(poll({ ...linked, status: 'Repoll', yes: 6, no: 4, total: 10, percent: 60 }));
		expect(repoll).toContain('eligible for a repoll');
		expect(repoll).toContain(`[View poll](${url})`);

		const failed = closeResultSummary(poll({ ...linked, status: 'Failed', yes: 2, no: 8, total: 10, percent: 20 }));
		expect(failed).toContain('Your poll failed.');
		expect(failed).toContain(`[View poll](${url})`);

		const expired = repollExpiredSummary(
			poll({ ...linked, status: 'Failed', yes: 6, no: 4, total: 10, percent: 60 })
		);
		expect(expired).toContain('none was created in time, so it failed');
		expect(expired).toContain(`[View poll](${url})`);

		const noLink = closeResultSummary(
			poll({ guildId: '', channelId: '', messageId: '', status: 'Passed', yes: 13, no: 1, total: 14, percent: 92.9 })
		);
		expect(noLink).toContain('Your poll passed and is waiting for implementation.');
		expect(noLink).not.toContain('View poll');
		expect(noLink).not.toContain('https://discord.com/channels');
	});

	test('worst-case poll status updates stay at least 150 under Discord\'s 2,000-character limit', () => {
		const maxIds = {
			guildId: '9'.repeat(20),
			channelId: '9'.repeat(20),
			messageId: '9'.repeat(20)
		};
		const huge = {
			...maxIds,
			yes: Number.MAX_SAFE_INTEGER,
			no: Number.MAX_SAFE_INTEGER,
			total: Number.MAX_SAFE_INTEGER,
			percent: 99.999,
			note: 'n'.repeat(200),
			question: 'q'.repeat(500),
			status: 'Repoll' as const
		};
		const close = closeResultSummary(poll(huge));
		const expired = repollExpiredSummary(poll({ ...huge, status: 'Failed' }));
		const staffUpdate = `Updated **${'q'.repeat(80)}** to **In progress**. Note: ${'n'.repeat(200)}${pollViewLink(poll(maxIds))}`;
		for (const content of [close, expired, staffUpdate]) {
			expect(content.length).toBeLessThanOrEqual(2000 - 150);
			expect(content).toContain('View poll');
		}
	});
});
