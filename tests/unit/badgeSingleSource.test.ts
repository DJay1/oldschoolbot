import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { customEmoji, lookupApplicationEmoji, resetApplicationEmojiCache } from '@oldschoolgg/toolkit';
import { afterEach, describe, expect, test } from 'vitest';

import {
	allBadgeEmojiNames,
	BADGE_EMOJI_NAMES,
	BadgesEnum,
	badgeEmoji,
	badgeRenderVersion,
	badges,
	EXTRA_BADGE_EMOJI_NAMES,
	missingBadgeEmojiNames,
	PATRON_BADGE_EMOJI_NAMES
} from '@/lib/badges/badgeEmojis.js';
import { BSC_PATRON_TIERS } from '@/lib/bsc/patronTiers.js';
import { BitField } from '@/lib/constants.js';
import { fitLeaderboardPage, LB_PAGE_MAX_CHARS } from '@/lib/menuWrapper.js';
import { makeBadgeString } from '@/lib/util/makeBadgeString.js';

const SRC = join(process.cwd(), 'src');
const SINGLE_SOURCE = join('src', 'lib', 'badges', 'badgeEmojis.ts');

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full, out);
		else if (/\.(ts|mts|tsx)$/.test(entry)) out.push(full);
	}
	return out;
}

/** Emoji names that only exist as badges, so any quoted use outside the single file is a hardcode. */
const BADGE_ONLY_NAMES = [
	...Object.values(BADGE_EMOJI_NAMES).filter(
		n => n.startsWith('top_') || n === 'sotw_champ' || n === 'hacktoberfest'
	),
	...Object.values(PATRON_BADGE_EMOJI_NAMES),
	EXTRA_BADGE_EMOJI_NAMES.patronCollar
];

const ID_FILE_ENV = 'APPLICATION_EMOJI_IDS_FILE';
const originalIdsEnv = process.env[ID_FILE_ENV];
const tempDirs: string[] = [];

function useFakeIds(seed: number): void {
	// The emoji loader resolves the ids file relative to the repo, so keep it inside node_modules.
	const dir = mkdtempSync(join(process.cwd(), 'node_modules', '.badge-ids-'));
	tempDirs.push(dir);
	const ids: Record<string, string> = {};
	allBadgeEmojiNames().forEach((name, i) => {
		const entry = lookupApplicationEmoji(name);
		if (entry) ids[entry.uploadName] = String(100000000000000000n + BigInt(seed * 1000 + i));
	});
	const file = join(dir, 'ids.json');
	writeFileSync(file, JSON.stringify(ids));
	process.env[ID_FILE_ENV] = relative(process.cwd(), file);
	resetApplicationEmojiCache();
}

afterEach(() => {
	if (originalIdsEnv === undefined) delete process.env[ID_FILE_ENV];
	else process.env[ID_FILE_ENV] = originalIdsEnv;
	resetApplicationEmojiCache();
	for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('badge emojis have one source of truth', () => {
	test('no badge icon is hardcoded outside src/lib/badges/badgeEmojis.ts', () => {
		const offenders: string[] = [];
		const quoted = new RegExp(`['"\`](${BADGE_ONLY_NAMES.join('|')})['"\`]`);
		const markup = new RegExp(`<a?:(${allBadgeEmojiNames().join('|')}):\\d{17,20}>`);
		const legacyEmoji = /Emoji\.(Spanner|PinkGem|Crab|BigOrangeGem|Hammer|GreenGem|Bug)\b/;
		const patronTemplate = /customEmoji\(\s*`patron_/;
		const legacyMap = /\bbadges\[|\bb\.text\b|string_agg\(b\.text/;
		for (const file of walk(SRC)) {
			const rel = relative(process.cwd(), file).split(sep).join('/');
			if (rel === SINGLE_SOURCE.split(sep).join('/')) continue;
			const lines = readFileSync(file, 'utf8').split(/\r?\n/);
			lines.forEach((line, i) => {
				if (/^\s*(\/\/|\*)/.test(line)) return;
				if (
					quoted.test(line) ||
					markup.test(line) ||
					legacyEmoji.test(line) ||
					patronTemplate.test(line) ||
					legacyMap.test(line)
				) {
					offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
				}
			});
		}
		expect(offenders).toEqual([]);
	});

	test('every badge id, extra and patron tier maps to a manifest emoji', () => {
		expect(missingBadgeEmojiNames()).toEqual([]);
		for (const id of Object.values(BadgesEnum)) {
			expect(BADGE_EMOJI_NAMES[id], `badge id ${id}`).toBeTruthy();
		}
		for (const tier of BSC_PATRON_TIERS) {
			expect(PATRON_BADGE_EMOJI_NAMES[tier.key], `patron tier ${tier.key}`).toBeTruthy();
		}
		expect(badges[17]).toBeUndefined();
		expect(badgeEmoji(17)).toBe('');
	});

	test('every badge resolves to its synced application emoji at render time', () => {
		useFakeIds(1);
		for (const name of allBadgeEmojiNames()) {
			const entry = lookupApplicationEmoji(name);
			expect(customEmoji(name)).toMatch(new RegExp(`^<a?:${entry?.uploadName}:\\d{17,20}>$`));
		}
		for (const id of Object.values(BadgesEnum)) {
			expect(badgeEmoji(id)).toMatch(/^<a?:\w+:\d{17,20}>$/);
			expect(badges[id]).toBe(badgeEmoji(id));
		}
	});

	test('render version (part of the Redis name cache key) changes when ids change', () => {
		useFakeIds(1);
		const a = badgeRenderVersion();
		expect(badgeRenderVersion()).toBe(a);
		useFakeIds(2);
		const b = badgeRenderVersion();
		expect(b).not.toBe(a);
		expect(b).toMatch(/^[0-9a-f]{10}$/);
	});

	test('redis badged-username key always goes through the versioned helper', () => {
		const redis = readFileSync(join(SRC, 'lib', 'cache', 'redis.ts'), 'utf8');
		const raw = redis.match(/BotKeys\.User\.BadgedUsername\(/g) ?? [];
		expect(raw.length).toBe(1);
		expect(redis).toMatch(/BotKeys\.User\.BadgedUsername\(userId\)\}:\$\{badgeRenderVersion\(\)\}/);
	});

	test('worst-case leaderboard page stays under the embed limit', () => {
		useFakeIds(3);
		const allBits = [
			BitField.Developer,
			BitField.PatronTier6,
			BitField.BSCPatronCosmetic,
			BitField.BSCEarlySupporter,
			BitField.LaunchFounder
		];
		const row = makeBadgeString(Object.values(BadgesEnum), true, true, true, allBits);
		const name = 'x'.repeat(32);
		const lines = Array.from(
			{ length: 10 },
			(_, i) => `${i + 1}. **${row} ${name}:** 999,999,999,999 (Most Launch box Received)`
		);
		expect(lines.join('\n').length).toBeGreaterThan(4096);
		const page = fitLeaderboardPage(lines);
		expect(page.length).toBeLessThanOrEqual(4096 - 150);
		expect(page.length).toBeLessThanOrEqual(LB_PAGE_MAX_CHARS);
		expect(page.split('\n')).toHaveLength(10);
		expect(page).toContain(name);
	});
});
