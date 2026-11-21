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
	TopClueHunter: 18
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
	[BadgesEnum.TopClueHunter]: 'top_clue_hunter'
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

/** Emoji markup for a DB badge id, or '' for an unknown/retired id. */
export function badgeEmoji(badgeId: number): string {
	const name = BADGE_EMOJI_NAMES[badgeId];
	return name ? customEmoji(name) : '';
}

export function badgeEmojiName(badgeId: number): string | null {
	return BADGE_EMOJI_NAMES[badgeId] ?? null;
}

export function extraBadgeEmoji(key: keyof typeof EXTRA_BADGE_EMOJI_NAMES): string {
	return customEmoji(EXTRA_BADGE_EMOJI_NAMES[key]);
}

export function patronBadgeEmojiName(tierKey: string): string | null {
	return PATRON_BADGE_EMOJI_NAMES[tierKey] ?? null;
}

export function patronBadgeEmoji(tierKey: string): string {
	const name = patronBadgeEmojiName(tierKey);
	return name ? customEmoji(name) : '';
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
