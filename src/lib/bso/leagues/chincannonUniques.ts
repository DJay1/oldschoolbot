import { type Bank, ItemGroups } from 'oldschooljs';

import { tfaPurpleItems } from '@/lib/bsc/tfa/tfaItems.js';
import { chambersOfXericCL, theatreOfBLoodCL } from '@/lib/data/CollectionsExport.js';

/**
 * Raid items that count as "unique" for the Chincannon leagues task: the CoX, ToB and ToA collection logs, plus
 * The Fractured Archive's purples (its 5 uniques and Orion; not shards, records or fragments, which are common loot).
 */
export const chincannonLeaguesUniques: readonly number[] = [
	...chambersOfXericCL,
	...theatreOfBLoodCL,
	...ItemGroups.toaCL,
	...tfaPurpleItems
];

/** How many different unique items are in a Chincannon destroyed-loot bank. */
export function chincannonDestroyedUniqueCount(destroyed: Bank): number {
	return destroyed.items().filter(([item]) => chincannonLeaguesUniques.includes(item.id)).length;
}
