import { isWearingFullFirstAgeMaxSet } from '@/lib/bso/firstAge/shards.js';

import { ItemGroups } from 'oldschooljs';

export function rogueOutfitPercentBonus(user: MUser): number {
	const skillingSetup = user.gear.skilling;
	let amountEquipped = 0;
	for (const id of ItemGroups.rogueOutfit) {
		if (skillingSetup.hasEquipped([id])) {
			amountEquipped++;
		}
	}
	if (isWearingFullFirstAgeMaxSet(user)) {
		return Math.max(amountEquipped, ItemGroups.rogueOutfit.length) * 20;
	}
	return amountEquipped * 20;
}
