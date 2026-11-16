import { Bank } from 'oldschooljs';

import { TfaItem } from '@/lib/bsc/tfa/tfaItems.js';
import type { Fletchable } from '@/lib/skilling/types.js';

/**
 * The Fractured Archive bolts (OSRS: chisel 1 Ascension shards into 10 bolts at 86 Fletching for 140 XP,
 * then tip 10 at a time with Diamond or Onyx bolt tips). Not in the Fletching collection log
 * (OSRS doesn't log them).
 */
export const AscensionBolts: Fletchable = {
	name: 'Ascension bolts',
	id: TfaItem.ASCENSION_BOLTS,
	level: 86,
	xp: 140,
	inputItems: new Bank().add(TfaItem.ASCENSION_SHARDS),
	tickRate: 2,
	outputMultiple: 10
};

export const TippedAscensionBolts: Fletchable[] = [
	{
		name: 'Diamond ascension bolts',
		id: TfaItem.DIAMOND_ASCENSION_BOLTS,
		level: 86,
		xp: 7,
		inputItems: new Bank().add(TfaItem.ASCENSION_BOLTS).add('Diamond bolt tips'),
		tickRate: 0.2
	},
	{
		name: 'Onyx ascension bolts',
		id: TfaItem.ONYX_ASCENSION_BOLTS,
		level: 86,
		xp: 9.4,
		inputItems: new Bank().add(TfaItem.ASCENSION_BOLTS).add('Onyx bolt tips'),
		tickRate: 0.2
	}
];

export const AscensionFletchables: Fletchable[] = [AscensionBolts, ...TippedAscensionBolts];
