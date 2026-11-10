import { Bank } from 'oldschooljs';

import { SEEKING_ARROWS, SeekingFletchItem } from '@/lib/customItems/bloodMoon.js';
import { QuestID } from '@/lib/minions/data/quests.js';
import type { Fletchable } from '@/lib/skilling/types.js';
import Arrows from './arrows.js';
import { BroadArrows } from './slayer.js';

const baseArrows = [...Arrows, BroadArrows];

const seekingArrows: Fletchable[] = SEEKING_ARROWS.map(arrow => {
	const base = baseArrows.find(f => f.name === arrow.base)!;
	const tips = new Bank(base.inputItems).remove('Headless arrow', 1);
	return {
		...base,
		name: arrow.name,
		id: arrow.id,
		inputItems: tips.add(SeekingFletchItem.SEEKING_HEADLESS_ARROW),
		requiredQuests: [QuestID.TheBloodMoonRises]
	};
});

export const SeekingFletchables: Fletchable[] = [
	{
		name: 'Seeking arrow shaft',
		id: SeekingFletchItem.SEEKING_ARROW_SHAFT,
		level: 90,
		xp: 35,
		inputItems: new Bank().add(SeekingFletchItem.SAP_TREATED_REDWOOD_LOGS),
		tickRate: 2,
		outputMultiple: 105,
		requiredQuests: [QuestID.TheBloodMoonRises]
	},
	{
		name: 'Seeking headless arrow',
		id: SeekingFletchItem.SEEKING_HEADLESS_ARROW,
		level: 1,
		xp: 1,
		inputItems: new Bank().add(SeekingFletchItem.SEEKING_ARROW_SHAFT).add('Feather'),
		tickRate: 0.13,
		requiredQuests: [QuestID.TheBloodMoonRises]
	},
	...seekingArrows
];
