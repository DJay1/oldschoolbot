import { Emoji } from '@oldschoolgg/toolkit';
import { describe, expect, test } from 'vitest';

import { recapBossNames } from '@/lib/bsc/weeklyRecap.js';
import {
	buildRecap,
	dueRecapSlot,
	fmtXP,
	formatRecapRange,
	latestRecapSlot,
	type RecapData,
	topPagesLine
} from '@/lib/bsc/weeklyRecapFormat.js';

describe('weekly recap schedule (Sunday 12:00 PM Central)', () => {
	test('CST: Sun Nov 15 2026 noon CT is 18:00 UTC', () => {
		const now = Date.parse('2026-11-15T18:30:00Z');
		expect(new Date(latestRecapSlot(now)).toISOString()).toBe('2026-11-15T18:00:00.000Z');
		expect(dueRecapSlot(now)).toBe(Date.parse('2026-11-15T18:00:00Z'));
	});

	test('CDT: Sun Jul 12 2026 noon CT is 17:00 UTC', () => {
		expect(new Date(latestRecapSlot(Date.parse('2026-07-12T17:00:00Z'))).toISOString()).toBe(
			'2026-07-12T17:00:00.000Z'
		);
	});

	test('before noon on Sunday it is still last week; catch-up ends after 3 hours', () => {
		expect(new Date(latestRecapSlot(Date.parse('2026-11-15T17:59:00Z'))).toISOString()).toBe(
			'2026-11-08T18:00:00.000Z'
		);
		expect(dueRecapSlot(Date.parse('2026-11-15T17:59:00Z'))).toBeNull();
		expect(dueRecapSlot(Date.parse('2026-11-15T21:00:00Z'))).not.toBeNull();
		expect(dueRecapSlot(Date.parse('2026-11-15T21:01:00Z'))).toBeNull();
		expect(dueRecapSlot(Date.parse('2026-11-18T12:00:00Z'))).toBeNull();
	});

	test('DST change weeks', () => {
		// Nov 1 2026 (clocks fell back that morning) and Mar 8 2026 (sprang forward).
		expect(new Date(latestRecapSlot(Date.parse('2026-11-01T19:00:00Z'))).toISOString()).toBe(
			'2026-11-01T18:00:00.000Z'
		);
		expect(new Date(latestRecapSlot(Date.parse('2026-03-08T18:00:00Z'))).toISOString()).toBe(
			'2026-03-08T17:00:00.000Z'
		);
	});

	test('range line', () => {
		expect(formatRecapRange(Date.parse('2026-11-08T18:00:00Z'), Date.parse('2026-11-15T18:00:00Z'))).toBe(
			'Sun, Nov 8, 12:00 PM – Sun, Nov 15, 12:00 PM CT, 2026'
		);
	});
});

const data: RecapData = {
	startMs: Date.parse('2026-11-08T18:00:00Z'),
	endMs: Date.parse('2026-11-15T18:00:00Z'),
	trips: 6844,
	hours: 3229.4,
	players: 45,
	trades: 203,
	topSkill: { skill: 'firemaking', xp: 698_312_000 },
	bosses: [
		{ name: 'Barrows', kc: 11_884 },
		{ name: 'General Graardor', kc: 3735 }
	],
	bossHunters: [{ userID: '1', kc: 2269 }],
	skillers: [{ userID: '2', xp: 595_100_000 }],
	new120s: [
		{ userID: '2', skill: 'firemaking' },
		{ userID: '3', skill: 'firemaking' },
		{ userID: '4', skill: 'fishing' }
	],
	new99s: [
		{ userID: '5', skill: 'attack' },
		{ userID: '5', skill: 'strength' },
		{ userID: '6', skill: 'magic' }
	],
	clCompletions: [
		{ userID: '1', page: 'Skilling Pets' },
		{ userID: '2', page: 'Skilling Pets' },
		{ userID: '3', page: 'Obor' },
		{ userID: '4', page: 'The Inferno' }
	]
};

describe('weekly recap text', () => {
	test('renders the approved layout and tags exactly the named players', () => {
		const { content, userIDs } = buildRecap(data);
		expect(content).toBe(
			[
				`${Emoji.EsbCorgi} **Bark School Corgo — Weekly Recap**`,
				'Sun, Nov 8, 12:00 PM – Sun, Nov 15, 12:00 PM CT, 2026',
				'',
				`${Emoji.Bank} **The week in numbers**`,
				'6,844 trips • 3,229 hours • 45 players',
				'203 player trades • most XP: Firemaking (698.3m)',
				'',
				`${Emoji.CombatSword} **Most hunted bosses**`,
				'1. Barrows — 11,884 KC',
				'2. General Graardor — 3,735 KC',
				'',
				`${Emoji.DragonTrophy} **Top boss hunters**`,
				'1. <@1> — 2,269 KC',
				'',
				`${Emoji.XP} **Top skillers**`,
				'1. <@2> — 595.1m XP',
				'',
				`${Emoji.Skiller} **New 99s and 120s**`,
				'New 120s: <@2> and <@3> (Firemaking), <@4> (Fishing)',
				'2 players reached a new 99, for 3 new 99s in all.',
				'Most 99s: <@5> (2).',
				'',
				`${Emoji.CollectionLog} **Collection logs**`,
				'4 players finished 4 pages.',
				'Most completed: Skilling Pets (2), Obor and The Inferno (1 each).'
			].join('\n')
		);
		expect(userIDs.sort()).toEqual(['1', '2', '3', '4', '5']);
	});

	test('sections with no data are left out', () => {
		const { content, userIDs } = buildRecap({
			...data,
			trips: 0,
			trades: 0,
			topSkill: null,
			bosses: [],
			bossHunters: [],
			skillers: [],
			new120s: [],
			new99s: [],
			clCompletions: []
		});
		expect(content).toBe(
			`${Emoji.EsbCorgi} **Bark School Corgo — Weekly Recap**\nSun, Nov 8, 12:00 PM – Sun, Nov 15, 12:00 PM CT, 2026`
		);
		expect(userIDs).toEqual([]);
	});

	test('notable pages not in the top list get their own line', () => {
		const pages = ['A', 'A', 'A', 'B', 'B', 'C', 'C', 'C', 'C', 'The Fight Caves'].map((page, i) => ({
			userID: String(i),
			page
		}));
		const { content } = buildRecap({ ...data, clCompletions: pages });
		expect(content).toContain('Most completed: C (4), A (3), B (2).');
		expect(content).toContain('The Fight Caves was also finished this week.');
	});

	test('always under 2000 characters', () => {
		const many = Array.from({ length: 200 }, (_, i) => ({
			userID: `${100_000_000_000_000_000n + BigInt(i)}`,
			skill: `skill${i}`
		}));
		const { content } = buildRecap({ ...data, new120s: many });
		expect(content.length).toBeLessThanOrEqual(2000);
	});

	test('helpers', () => {
		expect(fmtXP(698_312_000)).toBe('698.3m');
		expect(fmtXP(1_250_000_000)).toBe('1.2b');
		expect(
			topPagesLine([
				'Obor',
				'Barrows Chests',
				'Obor',
				'Barrows Chests',
				'Skilling Pets',
				'Skilling Pets',
				'Skilling Pets'
			])
		).toBe('Skilling Pets (3), Barrows Chests and Obor (2 each)');
	});
});

describe('weekly recap boss list', () => {
	test('bosses only', () => {
		const names = new Set(recapBossNames.values());
		for (const boss of ['Barrows', 'General Graardor', 'Lizardman Shaman', 'Dagannoth Prime', 'Zulrah', 'Nex']) {
			expect(names.has(boss)).toBe(true);
		}
		for (const notBoss of ['Chaos druid', 'TzHaar-Ket', 'Cyclops', 'Goblin']) {
			expect(names.has(notBoss)).toBe(false);
		}
	});
});
