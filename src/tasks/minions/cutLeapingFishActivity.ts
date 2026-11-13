import { Bank } from 'oldschooljs';
import { clamp } from 'remeda';

import { VampyriumItem } from '@/lib/customItems/bloodMoon.js';
import { Slayer2026Item } from '@/lib/customItems/slayer2026.js';
import { LeapingFish } from '@/lib/skilling/skills/cooking/leapingFish.js';
import type { CutLeapingFishActivityTaskOptions } from '@/lib/types/minions.js';

export const cutLeapingFishTask: MinionTask = {
	type: 'CutLeapingFish',
	async run(data: CutLeapingFishActivityTaskOptions, { user, handleTripFinish, rng }) {
		const { fishID, channelId, quantity, duration } = data;

		const barbarianFish = LeapingFish.find(LeapingFish => LeapingFish.item.id === fishID)!;

		const currentLevel = user.skillsAsLevels.cooking;
		let caviarChance = 0;
		let caviarCreated = 0;
		let roeChance = 0;
		let roeCreated = 0;
		let fishOffcutsChance = 0;
		let fishOffcutsCreated = 0;

		if (barbarianFish.item.name === 'Leaping sturgeon') {
			caviarChance = clamp(1.25 * currentLevel, { min: 0, max: 100 });
			fishOffcutsChance = (5 / 6) * 100;
			for (let i = 0; i < quantity; i++) {
				if (rng.percentChance(caviarChance)) {
					caviarCreated += 1;
					if (rng.percentChance(fishOffcutsChance)) {
						fishOffcutsCreated += 1;
					}
				}
			}
		}
		if (barbarianFish.item.name === 'Leaping salmon') {
			roeChance = clamp(1.25 * currentLevel, { min: 0, max: 100 });
			fishOffcutsChance = (3 / 4) * 100;
			for (let i = 0; i < quantity; i++) {
				if (rng.percentChance(roeChance)) {
					roeCreated += 1;
					if (rng.percentChance(fishOffcutsChance)) {
						fishOffcutsCreated += 1;
					}
				}
			}
		}

		if (barbarianFish.item.name === 'Leaping trout') {
			roeChance = clamp(0.67 * currentLevel, { min: 0, max: 100 });
			fishOffcutsChance = (1 / 2) * 100;
			for (let i = 0; i < quantity; i++) {
				if (rng.percentChance(roeChance)) {
					roeCreated += 1;
					if (rng.percentChance(fishOffcutsChance)) {
						fishOffcutsCreated += 1;
					}
				}
			}
		}

		let leechfinXP = 0;
		const loot = new Bank();
		if (barbarianFish.item.id === VampyriumItem.LEECHFIN) {
			leechfinXP = 20 * quantity;
			for (let i = 0; i < quantity; i++) {
				if (rng.roll(3)) loot.add(Slayer2026Item.BLOOD_SAC);
			}
		}

		if (barbarianFish.item.name === 'Raw haddock') {
			const eyeChance = clamp(19.9 + ((currentLevel - 1) * 80.1) / 98, { min: 0, max: 100 });
			loot.add('Fine fish offcuts', quantity);
			for (let i = 0; i < quantity; i++) {
				if (rng.percentChance(eyeChance)) loot.add('Haddock eye');
			}
		}

		loot.add('Roe', roeCreated);
		loot.add('Caviar', caviarCreated);
		loot.add('Fish offcuts', fishOffcutsCreated);

		let xpReceived = leechfinXP;
		xpReceived += 10 * roeCreated;
		xpReceived += 15 * caviarCreated;

		const xpRes = await user.addXP({
			skillName: 'cooking',
			amount: xpReceived,
			duration
		});

		const str = `${user}, ${user.minionName} finished cutting ${quantity}x ${barbarianFish.item.name}. ${xpRes}\n\n You received: ${loot}.`;

		await user.transactItems({
			collectionLog: true,
			itemsToAdd: loot
		});

		handleTripFinish({ user, channelId, message: str, data, loot });
	}
};
