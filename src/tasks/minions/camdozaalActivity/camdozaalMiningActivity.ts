import { Bank, LootTable } from 'oldschooljs';

import addSkillingClueToLoot from '@/lib/minions/functions/addSkillingClueToLoot.js';
import Mining from '@/lib/skilling/skills/mining.js';
import type { ActivityTaskOptionsWithQuantity } from '@/lib/types/minions.js';
import { makeBankImage } from '@/lib/util/makeBankImage.js';
import { skillingPetDropRate } from '@/lib/util.js';

export const camdozaalMiningTask: MinionTask = {
	type: 'CamdozaalMining',
	async run(data: ActivityTaskOptionsWithQuantity, { user, handleTripFinish, rng }) {
		const { quantity, channelId, duration } = data;

		// amulet of glory check for mining
		let barroniteGems = 256;
		if (user.hasEquipped('amulet of glory')) {
			barroniteGems = 86;
		}

		// Barronite rock loot table
		const barroniteTable = new LootTable()
			.add('Barronite shards', [4, 6], 76)
			.add('Barronite deposit', 1, 24)
			.tertiary(
				barroniteGems,
				new LootTable()
					.add('Uncut sapphire', 0, 70)
					.add('Uncut sapphire', 1, 32)
					.add('Uncut emerald', 1, 16)
					.add('Uncut ruby', 1, 8)
					.add('Uncut diamond', 1, 8)
			);

		let barroniteShardMined = 0;
		let barroniteDepositMined = 0;

		// Count loot received during trip
		const loot = new Bank();

		for (let i = 0; i < quantity; i++) {
			const barroniteMined = barroniteTable.roll();
			if (barroniteMined.has('Barronite shards')) {
				barroniteShardMined++;
				loot.add(barroniteMined);
			} else if (barroniteMined.has('Barronite deposit')) {
				barroniteDepositMined++;
				loot.add(barroniteMined);
			}
		}

		// Add up the xp from the trip
		const miningXpReceived =
			barroniteShardMined * Mining.CamdozaalMine.xp + barroniteDepositMined * Mining.CamdozaalMine.xp * 2;

		// Add xp to user
		const xpRes = await user.addXP({
			skillName: 'mining',
			amount: miningXpReceived,
			duration,
			source: 'CamdozaalMining'
		});

		// Trip finish message
		const str = `${user}, ${user.minionName} finished mining in Camdozaal! ${xpRes}`;

		// Add clue scrolls
		const clueScrollChance = Mining.CamdozaalMine.clueScrollChance!;
		addSkillingClueToLoot(rng, user, 'fishing', quantity, clueScrollChance, loot);

		// Rock golem roll
		const { petDropRate } = skillingPetDropRate(user, 'mining', Mining.CamdozaalMine.petChance!);
		if (rng.roll(Math.ceil(petDropRate / quantity))) {
			loot.add('Rock golem');
		}

		// Give the user the items from the trip
		const { previousCL, itemsAdded } = await user.transactItems({
			collectionLog: true,
			itemsToAdd: loot
		});

		// BankImage to show the user their loot
		const image = await makeBankImage({
			bank: itemsAdded,
			title: `Loot From ${quantity}x Barronite rocks`,
			user,
			previousCL
		});

		handleTripFinish({ user, channelId, message: { content: str, files: [image] }, data, loot });
	}
};
