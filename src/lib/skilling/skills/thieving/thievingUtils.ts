import { isAffinityActive } from '@/lib/bso/firstAge/affinities.js';

import { ItemGroups } from 'oldschooljs';

export function rogueOutfitPercentBonus(user: MUser): number {
	if (isAffinityActive(user.gearBank, 'rogue')) return ItemGroups.rogueOutfit.length * 20;
	const skillingSetup = user.gear.skilling;
	let amountEquipped = 0;
	for (const id of ItemGroups.rogueOutfit) {
		if (skillingSetup.hasEquipped([id])) {
			amountEquipped++;
		}
	}
	return amountEquipped * 20;
}
