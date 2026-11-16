import { Bank } from 'oldschooljs';

import type { Buyable } from '@/lib/data/buyables/buyables.js';

/** Flakes 'n' Flotsam: the Spirit Angler's shop at the Tempoross reward pool. One of each, only if not owned. */
export const temporossBuyables: Buyable[] = (['Fish barrel', 'Tackle box'] as const).map(name => ({
	name,
	itemCost: new Bank().add('Spirit flakes', 6000),
	outputItems: new Bank().add(name),
	maxQuantity: 1,
	customReq: async user => {
		if (user.allItemsOwned.has(name)) {
			return [false, `You already own a ${name}.`];
		}
		return [true];
	}
}));
