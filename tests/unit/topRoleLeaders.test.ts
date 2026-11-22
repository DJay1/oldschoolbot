import { describe, expect, it } from 'vitest';

import { BadgesEnum, badgeEmoji } from '@/lib/badges/badgeEmojis.js';
import {
	DISCORD_CONTENT_LIMIT,
	DISCORD_CONTENT_SAFE,
	formatTopRoleStandings,
	safeDisplayName,
	TOP_ROLE_TITLES,
	type TopRoleStanding
} from '@/lib/topRoleLeaders.js';

const LONGEST_NAME = 'W'.repeat(32);

function worstCaseStandings(): TopRoleStanding[] {
	return TOP_ROLE_TITLES.map((def, index) => ({
		key: def.key,
		title: def.title,
		badge: def.badge,
		leader: { userID: String(1000 + index), reason: 'x'.repeat(80) },
		runnerUp: { userID: String(2000 + index), reason: 'y'.repeat(80) }
	}));
}

describe('formatTopRoleStandings', () => {
	it('lists every Top role with a leader and runner-up', () => {
		const names: Record<string, string> = {};
		for (const [i] of TOP_ROLE_TITLES.entries()) {
			names[String(1000 + i)] = `Leader${i}`;
			names[String(2000 + i)] = `Second${i}`;
		}
		const text = formatTopRoleStandings(worstCaseStandings(), names);
		expect(text.startsWith('**Top roles**')).toBe(true);
		for (const def of TOP_ROLE_TITLES) {
			expect(text).toContain(`**${def.title}:**`);
		}
		expect(text).toContain('Leader0');
		expect(text).toContain('2nd Second0');
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
			leader: null,
			runnerUp: null
		};
		const text = formatTopRoleStandings([standing], {});
		expect(text).toContain('**Collector:** None yet');
		expect(text).not.toContain('2nd');
	});

	it('worst case stays at least 150 under the Discord 2,000 character limit', () => {
		const names: Record<string, string> = {};
		for (let i = 0; i < TOP_ROLE_TITLES.length; i++) {
			names[String(1000 + i)] = LONGEST_NAME;
			names[String(2000 + i)] = LONGEST_NAME;
		}
		const text = formatTopRoleStandings(worstCaseStandings(), names);
		expect(text.length).toBeLessThanOrEqual(DISCORD_CONTENT_SAFE);
		expect(DISCORD_CONTENT_SAFE).toBe(DISCORD_CONTENT_LIMIT - 150);
	});
});

describe('safeDisplayName', () => {
	it('trims and caps names at 32 characters', () => {
		expect(safeDisplayName(`  ${LONGEST_NAME}EXTRA  `)).toBe(LONGEST_NAME);
		expect(safeDisplayName('')).toBe('Unknown');
		expect(safeDisplayName(null)).toBe('Unknown');
	});
});
