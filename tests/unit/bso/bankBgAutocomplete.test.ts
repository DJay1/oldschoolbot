import { Bank } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { sortBankBgsForAutocomplete } from '@/lib/bsc/bankBgAutocomplete.js';
import backgroundImages from '@/lib/minions/data/bankBackgrounds.js';

const available = backgroundImages.filter(bg => bg.available && !(bg.owners && bg.owners.length > 0));

describe('bank background autocomplete order', () => {
	test('there are more than 25 backgrounds, so order matters', () => {
		expect(available.length).toBeGreaterThan(25);
	});

	test('Going Merry backgrounds are in the first 25 even with nothing unlocked', () => {
		const top = sortBankBgsForAutocomplete(available, { ownedIDs: [], cl: new Bank() }).slice(0, 25);
		expect(top.map(bg => bg.id)).toEqual(expect.arrayContaining([1029, 1030]));
	});

	test('unlocked through the collection log comes right after owned ones', () => {
		const merry = available.find(bg => bg.id === 1029)!;
		const cl = new Bank(merry.collectionLogItemsNeeded!);
		const sorted = sortBankBgsForAutocomplete(available, { ownedIDs: [1], currentID: 1, cl });
		expect(sorted[0].id).toBe(1);
		expect(sorted.slice(1, 3).map(bg => bg.id)).toEqual([1029, 1030]);
	});

	test('typed text matches anywhere in the name', () => {
		for (const value of ['merry', 'going', 'MERRY', ' storm ']) {
			const sorted = sortBankBgsForAutocomplete(available, { value, ownedIDs: [], cl: new Bank() });
			expect(sorted.some(bg => bg.id === 1029 || bg.id === 1030)).toBe(true);
			expect(sorted.every(bg => bg.name.toLowerCase().includes(value.trim().toLowerCase()))).toBe(true);
		}
	});
});
