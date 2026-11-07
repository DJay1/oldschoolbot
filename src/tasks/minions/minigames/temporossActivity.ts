import { calcPerHour, increaseNumByPercent } from '@oldschoolgg/toolkit';

import { getTemporossLoot } from '@/lib/simulation/tempoross.js';
import type { TemporossActivityTaskOptions } from '@/lib/types/minions.js';
import { makeBankImage } from '@/lib/util/makeBankImage.js';

export const temporossTask: MinionTask = {
	type: 'Tempoross',
	async run(data: TemporossActivityTaskOptions, { user, handleTripFinish }) {
		const { channelId, quantity, rewardBoost, duration } = data;

		const currentLevel = user.skillsAsLevels.fishing;
		const { newScore } = await user.incrementMinigameScore('tempoross', quantity);

		let rewardTokens = quantity * 6;
		if (rewardBoost > 0) {
			rewardTokens = Math.ceil(increaseNumByPercent(rewardTokens, rewardBoost));
		}
		const loot = getTemporossLoot(rewardTokens, currentLevel, user.bank);

		const fXPtoGive = quantity * 5500 * (currentLevel / 40);

		const xpStr = await user.addXP({
			skillName: 'fishing',
			amount: fXPtoGive,
			duration,
			source: 'Tempoross'
		});

		const { previousCL, itemsAdded } = await user.transactItems({
			collectionLog: true,
			itemsToAdd: loot
		});

		const image = await makeBankImage({
			bank: itemsAdded,
			title: `${rewardTokens} reward pool rolls`,
			user,
			previousCL
		});

		const output = `${user}, ${
			user.minionName
		} finished fighting Tempoross ${quantity}x times (${calcPerHour(quantity, data.duration).toFixed(1)}/hr), you now have ${newScore} KC. ${xpStr.toLocaleString()}`;

		return handleTripFinish({
			user,
			channelId,
			message: { content: output, files: [image] },
			data,
			loot: itemsAdded
		});
	}
};
