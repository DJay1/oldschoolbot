import { createHash } from 'node:crypto';
import { customEmoji, lookupApplicationEmoji } from '@oldschoolgg/toolkit';

/**
 * THE single source of truth for every badge icon shown next to a player name
 * (leaderboards, /minion info, mass/party lists, duel, trade, rolesTask, admin, tames, stats).
 *
 * To change a badge picture: edit the emoji name here (and add the PNG + manifest entry),
 * run `pnpm emojis:sync` for the app, restart. Nothing else needs editing:
 * - every renderer resolves through this file at render time (never at import time),
 * - the Redis badged-username cache key includes badgeRenderVersion(), so cached names
 *   from an older badge set are ignored automatically (no manual key deletes).
 *
 * Do not call customEmoji('<badge name>') or Emoji.<badge> anywhere else. The unit test
 * tests/unit/badgeSingleSource.test.ts fails if a badge icon is hardcoded outside this file.
 */

export const BadgesEnum = {
	Developer: 0,
	Booster: 1,
	LimitedPatron: 2,
	Patron: 3,
	Moderator: 4,
	GreenGem: 5,
	Bug: 6,
	GoldenTrophy: 7,
	TopSacrifice: 8,
	TopSkiller: 9,
	TopCollector: 10,
	TopMinigame: 11,
	SotWTrophy: 12,
	Slayer: 13,
	TopGiveawayer: 14,
	Farmer: 15,
	Hacktoberfest: 16,
	// Badge id 17 is reserved and retired.
	TopClueHunter: 18,
	Tester: 19
} as const;

/** DB badge id (users.badges) -> application emoji name in assets/emojis/manifest.json. */
export const BADGE_EMOJI_NAMES: Readonly<Record<number, string>> = {
	[BadgesEnum.Developer]: 'spanner',
	[BadgesEnum.Booster]: 'pinkGem',
	[BadgesEnum.LimitedPatron]: 'crab',
	[BadgesEnum.Patron]: 'bigOrangeGem',
	[BadgesEnum.Moderator]: 'hammer',
	[BadgesEnum.GreenGem]: 'greenGem',
	[BadgesEnum.Bug]: 'bug',
	[BadgesEnum.GoldenTrophy]: 'goldTrophy',
	[BadgesEnum.TopSacrifice]: 'top_sacrificer',
	[BadgesEnum.TopSkiller]: 'top_skiller',
	[BadgesEnum.TopCollector]: 'top_collector',
	[BadgesEnum.TopMinigame]: 'top_minigamer',
	[BadgesEnum.SotWTrophy]: 'sotw_champ',
	[BadgesEnum.Slayer]: 'top_slayer',
	[BadgesEnum.TopGiveawayer]: 'top_giveawayer',
	[BadgesEnum.Farmer]: 'top_farmer',
	[BadgesEnum.Hacktoberfest]: 'hacktoberfest',
	[BadgesEnum.TopClueHunter]: 'top_clue_hunter',
	[BadgesEnum.Tester]: 'tester'
};

/** Badges that come from bits/flags instead of users.badges. */
export const EXTRA_BADGE_EMOJI_NAMES = {
	ironman: 'ironman',
	earlySupporter: 'esbcorgi',
	launchFounder: 'bscicon',
	patronCollar: 'patron_collar',
	launchBoxOpener: 'launchbox'
} as const;

/** BSC patron tier key -> emoji name. Keys must match BSC_PATRON_TIERS[].key. */
export const PATRON_BADGE_EMOJI_NAMES: Readonly<Record<string, string>> = {
	pup: 'patron_pup',
	goodboy: 'patron_goodboy',
	topdog: 'patron_topdog',
	alpha: 'patron_alpha',
	packleader: 'patron_packleader',
	biggestofdogs: 'patron_biggestofdogs'
};

/** Every emoji name this file owns (for tests and the cache version). */
export function allBadgeEmojiNames(): string[] {
	return [
		...Object.values(BADGE_EMOJI_NAMES),
		...Object.values(EXTRA_BADGE_EMOJI_NAMES),
		...Object.values(PATRON_BADGE_EMOJI_NAMES)
	];
}

/** Discord embed title and author-name limit. */
export const DISCORD_EMBED_TITLE_MAX = 256;

const COMPLETE_CUSTOM_EMOJI = /^<a?:[A-Za-z0-9_]{2,32}:\d{17,20}>$/;

/** True when this is a complete `<:name:id>` / `<a:name:id>` token. */
export function isCompleteCustomEmoji(text: string): boolean {
	return COMPLETE_CUSTOM_EMOJI.test(text);
}

/**
 * True for a complete custom emoji, or a fallback that is not custom-emoji
 * markup. Rejects raw or truncated `<:name` / `<:name:id` tokens.
 */
export function isSafeBadgeToken(text: string): boolean {
	if (!text) return false;
	if (isCompleteCustomEmoji(text)) return true;
	return !text.includes('<') && !text.includes('>');
}

function resolvedBadgeMarkup(name: string): string {
	const markup = customEmoji(name);
	return isSafeBadgeToken(markup) ? markup : '';
}

/**
 * Cut `text` to maxLen without splitting a custom emoji. If the cut lands
 * inside `<:name:id>`, the incomplete token is dropped.
 */
export function trimAtEmojiBoundary(text: string, maxLen: number): string {
	if (text.length <= maxLen) return text;
	let cut = text.slice(0, maxLen);
	const starts = [...cut.matchAll(/<a?:/g)].map(match => match.index ?? -1);
	const lastStart = starts.length ? starts[starts.length - 1]! : -1;
	if (lastStart >= 0) {
		const tail = cut.slice(lastStart);
		if (!isCompleteCustomEmoji(tail)) {
			cut = cut.slice(0, lastStart).trimEnd();
		}
	}
	return cut;
}

function joinBadgeLine(badges: string[], suffix: string): string {
	if (badges.length === 0) return suffix;
	if (!suffix) return badges.join(' ');
	return `${badges.join(' ')} ${suffix}`;
}

/**
 * Fit a badge row plus an optional suffix (minion name, RSN, etc.) into a
 * Discord length cap. Whole badges are dropped from the end until it fits.
 * Never splits a custom emoji, and never keeps a token with an unresolved id.
 */
export function fitBadgeLine(badgeString: string, suffix = '', maxLen = DISCORD_EMBED_TITLE_MAX): string {
	const badges = (badgeString ?? '').split(/\s+/).filter(isSafeBadgeToken);
	let suffixPart = suffix ?? '';
	if (suffixPart.length > maxLen) {
		suffixPart = trimAtEmojiBoundary(suffixPart, maxLen);
	}
	const kept: string[] = [];
	for (const badge of badges) {
		if (joinBadgeLine([...kept, badge], suffixPart).length <= maxLen) {
			kept.push(badge);
		} else {
			break;
		}
	}
	return joinBadgeLine(kept, suffixPart);
}

/** Emoji markup for a DB badge id, or '' for an unknown/retired id. */
export function badgeEmoji(badgeId: number): string {
	const name = BADGE_EMOJI_NAMES[badgeId];
	return name ? resolvedBadgeMarkup(name) : '';
}

export function badgeEmojiName(badgeId: number): string | null {
	return BADGE_EMOJI_NAMES[badgeId] ?? null;
}

export function extraBadgeEmoji(key: keyof typeof EXTRA_BADGE_EMOJI_NAMES): string {
	return resolvedBadgeMarkup(EXTRA_BADGE_EMOJI_NAMES[key]);
}

export function patronBadgeEmojiName(tierKey: string): string | null {
	return PATRON_BADGE_EMOJI_NAMES[tierKey] ?? null;
}

export function patronBadgeEmoji(tierKey: string): string {
	const name = patronBadgeEmojiName(tierKey);
	return name ? resolvedBadgeMarkup(name) : '';
}

export function launchFounderBadge(): string {
	return extraBadgeEmoji('launchFounder');
}

/** Legacy map shape (id -> markup). Getters resolve at access time, never at import. */
export const badges: Readonly<Record<number, string>> = Object.defineProperties(
	{},
	Object.fromEntries(
		Object.keys(BADGE_EMOJI_NAMES).map(id => [
			id,
			{ enumerable: true, get: () => badgeEmoji(Number(id)) } satisfies PropertyDescriptor
		])
	)
) as Readonly<Record<number, string>>;

/** True when every badge emoji name exists in the manifest. */
export function missingBadgeEmojiNames(): string[] {
	return allBadgeEmojiNames().filter(name => !lookupApplicationEmoji(name));
}

/**
 * Short hash of the badge map and the currently resolved emoji markup (ids file).
 * Changes whenever this file's mapping changes or `pnpm emojis:sync` writes new ids,
 * so the Redis badged-username cache key rolls over by itself.
 */
export function badgeRenderVersion(): string {
	const resolved = allBadgeEmojiNames().map(name => `${name}=${customEmoji(name)}`);
	return createHash('sha1').update(resolved.join('|')).digest('hex').slice(0, 10);
}
