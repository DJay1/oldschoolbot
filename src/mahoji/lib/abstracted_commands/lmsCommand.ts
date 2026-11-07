import { stringMatches, Time } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import { LMSBuyables } from '@/lib/data/CollectionsExport.js';
import type { MinigameActivityTaskOptionsWithNoChanges } from '@/lib/types/minions.js';
import { formatTripDuration } from '@/lib/util/minionUtils.js';
import { requirePositiveQuantity, safePositiveProduct } from '@/lib/util/validateQuantity.js';
import { getUsersLMSStats } from '@/tasks/minions/minigames/lmsActivity.js';

export async function lmsCommand(
	options: {
		stats?: {};
		start?: {};
		buy?: { name?: string; quantity?: number };
	},
	user: MUser,
	channelId: string,
	interaction: MInteraction,
	rng: RNGProvider
) {
	const stats = await getUsersLMSStats(user);

	if (options.stats) {
		return `**Last Man Standing**

**Wins:** ${stats.gamesWon}
**Reward Points:** ${stats.points}
**Average Kills Per Game:** ${stats.averageKills.toFixed(2)}
**Average Position:** ${stats.averagePosition.toFixed(2)}
**Highest Kill Match:** ${stats.highestKillInGame} kills
**Total Matches:** ${stats.totalGames}`;
	}

	if (options.buy) {
		const itemToBuy = LMSBuyables.find(i => stringMatches(i.item.name, options.buy?.name ?? ''));
		if (!itemToBuy) {
			return "That's not a valid item you can buy.";
		}
		const parsedQuantity = requirePositiveQuantity(options.buy.quantity, { max: 1000 });
		if (!parsedQuantity.ok) return parsedQuantity.error;
		const quantity = parsedQuantity.value;
		const parsedCost = safePositiveProduct(itemToBuy.cost ?? 0, quantity);
		if (!parsedCost.ok) return parsedCost.error;
		const cost = parsedCost.value;
		const parsedLootQuantity = safePositiveProduct(itemToBuy.quantity ?? 1, quantity);
		if (!parsedLootQuantity.ok) return parsedLootQuantity.error;
		if (cost && stats.points < cost) {
			return `You don't have enough points. ${quantity}x ${itemToBuy.item.name} costs ${cost}, but you have ${stats.points}.`;
		}
		if (itemToBuy.wins && stats.gamesWon < itemToBuy.wins) {
			return `You are not worthy! You need to have won at least ${itemToBuy.wins} games to buy the ${itemToBuy.item.name}.`;
		}
		const loot = new Bank().add(itemToBuy.item.id, parsedLootQuantity.value);
		await interaction.confirmation(`Are you sure you want to spend ${cost} points on buying ${loot}?`);
		if (!cost) {
			await user.transactItems({
				collectionLog: true,
				itemsToAdd: loot
			});
			return `You received ${loot}.`;
		}

		const otherUpdates = {
			lms_points: {
				decrement: cost
			}
		};
		if (itemToBuy.onlyCL) {
			await user.addItemsToCollectionLog({ itemsToAdd: loot, otherUpdates });
		} else {
			await user.transactItems({
				collectionLog: true,
				itemsToAdd: loot,
				otherUpdates
			});
		}
		return `You spent ${cost} points to buy ${loot}. You now have ${user.user.lms_points} LMS points.`;
	}

	if (await user.minionIsBusy()) {
		return 'Your minion must not be busy to do an LMS trip';
	}
	const durationPerGame = Time.Minute * 5.5;
	const quantity = Math.floor((await user.calcMaxTripLength('LastManStanding')) / durationPerGame);
	const duration = rng.randomVariation(quantity * durationPerGame, 5);

	await ActivityManager.startTrip<MinigameActivityTaskOptionsWithNoChanges>({
		minigameID: 'lms',
		userID: user.id,
		channelId,
		duration,
		type: 'LastManStanding',
		quantity
	});

	return `${
		user.minionName
	} is now off to do ${quantity} games of competitive Last Man Standing. The trip will return in about ${formatTripDuration(user, duration)}.`;
}
