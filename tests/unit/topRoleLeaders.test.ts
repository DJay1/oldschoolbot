import { describe, expect, it } from 'vitest';

import { BadgesEnum, badgeEmoji } from '@/lib/badges/badgeEmojis.js';
import { Minigames } from '@/lib/settings/minigames.js';
import { SkillsArray } from '@/lib/skilling/types.js';
import {
	collectBreakdownUserIDs,
	collectStandingUserIDs,
	DISCORD_CONTENT_LIMIT,
	DISCORD_CONTENT_SAFE,
	formatTopRoleBreakdown,
	formatTopRoleStandings,
	isTopRoleKey,
	safeDisplayName,
	TOP_ROLE_CHOICES,
	TOP_ROLE_TITLES,
	type TopRoleBreakdown,
	type TopRoleCategoryEntry,
	type TopRoleStanding
} from '@/lib/topRoleLeaders.js';

const LONGEST_NAME = 'W'.repeat(32);

function worstCaseStandings(): TopRoleStanding[] {
	return TOP_ROLE_TITLES.map((def, index) => ({
		key: def.key,
		title: def.title,
		badge: def.badge,
		places: [
			{ userID: String(1000 + index), reason: 'x'.repeat(80) },
			{ userID: String(2000 + index), reason: 'y'.repeat(80) },
			{ userID: String(3000 + index), reason: 'z'.repeat(80) }
		]
	}));
}

function namesForStandings(standings: TopRoleStanding[]): Record<string, string> {
	const names: Record<string, string> = {};
	for (const row of standings) {
		for (const place of row.places) names[place.userID] = LONGEST_NAME;
	}
	return names;
}

function worstCaseMinigamerBreakdown(): TopRoleBreakdown {
	const minigames = Minigames.filter(game => game.column !== 'tithe_farm');
	const categories: TopRoleCategoryEntry[] = minigames.map((game, index) => ({
		label: game.name,
		userID: String(10_000 + index)
	}));
	return {
		key: 'minigamer',
		title: 'Minigamer',
		badge: BadgesEnum.TopMinigame,
		scoring:
			'The weekly role goes to rank 1 in each minigame (Tithe Farm is counted with Farmer). This list also ranks by total minigame score.',
		overallTitle: 'Top 5 (total minigame score)',
		overall: Array.from({ length: 5 }, (_, index) => ({
			userID: String(4000 + index),
			reason: '9,999,999 total score'
		})),
		categoryHeading: 'Rank 1 by minigame',
		categories
	};
}

function worstCaseSkillerBreakdown(): TopRoleBreakdown {
	return {
		key: 'skiller',
		title: 'Skiller',
		badge: BadgesEnum.TopSkiller,
		scoring: 'The weekly role goes to rank 1 total level and rank 1 XP in each skill.',
		overallTitle: 'Top 5 (total level)',
		overall: Array.from({ length: 5 }, (_, index) => ({
			userID: String(5000 + index),
			reason: 'Total level 2,999'
		})),
		categoryHeading: 'Rank 1 XP',
		categories: SkillsArray.map((skill, index) => ({
			label: skill[0].toUpperCase() + skill.slice(1),
			userID: String(6000 + index)
		}))
	};
}

function namesForBreakdown(breakdown: TopRoleBreakdown): Record<string, string> {
	const names: Record<string, string> = {};
	for (const id of collectBreakdownUserIDs(breakdown)) names[id] = LONGEST_NAME;
	return names;
}

describe('formatTopRoleStandings', () => {
	it('lists every Top role with a leader, 2nd, and 3rd', () => {
		const names: Record<string, string> = {};
		for (const [i] of TOP_ROLE_TITLES.entries()) {
			names[String(1000 + i)] = `Leader${i}`;
			names[String(2000 + i)] = `Second${i}`;
			names[String(3000 + i)] = `Third${i}`;
		}
		const text = formatTopRoleStandings(worstCaseStandings(), names);
		expect(text.startsWith('**Top roles**')).toBe(true);
		for (const def of TOP_ROLE_TITLES) {
			expect(text).toContain(`**${def.title}:**`);
		}
		expect(text).toContain('Leader0');
		expect(text).toContain('2nd Second0');
		expect(text).toContain('3rd Third0');
		expect(text).not.toContain('<@');
		expect(text).not.toContain('@everyone');
		expect(text).not.toContain('@here');
	});

	it('uses badge emojis from badgeEmojis.ts only', () => {
		const text = formatTopRoleStandings(worstCaseStandings(), {});
		for (const def of TOP_ROLE_TITLES) {
			const emoji = badgeEmoji(def.badge);
			if (emoji) expect(text).toContain(emoji);
		}
		expect(text).not.toContain('top_collector');
	});

	it('shows None yet when a role has no leader', () => {
		const standing: TopRoleStanding = {
			key: 'collector',
			title: 'Collector',
			badge: BadgesEnum.TopCollector,
			places: []
		};
		const text = formatTopRoleStandings([standing], {});
		expect(text).toContain('**Collector:** None yet');
		expect(text).not.toContain('2nd');
	});

	it('omits 3rd when only two places exist', () => {
		const standing: TopRoleStanding = {
			key: 'skiller',
			title: 'Skiller',
			badge: BadgesEnum.TopSkiller,
			places: [
				{ userID: '1', reason: 'Total level 2,000' },
				{ userID: '2', reason: 'Total level 1,900' }
			]
		};
		const text = formatTopRoleStandings([standing], { '1': 'First', '2': 'Second' });
		expect(text).toContain('First');
		expect(text).toContain('2nd Second');
		expect(text).not.toContain('3rd');
	});

	it('worst case stays at least 150 under the Discord 2,000 character limit', () => {
		const standings = worstCaseStandings();
		const text = formatTopRoleStandings(standings, namesForStandings(standings));
		expect(text.length).toBeLessThanOrEqual(DISCORD_CONTENT_SAFE);
		expect(DISCORD_CONTENT_SAFE).toBe(DISCORD_CONTENT_LIMIT - 150);
		expect(DISCORD_CONTENT_LIMIT - text.length).toBeGreaterThanOrEqual(150);
	});
});

describe('formatTopRoleBreakdown', () => {
	it('shows scoring, top 5, and grouped category leaders without pings', () => {
		const breakdown: TopRoleBreakdown = {
			key: 'skiller',
			title: 'Skiller',
			badge: BadgesEnum.TopSkiller,
			scoring: 'The weekly role goes to rank 1 total level and rank 1 XP in each skill.',
			overallTitle: 'Top 5 (total level)',
			overall: [
				{ userID: '1', reason: 'Total level 2,276' },
				{ userID: '2', reason: 'Total level 2,200' }
			],
			categoryHeading: 'Rank 1 XP',
			categories: [
				{ label: 'Agility', userID: '1' },
				{ label: 'Farming', userID: '1' },
				{ label: 'Attack', userID: '2' }
			]
		};
		const text = formatTopRoleBreakdown(breakdown, { '1': 'salty', '2': 'sekz.' });
		expect(text).toContain('**Skiller**');
		expect(text).toContain('rank 1 XP in each skill');
		expect(text).toContain('**Top 5 (total level)**');
		expect(text).toContain('1. salty — Total level 2,276');
		expect(text).toContain('2. sekz. — Total level 2,200');
		expect(text).toContain('**Rank 1 XP**');
		expect(text).toContain('salty — Agility, Farming');
		expect(text).toContain('sekz. — Attack');
		expect(text).not.toContain('<@');
		expect(text).not.toContain('@everyone');
		expect(text).not.toContain('@here');
		const emoji = badgeEmoji(BadgesEnum.TopSkiller);
		if (emoji) expect(text).toContain(emoji);
	});

	it('shows None yet when the breakdown has no overall leaders', () => {
		const breakdown: TopRoleBreakdown = {
			key: 'farmer',
			title: 'Farmer',
			badge: BadgesEnum.Farmer,
			scoring: 'The weekly role goes to the most farming contracts, farming trips, and Tithe Farm completions.',
			overallTitle: 'Top 5 (farming contracts)',
			overall: []
		};
		const text = formatTopRoleBreakdown(breakdown, {});
		expect(text).toContain('**Top 5 (farming contracts)**');
		expect(text).toContain('None yet');
	});

	it('worst-case minigamer breakdown stays at least 150 under the limit', () => {
		const breakdown = worstCaseMinigamerBreakdown();
		const text = formatTopRoleBreakdown(breakdown, namesForBreakdown(breakdown));
		expect(text).toContain('**Minigamer**');
		expect(text).toContain('**Top 5 (total minigame score)**');
		expect(text).toContain('**Rank 1 by minigame**');
		expect(text.length).toBeLessThanOrEqual(DISCORD_CONTENT_SAFE);
		expect(DISCORD_CONTENT_LIMIT - text.length).toBeGreaterThanOrEqual(150);
		expect(text).not.toContain('<@');
	});

	it('worst-case skiller breakdown stays at least 150 under the limit', () => {
		const breakdown = worstCaseSkillerBreakdown();
		const text = formatTopRoleBreakdown(breakdown, namesForBreakdown(breakdown));
		expect(text).toContain('**Skiller**');
		expect(text).toContain('**Rank 1 XP**');
		expect(text.length).toBeLessThanOrEqual(DISCORD_CONTENT_SAFE);
		expect(DISCORD_CONTENT_LIMIT - text.length).toBeGreaterThanOrEqual(150);
	});
});

describe('safeDisplayName', () => {
	it('trims and caps names at 32 characters', () => {
		expect(safeDisplayName(`  ${LONGEST_NAME}EXTRA  `)).toBe(LONGEST_NAME);
		expect(safeDisplayName('')).toBe('Unknown');
		expect(safeDisplayName(null)).toBe('Unknown');
	});

	it('strips @ so names cannot ping', () => {
		expect(safeDisplayName('@everyone')).toBe('everyone');
		expect(safeDisplayName('cool@name')).toBe('coolname');
	});
});

describe('top role keys', () => {
	it('accepts only the known Top role keys', () => {
		expect(TOP_ROLE_CHOICES).toHaveLength(TOP_ROLE_TITLES.length);
		expect(isTopRoleKey('skiller')).toBe(true);
		expect(isTopRoleKey('minigamer')).toBe(true);
		expect(isTopRoleKey('not_a_role')).toBe(false);
		expect(isTopRoleKey(undefined)).toBe(false);
	});
});

describe('id collectors', () => {
	it('collects unique user IDs for name lookups', () => {
		const standings = worstCaseStandings();
		expect(collectStandingUserIDs(standings)).toHaveLength(TOP_ROLE_TITLES.length * 3);
		const breakdown = worstCaseSkillerBreakdown();
		expect(collectBreakdownUserIDs(breakdown).length).toBe(5 + SkillsArray.length);
	});
});
