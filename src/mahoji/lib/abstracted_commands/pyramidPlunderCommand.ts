import { formatDuration, reduceNumByPercent, Time } from '@oldschoolgg/toolkit';

import { plunderBoosts, plunderRooms } from '@/lib/minions/data/plunder.js';
import type { PlunderActivityTaskOptions } from '@/lib/types/minions.js';
import { formatTripDuration } from '@/lib/util/minionUtils.js';
import { MAX_QUANTITY, validateQuantity } from '@/lib/util/validateQuantity.js';

export async function pyramidPlunderCommand(user: MUser, channelId: string, quantity?: number) {
	if (await user.minionIsBusy()) return `${user.minionName} is busy.`;
	const skills = user.skillsAsLevels;
	const thievingLevel = skills.thieving;
	const minLevel = plunderRooms[0].thievingLevel;
	if (thievingLevel < minLevel) {
		return `You need at least level ${minLevel} Thieving to do the Pyramid Plunder.`;
	}

	const completableRooms = plunderRooms.filter(room => thievingLevel >= room.thievingLevel);

	let plunderTime = Time.Minute * 5.75;

	const boosts = [];

	if (!user.hasGracefulEquipped()) {
		plunderTime *= 1.075;
		boosts.push('-7.5% time penalty for not having graceful equipped');
	}

	// Every 1h becomes 1% faster to a cap of 10%
	const percentFaster = Math.min(
		Math.floor((await user.fetchMinigameScore('pyramid_plunder')) / (Time.Hour / plunderTime)),
		10
	);

	boosts.push(`${percentFaster.toFixed(1)}% for minion learning`);

	plunderTime = reduceNumByPercent(plunderTime, percentFaster);

	for (const [item, percent] of plunderBoosts.items()) {
		if (user.hasEquippedOrInBank(item.id)) {
			boosts.push(`${percent}% for ${item.name}`);
			plunderTime = reduceNumByPercent(plunderTime, percent);
		}
	}
	const maxTripLength = await user.calcMaxTripLength('Plunder');
	const maxQuantity = Math.floor(maxTripLength / plunderTime);
	if (quantity !== undefined) {
		const parsedQuantity = validateQuantity(quantity, { min: 1, max: MAX_QUANTITY });
		if (!parsedQuantity.ok) return parsedQuantity.error;
		quantity = parsedQuantity.value;
	}
	if (!quantity || quantity > maxQuantity) {
		quantity = maxQuantity;
	}
	const tripLength = quantity * plunderTime;

	await ActivityManager.startTrip<PlunderActivityTaskOptions>({
		rooms: completableRooms.map(room => room.number),
		quantity,
		userID: user.id,
		duration: tripLength,
		type: 'Plunder',
		channelId,
		minigameID: 'pyramid_plunder'
	});

	let str = `${
		user.minionName
	} is now doing Pyramid Plunder ${quantity} times, each cycle they are looting the last two rooms ${
		completableRooms.length < 2 ? 1 : completableRooms[completableRooms.length - 2].number
	} and ${completableRooms[completableRooms.length - 1].number}, the trip will return in about ${formatTripDuration(user, tripLength)}, with each cycle taking ${formatDuration(plunderTime)}.`;

	if (boosts.length > 0) {
		str += `\n\n**Boosts:** ${boosts.join(', ')}.`;
	}

	return str;
}
