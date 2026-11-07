import { MIN_LENGTH_FOR_PET } from '@/lib/bso/bsoConstants.js';
import { clAdjustedDroprate } from '@/lib/bso/bsoUtil.js';
import { globalDroprates } from '@/lib/bso/globalDroprates.js';

import { customEmoji, Time } from '@oldschoolgg/toolkit';
import { Bank, LootTable } from 'oldschooljs';

import Mining from '@/lib/skilling/skills/mining.js';
import type { MotherlodeMiningActivityTaskOptions } from '@/lib/types/minions.js';
import { skillingPetDropRate } from '@/lib/util.js';

export const motherlodeMiningTask: MinionTask = {
	type: 'MotherlodeMining',
	async run(data: MotherlodeMiningActivityTaskOptions, { user, handleTripFinish, rng }) {
		const { channelId, duration } = data;
		const { quantity } = data;

		let xpReceived = quantity * Mining.MotherlodeMine.xp;
		let cleaningXP = 0;

		const currentLevel = user.skillsAsLevels.mining;

		const loot = new Bank();

		let nuggetWeight = 273;

		if ([43, 57, 71, 85, 99].includes(currentLevel)) {
			nuggetWeight = 313;
		}
		let runiteWeight = currentLevel >= 85 ? Math.round(100 * (0.080_71 * currentLevel - 5.721)) : 0;
		let adamantiteWeight = currentLevel >= 70 ? Math.round(100 * (0.5187 * currentLevel - 32.39)) : 0;
		let mithrilWeight = currentLevel >= 55 ? Math.round(100 * (0.2521 * currentLevel + 2.705)) : 0;
		let goldWeight = currentLevel >= 40 ? Math.round(100 * (0.2211 * currentLevel + 2.807)) : 0;

		// Check for falador elite diary for increased ore rates
		const hasEliteDiary = user.hasDiary('falador.elite');
		if (hasEliteDiary) {
			if (currentLevel >= 85) runiteWeight += 100;
			if (currentLevel >= 70) adamantiteWeight += 100;
			mithrilWeight += 100;
			goldWeight += 100;
		}

		const coalWeight = 10_000 - (nuggetWeight + runiteWeight + adamantiteWeight + mithrilWeight + goldWeight);

		let table = new LootTable()
			.add('Golden nugget', 1, nuggetWeight)
			.add('Runite ore', 1, runiteWeight)
			.add('Adamantite ore', 1, adamantiteWeight)
			.add('Mithril ore', 1, mithrilWeight)
			.add('Gold ore', 1, goldWeight)
			.add('Coal', 1, coalWeight);

		if (user.hasEquippedOrInBank('Mining master cape')) {
			table = new LootTable()
				.add('Golden nugget', 2, nuggetWeight)
				.add('Runite ore', 1, runiteWeight)
				.add('Adamantite ore', 1, adamantiteWeight)
				.add('Mithril ore', 1, mithrilWeight)
				.add('Gold ore', 1, goldWeight)
				.add('Coal', 1, coalWeight);
		}

		loot.add(table.roll(quantity));
		if (loot.has('Runite ore')) {
			cleaningXP += 75 * loot.amount('Runite ore');
		}
		if (loot.has('Adamantite ore')) {
			cleaningXP += 45 * loot.amount('Adamantite ore');
		}
		if (loot.has('Mithril ore')) {
			cleaningXP += 30 * loot.amount('Mithril ore');
		}
		if (loot.has('Gold ore')) {
			cleaningXP += 15 * loot.amount('Gold ore');
		}
		xpReceived += cleaningXP;

		const xpRes = await user.addXP({
			skillName: 'mining',
			amount: xpReceived,
			duration,
			source: 'MotherlodeMine'
		});

		let str = `${user}, ${user.minionName} finished mining ${quantity} Pay-dirt. ${xpRes}`;

		const { petDropRate } = skillingPetDropRate(user, 'mining', Mining.MotherlodeMine.petChance!);
		if (rng.roll(Math.ceil(petDropRate / quantity))) {
			loot.add('Rock golem');
		}

		if (duration >= MIN_LENGTH_FOR_PET) {
			const minutesInTrip = Math.ceil(duration / Time.Minute);
			const droprate = clAdjustedDroprate(
				user,
				'Doug',
				globalDroprates.doug.baseRate,
				globalDroprates.doug.clIncrease
			);
			for (let i = 0; i < minutesInTrip; i++) {
				if (rng.roll(droprate)) {
					loot.add('Doug');
					str +=
						'\n' +
						customEmoji('doug') +
						" A pink-colored mole emerges from where you're mining, and decides to join you on your adventures after seeing your groundbreaking new methods of mining.";
					break;
				}
			}
		}

		str += `\n\nYou received: ${loot}.`;

		if (user.hasEquippedOrInBank('Mining master cape')) {
			str += '\n2x nuggets for Mining master cape.';
		}

		await user.transactItems({
			collectionLog: true,
			itemsToAdd: loot
		});

		handleTripFinish({ user, channelId, message: str, data, loot });
	}
};
