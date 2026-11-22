import '../../src/lib/util/clientSettings.js';

import { toTitleCase } from '@oldschoolgg/toolkit';
import { toKMB } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { gifs } from '@/lib/bsc/corgoGifs.js';
import { formatPlayTime } from '@/lib/bsc/playTime.js';
import { STAFF_ACTIONS, staffActionsFor } from '@/lib/bsc/staffTiers.js';
import {
	DISCORD_CONTENT_LIMIT,
	DISCORD_EMBED_FIELD_VALUE_LIMIT,
	DISCORD_EMBED_TITLE_LIMIT,
	DISCORD_EMBED_TOTAL_LIMIT,
	DISCORD_LENGTH_MARGIN,
	STAFF_NO_MENTIONS,
	STAFF_PRIVATE_SUBCOMMANDS,
	STAFF_VIEW_TYPES,
	staffDeniedReply,
	staffViewHeading,
	staffViewMinionTitle,
	staffViewPlayerLabel,
	staffViewSafeMessage
} from '@/lib/bsc/staffView.js';
import { ClueTiers } from '@/lib/clues/clueTiers.js';
import { MAX_LEVEL } from '@/lib/constants.js';
import { skillEmoji } from '@/lib/data/emojis.js';

const WORST_NAME = 'W'.repeat(32);
const WORST_ID = '9'.repeat(20);
const WORST_USER = { username: WORST_NAME, id: WORST_ID };

const rng = {
	pick: <T>(items: readonly T[]) => items[0]
};

function underLimit(length: number, limit: number) {
	expect(length).toBeLessThanOrEqual(limit - DISCORD_LENGTH_MARGIN);
}

describe('/staff view permission gate', () => {
	test('non-staff and missing guild get a Corgo refusal gif', () => {
		expect(gifs).toContain(staffDeniedReply('123', 'none', rng));
		expect(gifs).toContain(staffDeniedReply(null, 'moderator', rng));
		expect(gifs).toContain(staffDeniedReply(undefined, 'admin', rng));
		expect(gifs).toContain(staffDeniedReply('', 'developer', rng));
	});

	test('mods, head mods (developer), and admins can use it', () => {
		expect(staffDeniedReply('123', 'moderator', rng)).toBeNull();
		expect(staffDeniedReply('123', 'developer', rng)).toBeNull();
		expect(staffDeniedReply('123', 'admin', rng)).toBeNull();
	});
});

describe('/staff view help and registration', () => {
	test('view is public so everyone in the channel can see it', () => {
		expect(STAFF_PRIVATE_SUBCOMMANDS).not.toContain('view');
		expect([...STAFF_PRIVATE_SUBCOMMANDS]).toEqual(['help']);
	});

	test('mods see /staff view in /staff help', () => {
		const commands = staffActionsFor('moderator').map(a => a.command);
		expect(commands).toContain('/staff view');
		expect(STAFF_ACTIONS.some(a => a.command === '/staff view' && a.minTier === 'moderator')).toBe(true);
	});

	test('supported types cover minion stats, data, bank, CL, gear, and info', () => {
		expect([...STAFF_VIEW_TYPES]).toEqual(['stats', 'data', 'bank', 'cl', 'gear', 'info']);
	});
});

describe('/staff view never pings the target', () => {
	test('the player label and heading have no mentions', () => {
		const label = staffViewPlayerLabel(WORST_USER);
		const heading = staffViewHeading('Minion stats', WORST_USER);
		expect(label).toBe(`${WORST_NAME} [${WORST_ID}]`);
		expect(heading).toBe(`Minion stats for ${WORST_NAME} [${WORST_ID}]`);
		expect(label.includes('<@') || heading.includes('<@')).toBe(false);
	});

	test('replies set allowedMentions to none', () => {
		const reply = staffViewSafeMessage({
			content: staffViewHeading('Minion stats', WORST_USER)
		});
		expect(reply.allowedMentions).toEqual(STAFF_NO_MENTIONS);
		expect(STAFF_NO_MENTIONS).toEqual({ parse: [], users: [], roles: [] });
	});
});

describe('/staff view names the target minion', () => {
	test('the stats title uses the player name, never Your minion', () => {
		const unnamed = staffViewMinionTitle({ username: WORST_NAME });
		const named = staffViewMinionTitle({ username: WORST_NAME, minionName: 'Z'.repeat(30) });
		expect(unnamed).toContain(`${WORST_NAME}'s minion`);
		expect(named).toContain(`${WORST_NAME}'s`);
		expect(named).toContain('Z'.repeat(30));
		expect(unnamed.includes('Your minion') || named.includes('Your minion')).toBe(false);
		expect(unnamed.includes('<@') || named.includes('<@')).toBe(false);
		expect(unnamed.length).toBeLessThanOrEqual(DISCORD_EMBED_TITLE_LIMIT);
		expect(named.length).toBeLessThanOrEqual(DISCORD_EMBED_TITLE_LIMIT);
	});
});

describe('/staff view play time', () => {
	test('no trips is a short line', () => {
		expect(formatPlayTime({ trips: 0, totalMs: 0, firstStart: null, firstType: null, activeDays: 0 })).toBe(
			'No trips recorded yet.'
		);
	});

	test('worst-case play time field stays at least 150 under the 1024 limit', () => {
		const first = new Date('2000-01-01T00:00:00.000Z');
		const text = formatPlayTime(
			{
				trips: 9_999_999_999,
				totalMs: Number.MAX_SAFE_INTEGER,
				firstStart: first,
				firstType: 'MonsterKilling',
				activeDays: 9_999_999
			},
			Date.UTC(2026, 10, 22)
		);
		underLimit(text.length, DISCORD_EMBED_FIELD_VALUE_LIMIT);
		expect(text).toContain('Total trip time');
		expect(text).toContain('Avg per day');
		expect(text).toContain('Avg per active day');
		expect(text).toContain('Days active');
	});
});

describe('/staff view Discord length limits', () => {
	test('worst-case heading stays at least 150 under the 2000 limit', () => {
		const heading = staffViewHeading('Collection log', WORST_USER);
		underLimit(heading.length, DISCORD_CONTENT_LIMIT);
	});

	test('worst-case minion stats embed stays at least 150 under Discord limits', () => {
		const emoji = '<:WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW:1234567890123456789>';
		const xp = toKMB(999_999_999_999);
		const skillLine = `${emoji} ${MAX_LEVEL.toLocaleString()} (${xp})`;
		const combatLine = `${skillEmoji.combat ?? emoji} 126`;
		const col1 = Array.from({ length: 9 }, () => skillLine).join('\n');
		const col2 = Array.from({ length: 8 }, () => skillLine).join('\n');
		const col3 = [...Array.from({ length: 9 }, () => skillLine), combatLine].join('\n');
		const overall = `${emoji} Overall\n**Level:** 9999\n**XP:** ${Number.MAX_SAFE_INTEGER.toLocaleString()}\n**QP** 9999\n**CL Completion:** 100.0%`;
		const clueScores = ClueTiers.map(t => `**${toTitleCase(t.name)}:** 999,999,999,999`).join('\n');
		const minigames = Array.from({ length: 4 }, () => `**${'M'.repeat(80)}:** 999,999,999,999`).join('\n');
		const other = Array.from({ length: 4 }, () => `**${'S'.repeat(40)}:** 999,999,999,999`).join('\n');
		const playTime = formatPlayTime({
			trips: 9_999_999_999,
			totalMs: Number.MAX_SAFE_INTEGER,
			firstStart: new Date('2000-01-01T00:00:00.000Z'),
			firstType: 'MonsterKilling',
			activeDays: 9_999_999
		});
		const title = staffViewMinionTitle({
			username: WORST_NAME,
			minionName: 'Z'.repeat(30),
			isIronman: true,
			minionIcon: emoji,
			badgesString: `${emoji} `.repeat(20)
		});
		const fields = [col1, col2, col3, overall, clueScores, minigames, other, playTime];
		const total = title.length + fields.reduce((sum, field) => sum + field.length, 0);

		expect(title.length).toBeLessThanOrEqual(DISCORD_EMBED_TITLE_LIMIT);
		for (const field of fields) {
			underLimit(field.length, DISCORD_EMBED_FIELD_VALUE_LIMIT);
		}
		underLimit(total, DISCORD_EMBED_TOTAL_LIMIT);
	});

	test('over-limit account info is sent as a file instead of being cut', () => {
		const content = `${staffViewHeading('Account info', WORST_USER)}\n${'B'.repeat(3000)}`;
		const reply = staffViewSafeMessage({ content });
		expect(reply.content?.length ?? 0).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - DISCORD_LENGTH_MARGIN);
		expect(reply.files?.[0]?.buffer.toString()).toBe(content);
		expect(reply.allowedMentions).toEqual(STAFF_NO_MENTIONS);
	});
});
