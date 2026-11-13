import { Bank } from 'oldschooljs';

import { setCustomItem } from '@/lib/customItems/util.js';
import type { Consumable } from '@/lib/minions/types.js';

export const CoralPotionItem = {
	RAINBOW_CRAB: 74_450,
	SUPER_FISHING_POTION: [74_451, 74_452, 74_453, 74_454],
	SUPER_HUNTER_POTION: [74_455, 74_456, 74_457, 74_458],
	ARMADYL_BREW: [74_459, 74_460, 74_461, 74_462]
} as const;

const tradeable = {
	tradeable: true,
	tradeable_on_ge: true,
	customItemData: { cantDropFromMysteryBoxes: true }
};

setCustomItem(CoralPotionItem.RAINBOW_CRAB, 'Rainbow crab', 'Red crab', tradeable, 2_000);

const potionSets: [ids: readonly number[], name: string, base: string, price: number][] = [
	[CoralPotionItem.SUPER_FISHING_POTION, 'Super fishing potion', 'Fishing potion', 2_500],
	[CoralPotionItem.SUPER_HUNTER_POTION, 'Super hunter potion', 'Hunter potion', 3_000],
	[CoralPotionItem.ARMADYL_BREW, 'Armadyl brew', 'Ranging potion', 6_000]
];

for (const [ids, name, base, price] of potionSets) {
	ids.forEach((id, i) => {
		const doses = i + 1;
		setCustomItem(id, `${name}(${doses})`, `${base}(${doses})`, tradeable, Math.round((price * doses) / 4));
	});
}

export function armadylBrewBoost(): Consumable {
	return {
		itemCost: new Bank().add(CoralPotionItem.ARMADYL_BREW[3]),
		qtyPerMinute: 0.125,
		boostPercent: 6,
		optional: true
	};
}
