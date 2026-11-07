import { Emoji } from '@oldschoolgg/toolkit';

import { badges } from '@/lib/constants.js';

export function makeBadgeString(
	badgeIDs: number[] | null | undefined,
	isIronman: boolean,
	isBSCEarlySupporter: boolean
) {
	const rawBadges: string[] = (badgeIDs ?? []).map(num => badges[num]).filter(emoji => Boolean(emoji));
	if (isIronman) {
		rawBadges.push(Emoji.Ironman);
	}
	if (isBSCEarlySupporter) {
		rawBadges.unshift(Emoji.EsbCorgi);
	}
	return rawBadges.join(' ').trim();
}
