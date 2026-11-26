import { keyCrates } from '@/lib/bso/keyCrates.js';

import type { Buyable } from '@/lib/data/buyables/buyables.js';

export const keyCrateBuyables: Buyable[] = [];

for (const crate of keyCrates) {
	// Supply crate key is no longer sold on /buy. Other seasonal crate keys stay listed.
	if (crate.key.name === 'Supply crate key (s1)') continue;
	keyCrateBuyables.push({
		name: crate.key.name,
		gpCost: crate.keyCostGP,
		ironmanPrice: Math.floor(crate.keyCostGP / 10)
	});
}
