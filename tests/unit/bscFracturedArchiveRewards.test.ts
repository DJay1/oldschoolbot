import { Items } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { TfaItem, tfaAnnouncedItems, tfaCL, tfaUniqueItems } from '@/lib/bsc/tfa/tfaItems.js';
import { allItemsThatCanBeDisassembledIDs } from '@/lib/bso/skills/invention/index.js';
import { mysteryBoxBlacklist } from '@/lib/bso/openables/mysteryBoxBlacklist.js';
import { allPetsCL } from '@/lib/data/CollectionsExport.js';

describe('The Fractured Archive rewards match the other raids', () => {
	test('no TFA item can come out of a mystery box (like CoX/ToB/ToA/DoA)', () => {
		const ids = [...tfaCL, ...Object.values(TfaItem)];
		for (const id of ids) expect(mysteryBoxBlacklist, Items.itemNameFromId(id)).toContain(id);
	});

	test('Orion is a normal pet (pet mystery box table, like Olmlet/Lil Zik/Tumeken guardian)', () => {
		expect(allPetsCL).toContain(TfaItem.ORION);
	});

	test('uniques are valued at OSRS GE prices like other raid uniques', () => {
		const p = (id: number) => Items.getOrThrow(id).price;
		expect(p(TfaItem.RONDACHE)).toBe(13_000_000);
		expect(p(TfaItem.ZORYAS_TOME)).toBe(28_000_000);
		expect(p(TfaItem.HORN_OF_BRAN)).toBe(247_000_000);
		expect(p(TfaItem.ASCENSION_CROSSBOWS)).toBe(233_000_000);
		expect(p(TfaItem.OBLIGATOR)).toBe(2_147_483_647);
		for (const id of tfaUniqueItems) expect(Items.getOrThrow(id).tradeable).toBe(true);
	});

	test('uniques and pet are announced, and gear uniques can be disassembled', () => {
		for (const id of [...tfaUniqueItems, TfaItem.ORION]) expect(tfaAnnouncedItems).toContain(id);
		for (const id of [TfaItem.RONDACHE, TfaItem.ZORYAS_TOME, TfaItem.ASCENSION_CROSSBOWS, TfaItem.OBLIGATOR]) {
			expect(allItemsThatCanBeDisassembledIDs.has(id), Items.itemNameFromId(id)).toBe(true);
		}
	});
});