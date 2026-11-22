import { MysteryBoxes } from '@/lib/bso/openables/tables.js';

import { roll } from 'node-rng';
import { Bank } from 'oldschooljs';

import {
	LABOON_EXTRA_FISH_MULTIPLIER,
	rollLaboonFromFishingTrip,
	usingLaboonPet
} from '@/lib/events/thanksgiving/core.js';
import { fishingTrawlerLoot } from '@/lib/simulation/fishingTrawler.js';
import type { ActivityTaskOptionsWithQuantity } from '@/lib/types/minions.js';
import { makeBankImage } from '@/lib/util/makeBankImage.js';

export const trawlerTask: MinionTask = {
	type: 'FishingTrawler',
	async run(data: ActivityTaskOptionsWithQuantity, { user, handleTripFinish, rng }) {
		const { channelId, quantity } = data;
		await user.incrementMinigameScore('fishing_trawler', quantity);

		const loot = new Bank();

		let totalXP = 0;
		const hasEliteArdy = user.hasDiary('ardougne.elite');
		for (let i = 0; i < quantity; i++) {
			const { loot: _loot, xp } = fishingTrawlerLoot({
				fishingLevel: user.skillsAsLevels.fishing,
				hasEliteArd: hasEliteArdy,
				bank: loot.clone().add(user.allItemsOwned),
				rng
			});
			totalXP += xp;
			loot.add(_loot);
		}

		let str = `${user}, ${user.minionName} finished completing the Fishing Trawler ${quantity}x times.`;

		if (user.usingPet('Shelldon')) {
			loot.multiply(2);
			totalXP *= 1.5;
			str += '\nYou received **2x** extra fish from Shelldon helping you.';
		}
		if (usingLaboonPet(user)) {
			// Fish only, so trawler outfit pieces and junk are not multiplied.
			for (const [item, qty] of loot.items()) {
				if (!item.name.startsWith('Raw ')) continue;
				const extra = Math.floor(qty * LABOON_EXTRA_FISH_MULTIPLIER) - qty;
				if (extra > 0) loot.add(item.id, extra);
			}
			totalXP *= 1.5;
			str += `\nYou received **${LABOON_EXTRA_FISH_MULTIPLIER}x** fish from Laboon helping you.`;
		}

		str += await user.addXP({
			skillName: 'fishing',
			amount: totalXP,
			duration: data.duration
		});

		if (hasEliteArdy) str += '\n\n50% Extra fish for Ardougne Elite diary';

		if (user.hasEquippedOrInBank('Fishing master cape')) {
			loot.multiply(4);
			for (let i = 0; i < quantity; i++) {
				if (roll(2)) loot.add(MysteryBoxes.roll());
			}
			str += '\n\nYou received **4x** extra fish because you are a master at Fishing.';
		}

		const laboonMsg = rollLaboonFromFishingTrip(rng, data.duration, loot);
		if (laboonMsg) str += `\n${laboonMsg}`;

		const { previousCL, itemsAdded } = await user.transactItems({
			collectionLog: true,
			itemsToAdd: loot
		});

		const image = await makeBankImage({
			bank: itemsAdded,
			title: `Loot From ${quantity}x Fishing Trawler`,
			user,
			previousCL
		});

		handleTripFinish({ user, channelId, message: { content: str, files: [image] }, data, loot: itemsAdded });
	}
};
