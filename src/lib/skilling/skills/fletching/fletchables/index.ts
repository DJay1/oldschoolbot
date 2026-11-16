import type { Fletchable } from '@/lib/skilling/types.js';
import Arrows from './arrows.js';
import { AscensionFletchables, TippedAscensionBolts } from './ascension.js';
import Atlatl from './atlatl.js';
import Bolts from './bolts.js';
import Bows from './bows.js';
import Crossbows from './crossbows.js';
import Darts from './darts.js';
import Javelins from './javelins.js';
import { SeekingFletchables } from './seeking.js';
import Shafts from './shafts.js';
import Shields from './shields.js';
import { AmethystBroadBolts, BroadArrows, BroadBolts, Slayer } from './slayer.js';
import TippedBolts from './tippedBolts.js';
import TippedDragonBolts from './tippedDragonBolts.js';
import Tips from './tips.js';

export const Fletchables: Fletchable[] = [
	...Bows,
	...Shafts,
	...Shields,
	...Arrows,
	...Bolts,
	...Tips,
	...TippedDragonBolts,
	...TippedBolts,
	...Javelins,
	...Darts,
	...Crossbows,
	...Slayer,
	...Atlatl,
	...SeekingFletchables,
	...AscensionFletchables
];

// Seeking arrows and Ascension bolts aren't in the Fletching collection log.
const seekingIDs = new Set([...SeekingFletchables, ...AscensionFletchables].map(i => i.id));
export const fletchingCL = Fletchables.filter(i => !seekingIDs.has(i.id)).map(i => i.id);
export const zeroTimeFletchables: Fletchable[] = [
	BroadArrows,
	BroadBolts,
	...Darts,
	...Arrows,
	...Bolts,
	AmethystBroadBolts,
	...TippedBolts,
	...TippedDragonBolts,
	...Javelins,
	...TippedAscensionBolts
];
