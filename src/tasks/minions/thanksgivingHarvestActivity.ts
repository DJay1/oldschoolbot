import { isDoubleLootActive } from '@/lib/bso/doubleLoot.js';

import {
	hasHarvestBlessing,
	isThanksgivingActive,
	rollThanksgivingHarvestParts,
	THANKSGIVING_HARVEST_ACTIVITY,
	thanksgivingHarvestPartName
} from '@/lib/events/thanksgiving/core.js';
import type { ThanksgivingHarvestOptions } from '@/lib/types/minions.js';

/** Straw Hat Harvest focused trip. Stored as the retired TrickOrTreat type; old data without the tag pays nothing. */
export const thanksgivingHarvestTask: MinionTask = {
	type: THANKSGIVING_HARVEST_ACTIVITY,
	async run(data: ThanksgivingHarvestOptions, { user, handleTripFinish, rng }) {
		const { channelId, duration, focus } = data;
		if (!data.thanksgivingHarvest || (focus !== 'bundles' && focus !== 'baskets')) {
			return handleTripFinish({
				user,
				channelId,
				message: `${user}, ${user.minionName} finished their trip.`,
				data,
				loot: null
			});
		}
		const partName = thanksgivingHarvestPartName(focus);
		if (!isThanksgivingActive()) {
			return handleTripFinish({
				user,
				channelId,
				message: `${user}, ${user.minionName} finished gathering, but The Straw Hat Harvest has ended, so no ${partName} were found.`,
				data,
				loot: null
			});
		}
		const doubleLoot = isDoubleLootActive(duration);
		const parts = rollThanksgivingHarvestParts({
			durationMs: duration,
			focus,
			doubleLoot,
			blessing: hasHarvestBlessing(user),
			rng
		});
		if (parts.length > 0) {
			await user.transactItems({ itemsToAdd: parts, collectionLog: true });
		}
		const got = parts.length > 0 ? `${parts}` : `no ${partName} this time`;
		const extras = [
			doubleLoot ? '2x from Double Loot' : null,
			hasHarvestBlessing(user) ? '+15% Harvest Blessing' : null
		]
			.filter(Boolean)
			.join(', ');
		// loot: null, so Mystery box loot doubling and the Harvest feast never copy event parts (same as normal trips).
		return handleTripFinish({
			user,
			channelId,
			message: `${user}, ${user.minionName} finished gathering ${partName} for The Straw Hat Harvest and found ${got}.${extras ? ` (${extras})` : ''}`,
			data,
			loot: null
		});
	}
};
