import { Emoji } from '@oldschoolgg/toolkit';

import { badges } from '@/lib/constants.js';
import { LAUNCH_FOUNDER_BADGE } from '@/lib/events/launch/constants.js';

export function makeBadgeString(
	badgeIDs: number[] | null | undefined,
	isIronman: boolean,
	isBSCEarlySupporter: boolean,
	isLaunchFounder = false
) {
	const rawBadges: string[] = (badgeIDs ?? []).map(num => badges[num]).filter(emoji => Boolean(emoji));
	if (isIronman) {
		rawBadges.push(Emoji.Ironman);
	}
	if (isLaunchFounder) {
		rawBadges.unshift(LAUNCH_FOUNDER_BADGE);
	}
	if (isBSCEarlySupporter) {
		rawBadges.unshift(Emoji.EsbCorgi);
	}
	return rawBadges.join(' ').trim();
}
