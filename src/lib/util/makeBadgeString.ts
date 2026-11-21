import {
	BadgesEnum,
	badgeEmoji,
	badgeEmojiName,
	EXTRA_BADGE_EMOJI_NAMES,
	extraBadgeEmoji,
	patronBadgeEmoji,
	patronBadgeEmojiName
} from '@/lib/badges/badgeEmojis.js';
import { bscPatronTierFromBits } from '@/lib/bsc/patronTiers.js';
import { BitField } from '@/lib/constants.js';

/**
 * Builds the badge row next to a player name. Every icon comes from
 * src/lib/badges/badgeEmojis.ts and is resolved at render time.
 * Order: early supporter, founder, patron tier, patron collar, DB badges, ironman.
 */
interface BadgeSlot {
	name: string;
	render: () => string;
}

function badgeSlots(
	badgeIDs: number[] | null | undefined,
	isIronman: boolean,
	isBSCEarlySupporter: boolean,
	isLaunchFounder: boolean,
	patronBits: readonly number[]
): BadgeSlot[] {
	const badgeList = [...(badgeIDs ?? [])];
	if (patronBits.includes(BitField.Developer) && !badgeList.includes(BadgesEnum.Developer)) {
		badgeList.unshift(BadgesEnum.Developer);
	}
	const slots: BadgeSlot[] = [];
	if (isBSCEarlySupporter) {
		slots.push({ name: EXTRA_BADGE_EMOJI_NAMES.earlySupporter, render: () => extraBadgeEmoji('earlySupporter') });
	}
	if (isLaunchFounder) {
		slots.push({ name: EXTRA_BADGE_EMOJI_NAMES.launchFounder, render: () => extraBadgeEmoji('launchFounder') });
	}
	const patron = bscPatronTierFromBits(patronBits);
	const patronName = patron ? patronBadgeEmojiName(patron.key) : null;
	if (patron && patronName) {
		slots.push({ name: patronName, render: () => patronBadgeEmoji(patron.key) });
	}
	if (patronBits.includes(BitField.BSCPatronCosmetic)) {
		slots.push({ name: EXTRA_BADGE_EMOJI_NAMES.patronCollar, render: () => extraBadgeEmoji('patronCollar') });
	}
	for (const id of badgeList) {
		const name = badgeEmojiName(id);
		if (name) slots.push({ name, render: () => badgeEmoji(id) });
	}
	if (isIronman) {
		slots.push({ name: EXTRA_BADGE_EMOJI_NAMES.ironman, render: () => extraBadgeEmoji('ironman') });
	}
	return slots;
}

export function makeBadgeString(
	badgeIDs: number[] | null | undefined,
	isIronman: boolean,
	isBSCEarlySupporter: boolean,
	isLaunchFounder = false,
	patronBits: readonly number[] = []
) {
	return badgeSlots(badgeIDs, isIronman, isBSCEarlySupporter, isLaunchFounder, patronBits)
		.map(slot => slot.render())
		.filter(emoji => emoji.length > 0)
		.join(' ')
		.trim();
}

/** Emoji file stems in the same order as makeBadgeString (patron profile card). */
export function makeBadgeEmojiNames(
	badgeIDs: number[] | null | undefined,
	isIronman: boolean,
	isBSCEarlySupporter: boolean,
	isLaunchFounder = false,
	patronBits: readonly number[] = []
): string[] {
	return badgeSlots(badgeIDs, isIronman, isBSCEarlySupporter, isLaunchFounder, patronBits).map(slot => slot.name);
}
