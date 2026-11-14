import { Time } from '@oldschoolgg/toolkit';

import { thanksgivingFishingBoosts } from '@/lib/events/thanksgiving/core.js';
import type { ActivityTaskOptionsWithQuantity } from '@/lib/types/minions.js';
import { formatTripDuration } from '@/lib/util/minionUtils.js';

export async function aerialFishingCommand({
	user,
	channelId,
	rng
}: {
	user: MUser;
	channelId: string;
	rng: RNGProvider;
}) {
	if (user.skillsAsLevels.fishing < 43 || user.skillsAsLevels.hunter < 35) {
		return 'You need at least level 35 Hunter and 43 Fishing to do Aerial fishing.';
	}

	// Straw Hat Harvest: Laboon and Straw hat speed, same as normal fishing (no-op when the event code is off).
	const harvest = thanksgivingFishingBoosts(user);
	const timePerFish = (rng.randomVariation(2, 7.5) * Time.Second) / harvest.speedMultiplier;
	const quantity = Math.floor((await user.calcMaxTripLength('AerialFishing')) / timePerFish);
	const duration = timePerFish * quantity;

	await ActivityManager.startTrip<ActivityTaskOptionsWithQuantity>({
		userID: user.id,
		channelId,
		quantity,
		duration,
		type: 'AerialFishing'
	});

	const boosts = harvest.lines.length > 0 ? `\n\n**Boosts:** ${harvest.lines.join(', ')}.` : '';
	return `${user.minionName} is now doing Aerial fishing, it will take around ${formatTripDuration(user, duration)} to finish.${boosts}`;
}
