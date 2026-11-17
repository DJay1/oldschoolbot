import { Bank } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { MAX_CAPE_TOTAL_LEVEL } from '@/lib/data/creatables/capes.js';
import createables from '@/lib/data/createables.js';

const capes = [
	'Ardougne max cape',
	'Infernal max cape',
	'Assembler max cape',
	'Imbued guthix max cape',
	'Imbued saradomin max cape',
	'Imbued zamorak max cape',
	'Mythical max cape',
	'Fire max cape',
	'Masori assembler max cape',
	"Dizana's max cape"
];

const find = (name: string) => {
	const matches = createables.filter(c => c.name === name);
	expect(matches, name).toHaveLength(1);
	return matches[0];
};

describe('max cape reverts', () => {
	test.each(capes)('%s: revert gives back exactly what creating it used', name => {
		const create = find(name);
		const revert = find(`Revert ${name}`);
		expect(new Bank(revert.inputItems as Bank).equals(new Bank(create.outputItems as Bank))).toBe(true);
		expect(new Bank(revert.outputItems as Bank).equals(new Bank(create.inputItems as Bank))).toBe(true);
		expect(revert.noCl).toBe(true);
		expect(revert.GPCost ?? 0).toBe(0);
	});

	test('reverting needs a maxed account', async () => {
		const revert = find('Revert Infernal max cape');
		expect(await revert.customReq!({ totalLevel: MAX_CAPE_TOTAL_LEVEL - 1 } as MUser)).toContain('maxed');
		expect(await revert.customReq!({ totalLevel: MAX_CAPE_TOTAL_LEVEL } as MUser)).toBeNull();
	});
});
