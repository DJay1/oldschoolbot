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
	DISCORD_EMBED_TITLE_MAX,
	EXTRA_BADGE_EMOJI_NAMES,
	fitBadgeLine,
	missingBadgeEmojiNames,
	PATRON_BADGE_EMOJI_NAMES,
	trimAtEmojiBoundary
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

function writeFakeIds(seed: number, omit: ReadonlySet<string> = new Set()): void {
	// The emoji loader resolves the ids file relative to the repo, so keep it inside node_modules.
	const dir = mkdtempSync(join(process.cwd(), 'node_modules', '.badge-ids-'));
	tempDirs.push(dir);
	const ids: Record<string, string> = {};
	allBadgeEmojiNames().forEach((name, i) => {
		if (omit.has(name)) return;
		const entry = lookupApplicationEmoji(name);
		if (entry) ids[entry.uploadName] = String(100000000000000000n + BigInt(seed * 1000 + i));
	});
	const file = join(dir, 'ids.json');
	writeFileSync(file, JSON.stringify(ids));
	process.env[ID_FILE_ENV] = relative(process.cwd(), file);
	resetApplicationEmojiCache();
}

function useFakeIds(seed: number): void {
	writeFakeIds(seed);
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

	test('a player with every badge keeps a valid minion-stats title', () => {
		useFakeIds(4);
		const allBits = [
			BitField.Developer,
			BitField.PatronTier6,
			BitField.BSCPatronCosmetic,
			BitField.BSCEarlySupporter,
			BitField.LaunchFounder
		];
		const badges = makeBadgeString(Object.values(BadgesEnum), true, true, true, allBits);
		const suffix = `${customEmoji('ironman')} ${customEmoji('minion')} **${'Z'.repeat(30)}**`;
		const full = `${badges} ${suffix}`;
		expect(full.length).toBeGreaterThan(DISCORD_EMBED_TITLE_MAX);
		const naive = full.slice(0, 255);
		const naiveStripped = naive.replace(/<a?:[A-Za-z0-9_]{2,32}:\d{17,20}>/g, '');
		expect(naiveStripped).toMatch(/<a?:/);

		const title = fitBadgeLine(badges, suffix);
		expect(title.length).toBeLessThanOrEqual(DISCORD_EMBED_TITLE_MAX);
		expect(title).toContain('Z'.repeat(30));
		expect(title.replace(/<a?:[A-Za-z0-9_]{2,32}:\d{17,20}>/g, '')).not.toMatch(/<a?:/);
		expect(title).toContain(customEmoji('esbcorgi'));
		expect(title.length).toBeLessThan(full.length);
	});

	test('a missing emoji id is omitted instead of raw markup', () => {
		writeFakeIds(5, new Set([BADGE_EMOJI_NAMES[BadgesEnum.TopCollector]]));
		const missing = badgeEmoji(BadgesEnum.TopCollector);
		expect(missing).not.toContain('<');
		expect(missing).not.toContain('top_collector');
		expect(badgeEmoji(BadgesEnum.Developer)).toMatch(/^<a?:spanner:\d{17,20}>$/);
		const row = makeBadgeString([BadgesEnum.TopCollector, BadgesEnum.Developer], false, false);
		expect(row).not.toMatch(/top_collector/);
		expect(row.replace(/<a?:[A-Za-z0-9_]{2,32}:\d{17,20}>/g, '')).not.toMatch(/<a?:/);
		expect(fitBadgeLine(`<:top_collector ${badgeEmoji(BadgesEnum.Developer)}`, 'Zootr')).toBe(
			`${badgeEmoji(BadgesEnum.Developer)} Zootr`
		);
	});

	test('trimAtEmojiBoundary drops an incomplete trailing emoji', () => {
		useFakeIds(6);
		const emoji = customEmoji('top_collector');
		const text = `hello ${emoji}`;
		const cut = trimAtEmojiBoundary(text, text.length - 3);
		expect(cut).toBe('hello');
		expect(cut).not.toContain('<:');
		expect(trimAtEmojiBoundary(text, text.length)).toBe(text);
	});
});
