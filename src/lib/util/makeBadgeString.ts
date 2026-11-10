import { customEmoji, Emoji } from '@oldschoolgg/toolkit';

import { BSC_SUPPORTER_COSMETIC, bscPatronTierFromBits } from '@/lib/bsc/patronTiers.js';
import { BadgesEnum, BitField, badges } from '@/lib/constants.js';
import { LAUNCH_FOUNDER_BADGE } from '@/lib/events/launch/constants.js';

/**
 * Leaderboards and name badges resolve patron icons here.
 * Tier key -> application emoji (patron_pup ... patron_biggestofdogs). Staff Top Dog
 * (PatronTier3 bit from role sync) uses patron_topdog. customEmoji is called at
 * render time so a prior Redis cache of the dog fallback is not sticky after emojis:sync.
 */
export function makeBadgeString(
	badgeIDs: number[] | null | undefined,
	isIronman: boolean,
	isBSCEarlySupporter: boolean,
	isLaunchFounder = false,
	patronBits: readonly number[] = []
) {
	const badgeList = [...(badgeIDs ?? [])];
	if (patronBits.includes(BitField.Developer) && !badgeList.includes(BadgesEnum.Developer)) {
		badgeList.unshift(BadgesEnum.Developer);
	}
	const rawBadges: string[] = badgeList.map(num => badges[num]).filter(emoji => Boolean(emoji));
	if (isIronman) {
		rawBadges.push(Emoji.Ironman);
	}
	if (patronBits.includes(BitField.BSCPatronCosmetic)) {
		rawBadges.unshift(BSC_SUPPORTER_COSMETIC);
	}
	const patron = bscPatronTierFromBits(patronBits);
	if (patron) {
		rawBadges.unshift(customEmoji(`patron_${patron.key}`));
	}
	if (isLaunchFounder) {
		rawBadges.unshift(LAUNCH_FOUNDER_BADGE);
	}
	if (isBSCEarlySupporter) {
		rawBadges.unshift(Emoji.EsbCorgi);
	}
	return rawBadges.join(' ').trim();
}
