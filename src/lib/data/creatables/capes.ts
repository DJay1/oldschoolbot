import { Bank } from 'oldschooljs';

import type { Createable } from '@/lib/data/createables.js';

const maxCapeCreatables: Createable[] = [
	{
		name: 'Ardougne max cape',
		inputItems: new Bank({
			'Max hood': 1,
			'Max cape': 1
		}),
		outputItems: new Bank({
			'Ardougne max hood': 1,
			'Ardougne max cape': 1
		})
	},
	{
		name: 'Infernal max cape',
		inputItems: new Bank({
			'Max hood': 1,
			'Max cape': 1
		}),
		outputItems: new Bank({
			'Infernal max hood': 1,
			'Infernal max cape': 1
		})
	},
	{
		name: 'Assembler max cape',
		inputItems: new Bank({
			'Max hood': 1,
			'Max cape': 1
		}),
		outputItems: new Bank({
			'Assembler max hood': 1,
			'Assembler max cape': 1
		})
	},
	{
		name: 'Imbued guthix max cape',
		inputItems: new Bank({
			'Max hood': 1,
			'Max cape': 1
		}),
		outputItems: new Bank({
			'Imbued guthix max hood': 1,
			'Imbued guthix max cape': 1
		})
	},
	{
		name: 'Imbued saradomin max cape',
		inputItems: new Bank({
			'Max hood': 1,
			'Max cape': 1
		}),
		outputItems: new Bank({
			'Imbued saradomin max hood': 1,
			'Imbued saradomin max cape': 1
		})
	},
	{
		name: 'Imbued zamorak max cape',
		inputItems: new Bank({
			'Max hood': 1,
			'Max cape': 1
		}),
		outputItems: new Bank({
			'Imbued zamorak max hood': 1,
			'Imbued zamorak max cape': 1
		})
	},
	{
		name: 'Mythical max cape',
		inputItems: new Bank({
			'Max hood': 1,
			'Max cape': 1,
			'Mythical cape': 1
		}),
		outputItems: new Bank({
			'Mythical max hood': 1,
			'Mythical max cape': 1
		})
	},
	{
		name: 'Fire max cape',
		inputItems: new Bank({
			'Max hood': 1,
			'Max cape': 1,
			'Fire cape': 1
		}),
		outputItems: new Bank({
			'Fire max hood': 1,
			'Fire max cape': 1
		})
	},
	{
		name: 'Masori assembler max cape',
		inputItems: new Bank({
			'Max hood': 1,
			'Max cape': 1,
			'Masori assembler': 1
		}),
		outputItems: new Bank({
			'Masori assembler max cape': 1,
			'Masori assembler max hood': 1
		})
	}
];

/** Total level needed to buy a Max cape, also needed to revert a max cape. */
export const MAX_CAPE_TOTAL_LEVEL = 2277;

/**
 * Revert a max cape variant back into exactly what creating it used (the max cape and hood, plus the Fire cape,
 * Mythical cape, etc. where creating it took one). Needs the same total level as buying a Max cape.
 */
export function makeMaxCapeRevert(create: Createable): Createable {
	return {
		name: `Revert ${create.name}`,
		inputItems: create.outputItems,
		outputItems: create.inputItems,
		noCl: true,
		customReq: async user =>
			user.totalLevel < MAX_CAPE_TOTAL_LEVEL
				? `You need to be maxed (${MAX_CAPE_TOTAL_LEVEL} total level) to revert a max cape.`
				: null
	};
}

export const capeCreatables: Createable[] = [...maxCapeCreatables, ...maxCapeCreatables.map(makeMaxCapeRevert)];
