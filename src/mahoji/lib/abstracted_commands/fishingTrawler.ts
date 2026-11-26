import { calcWhatPercent, reduceNumByPercent, Time } from '@oldschoolgg/toolkit';

import type { MinigameActivityTaskOptionsWithNoChanges } from '@/lib/types/minions.js';
import { formatTripDuration } from '@/lib/util/minionUtils.js';
import { MAX_QUANTITY, validateQuantity } from '@/lib/util/validateQuantity.js';

export async function fishingTrawlerCommand(user: MUser, channelId: string, quantity?: number) {
	if (user.skillLevel('fishing') < 15) {
		return 'You need at least level 15 Fishing to do the Fishing Trawler.';
	}

	const tripsDone = await user.fetchMinigameScore('fishing_trawler');

	let tripLength = Time.Minute * 13;
	// 10% boost for 50 trips done
	const boost = Math.min(100, calcWhatPercent(tripsDone, 50)) / 10;
	tripLength = reduceNumByPercent(tripLength, boost);

	const maxTripLength = await user.calcMaxTripLength('FishingTrawler');
	const maxQuantity = Math.floor(maxTripLength / tripLength);
	if (quantity !== undefined) {
		const parsedQuantity = validateQuantity(quantity, { min: 1, max: MAX_QUANTITY });
		if (!parsedQuantity.ok) return parsedQuantity.error;
		quantity = parsedQuantity.value;
	}
	if (!quantity || quantity > maxQuantity) {
		quantity = maxQuantity;
	}
	const duration = quantity * tripLength;

	await ActivityManager.startTrip<MinigameActivityTaskOptionsWithNoChanges>({
		userID: user.id,
		channelId,
		type: 'FishingTrawler',
		minigameID: 'fishing_trawler',
		quantity,
		duration
	});

	return `${user.minionName} is now doing ${quantity}x Fishing Trawler trips, it will take around ${formatTripDuration(user, duration, ' to finish')}.\n\n**Boosts:** ${boost}% boost for experience`;
}
