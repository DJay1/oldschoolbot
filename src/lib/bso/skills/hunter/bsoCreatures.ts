import { MysteryBoxes } from '@/lib/bso/openables/tables.js';

import { Bank, LootTable } from 'oldschooljs';

import { VampyriumItem } from '@/lib/customItems/bloodMoon.js';
import { Slayer2026Item } from '@/lib/customItems/slayer2026.js';
import { type Creature, HunterTechniqueEnum } from '@/lib/skilling/types.js';

export const VAMPYRIUM_CREATURE_IDS = [940_101, 940_102];

export const bsoCreatures: Creature[] = [
	{
		name: 'Letvek',
		id: 940_101,
		aliases: ['letvek', 'letveks'],
		level: 76,
		hunterXP: 200,
		table: new LootTable().every(Slayer2026Item.LETVEK),
		huntTechnique: HunterTechniqueEnum.BoxTrapping,
		multiTraps: true,
		catchTime: 25,
		slope: 1.22,
		intercept: -31.33
	},
	{
		name: 'Stymphike',
		id: 940_102,
		aliases: ['stymphike', 'stymphikes'],
		level: 82,
		hunterXP: 1725,
		table: new LootTable()
			.every(Slayer2026Item.STYMPHIKE_FEATHER, 15)
			.every('Bones')
			.every(VampyriumItem.STYMPHIKE_CARCASS),
		huntTechnique: HunterTechniqueEnum.Tracking,
		catchTime: 43,
		slope: 0,
		intercept: 99,
		bait: qty => new Bank().add(Slayer2026Item.LETVEK, qty)
	},
	{
		name: 'Sand Gecko',
		id: 3251,
		aliases: ['sand gecko'],
		level: 120,
		hunterXP: 2100,
		table: new LootTable()
			.tertiary(8, MysteryBoxes)
			.tertiary(200, 'Clue scroll (grandmaster)')
			.tertiary(5, 'Sand')
			.tertiary(10, 'Sandworms', [2, 20]),
		qpRequired: 3,
		huntTechnique: HunterTechniqueEnum.Tracking,
		catchTime: 91,
		slope: 0,
		intercept: 99,
		bait: qty => {
			const req = new Bank();
			const kibbleRequired = Math.ceil(qty / 8);
			req.add('Simple kibble', kibbleRequired);
			return req;
		}
	},
	{
		name: 'Eastern ferret',
		id: 91_938,
		aliases: ['eastern ferret'],
		level: 96,
		hunterXP: 2100,
		table: new LootTable().every('Eastern ferret'),
		qpRequired: 600,
		huntTechnique: HunterTechniqueEnum.Tracking,
		catchTime: 350,
		slope: 0,
		intercept: 99,
		bait: qty => {
			const req = new Bank();
			const kibbleRequired = Math.ceil(qty / 2);
			req.add('Delicious kibble', kibbleRequired);
			return req;
		}
	},
	{
		name: 'Chimpchompa',
		id: 63_204,
		aliases: ['chimpchompa'],
		level: 99,
		hunterXP: 300,
		table: new LootTable().every('Chimpchompa'),
		huntTechnique: HunterTechniqueEnum.BoxTrapping,
		multiTraps: true,
		wildy: false,
		prayerLvl: 43,
		catchTime: 200,
		qpRequired: 2,
		slope: 1.22,
		intercept: -31.33,
		bait: qty => {
			return new Bank().add('Banana', qty);
		}
	}
];
