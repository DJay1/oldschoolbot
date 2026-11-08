import { Emoji } from '@oldschoolgg/toolkit';

import { BSC_SUPPORTER_COSMETIC, bscPatronTierFromBits } from '@/lib/bsc/patronTiers.js';
import { BitField, badges } from '@/lib/constants.js';
import { LAUNCH_FOUNDER_BADGE } from '@/lib/events/launch/constants.js';

export function makeBadgeString(
	badgeIDs: number[] | null | undefined,
	isIronman: boolean,
	isBSCEarlySupporter: boolean,
	isLaunchFounder = false,
	patronBits: readonly number[] = []
) {
	const rawBadges: string[] = (badgeIDs ?? []).map(num => badges[num]).filter(emoji => Boolean(emoji));
	if (isIronman) {
		rawBadges.push(Emoji.Ironman);
	}
	if (patronBits.includes(BitField.BSCPatronCosmetic)) {
		rawBadges.unshift(BSC_SUPPORTER_COSMETIC);
	}
	const patron = bscPatronTierFromBits(patronBits);
	if (patron) {
		rawBadges.unshift(patron.badge);
	}
	if (isLaunchFounder) {
		rawBadges.unshift(LAUNCH_FOUNDER_BADGE);
	}
	if (isBSCEarlySupporter) {
		rawBadges.unshift(Emoji.EsbCorgi);
	}
	return rawBadges.join(' ').trim();
}
