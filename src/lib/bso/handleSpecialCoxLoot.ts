import { clAdjustedDroprate } from '@/lib/bso/bsoUtil.js';
import { globalDroprates } from '@/lib/bso/globalDroprates.js';

import { roll } from 'node-rng';
import type { Bank } from 'oldschooljs';
import { launchPetRate } from '@/lib/util.js';

// user is null if tame is killing
export function handleSpecialCoxLoot(user: MUser | null, loot: Bank) {
	const takonDropRate = user
		? clAdjustedDroprate(user, 'Takon', globalDroprates.takon.baseRate, globalDroprates.takon.clIncrease)
		: globalDroprates.takon.tameBaseRate!;
	if (roll(launchPetRate(takonDropRate))) {
		loot.add('Takon');
	}
	const steveDropRate = user
		? clAdjustedDroprate(user, 'Steve', globalDroprates.steve.baseRate, globalDroprates.steve.clIncrease)
		: globalDroprates.steve.tameBaseRate!;
	if (roll(launchPetRate(steveDropRate))) {
		loot.add('Steve');
	}
	if (roll(140)) {
		loot.add('Clue scroll (grandmaster)');
	}
}
