import { Time } from '@oldschoolgg/toolkit';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { ANNOUNCEMENTS_CHANNEL_ID } from '@/lib/constants.js';
import {
	DISCORD_MESSAGE_LIMIT,
	EVENT_ANNOUNCE_CATCH_UP_MS,
	EVENT_START_ANNOUNCEMENTS,
	type EventAnnouncementStore,
	eventAnnouncementDue,
	processEventStartAnnouncements
} from '@/lib/events/announcements.js';
import { clearSeasonalEventOverrides, setSeasonalEventOverride } from '@/lib/events/registry.js';
import type { SeasonalEventId } from '@/lib/events/types.js';

const START = Date.parse('2026-11-22T16:46:19.332Z');
const END = Date.parse('2026-12-07T16:46:19.332Z');

function memoryStore(failRelease = false) {
	const rows = new Map<string, number>();
	const store: EventAnnouncementStore & { rows: Map<string, number> } = {
		rows,
		async claim(id: SeasonalEventId, start: number) {
			for (const [key, postedAt] of rows) {
				if (key.startsWith(`${id}|`) && key !== `${id}|${start}` && postedAt > Date.now() - 30 * Time.Day)
					return false;
			}
			if (rows.has(`${id}|${start}`)) return false;
			rows.set(`${id}|${start}`, Date.now());
			return true;
		},
		async release(id: SeasonalEventId, start: number) {
			if (failRelease) throw new Error('release failed');
			rows.delete(`${id}|${start}`);
		}
	};
	return store;
}

describe('event start announcements', () => {

	beforeEach(() => {
		clearSeasonalEventOverrides();
	});
	afterEach(() => {
		clearSeasonalEventOverrides();
	});

	test('posts to the BSC announcements channel, not funziez-logs', () => {
		expect(ANNOUNCEMENTS_CHANNEL_ID).toBe('1569407936537821259');
		expect(ANNOUNCEMENTS_CHANNEL_ID).not.toBe('1569070774055080036');
	});

	test('thanksgiving messages fit Discord, use real names and never ping roles/everyone', () => {
		const entry = EVENT_START_ANNOUNCEMENTS.thanksgiving!;
		expect(entry.messages.length).toBe(2);
		for (const m of entry.messages) {
			expect(m.length).toBeLessThan(DISCORD_MESSAGE_LIMIT);
			expect(m).not.toMatch(/@everyone|@here|<@&/);
		}
		const all = entry.messages.join('\n');
		expect(all).toContain('Sun Nov 22 – Mon Dec 7 (CT)');
		expect(all).toContain('Thank you for helping shape this event!');
		expect(all.match(/<@\d+>/g)?.length).toBe(5);
		for (const cmd of all.match(/\/[a-z]+(?: [a-z]+)?/g) ?? []) {
			expect(['/thanksgiving offer', '/thanksgiving harvest', '/thanksgiving status']).toContain(cmd);
		}
		// Lowercase "cornucopia" only as Bountiful cornucopia; capital Cornucopia is the 2021 item.
		expect(all.match(/(?<!Bountiful )cornucopia/g)).toBeNull();
		expect(all).not.toContain('Grand Line');
		expect(all.trimEnd().endsWith('Happy Thanksgiving! 🦃')).toBe(true);
		expect(all).not.toContain('docked the Going Merry');
	});

	test('due only inside the catch-up window of a scheduled, active, code-enabled event', () => {
		const base = { active: true, start: START, codeEnabled: true, hasMessages: true };
		expect(eventAnnouncementDue(base, START)).toBe(true);
		expect(eventAnnouncementDue(base, START + EVENT_ANNOUNCE_CATCH_UP_MS)).toBe(true);
		expect(eventAnnouncementDue(base, START + EVENT_ANNOUNCE_CATCH_UP_MS + 1)).toBe(false);
		expect(eventAnnouncementDue(base, START - 1)).toBe(false);
		expect(eventAnnouncementDue({ ...base, active: false }, START)).toBe(false);
		expect(eventAnnouncementDue({ ...base, codeEnabled: false }, START)).toBe(false);
		expect(eventAnnouncementDue({ ...base, start: null }, START)).toBe(false);
		expect(eventAnnouncementDue({ ...base, hasMessages: false }, START)).toBe(false);
	});

	test('posts once at start; restarts and later ticks do not double-post', async () => {
		setSeasonalEventOverride('thanksgiving', { enabled: true, start: START, end: END });
		const store = memoryStore();
		const sent: string[] = [];
		const send = async (c: string) => {
			sent.push(c);
		};
		expect(await processEventStartAnnouncements(START - Time.Minute, store, send)).toEqual([]);
		expect(await processEventStartAnnouncements(START + 30_000, store, send)).toEqual(['thanksgiving']);
		expect(await processEventStartAnnouncements(START + Time.Minute, store, send)).toEqual([]);
		expect(await processEventStartAnnouncements(START + 2 * Time.Minute, store, send)).toEqual([]);
		expect(sent).toEqual([...EVENT_START_ANNOUNCEMENTS.thanksgiving!.messages]);
	});

	test('bot down at start: posts on the next run within 6h, not after', async () => {
		setSeasonalEventOverride('thanksgiving', { enabled: true, start: START, end: END });
		const sent: string[] = [];
		const send = async (c: string) => {
			sent.push(c);
		};
		expect(await processEventStartAnnouncements(START + 5 * Time.Hour, memoryStore(), send)).toEqual([
			'thanksgiving'
		]);
		expect(await processEventStartAnnouncements(START + 7 * Time.Hour, memoryStore(), send)).toEqual([]);
	});

	test('disabled, unscheduled or ended events never post', async () => {
		const send = async () => {
			throw new Error('should not send');
		};
		setSeasonalEventOverride('thanksgiving', { enabled: false, start: START, end: END });
		expect(await processEventStartAnnouncements(START, memoryStore(), send)).toEqual([]);
		setSeasonalEventOverride('thanksgiving', { enabled: true, start: null, end: END });
		expect(await processEventStartAnnouncements(START, memoryStore(), send)).toEqual([]);
		setSeasonalEventOverride('thanksgiving', { enabled: true, start: START, end: START + 1 });
		expect(await processEventStartAnnouncements(START + 1, memoryStore(), send)).toEqual([]);
	});

	test('rescheduling after a post does not post again', async () => {
		const store = memoryStore();
		const sent: string[] = [];
		const send = async (c: string) => {
			sent.push(c);
		};
		setSeasonalEventOverride('thanksgiving', { enabled: true, start: START, end: END });
		await processEventStartAnnouncements(START, store, send);
		const moved = START + Time.Hour;
		setSeasonalEventOverride('thanksgiving', { enabled: true, start: moved, end: END });
		expect(await processEventStartAnnouncements(moved, store, send)).toEqual([]);
		expect(sent.length).toBe(2);
	});

	test('first message fails: claim released and retried; later failure keeps claim', async () => {
		setSeasonalEventOverride('thanksgiving', { enabled: true, start: START, end: END });
		const store = memoryStore();
		let calls = 0;
		const failFirst = async () => {
			calls++;
			throw new Error('discord down');
		};
		expect(await processEventStartAnnouncements(START, store, failFirst)).toEqual([]);
		expect(store.rows.size).toBe(0);
		const sent: string[] = [];
		let n = 0;
		const failSecond = async (c: string) => {
			if (++n === 2) throw new Error('second failed');
			sent.push(c);
		};
		expect(await processEventStartAnnouncements(START + Time.Minute, store, failSecond)).toEqual([]);
		expect(store.rows.size).toBe(1);
		expect(
			await processEventStartAnnouncements(START + 2 * Time.Minute, store, async c => sent.push(c) as never)
		).toEqual([]);
		expect(sent.length).toBe(1);
		expect(calls).toBe(1);
	});
});
