import '../../src/lib/util/clientSettings.js';

import { chincannonDestroyedUniqueCount, chincannonLeaguesUniques } from '@/lib/bso/leagues/chincannonUniques.js';

import { Bank, ItemGroups } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { TfaItem, tfaPurpleItems } from '@/lib/bsc/tfa/tfaItems.js';
import { chambersOfXericCL, theatreOfBLoodCL } from '@/lib/data/CollectionsExport.js';

describe('Leagues: uniques destroyed by the Chincannon', () => {
	test('still counts CoX, ToB and ToA, and now TFA purples', () => {
		for (const id of [...chambersOfXericCL, ...theatreOfBLoodCL, ...ItemGroups.toaCL, ...tfaPurpleItems]) {
			expect(chincannonLeaguesUniques.includes(id)).toBe(true);
		}
	});

	test('TFA uniques and Orion count; shards, records and fragments do not', () => {
		const bank = new Bank()
			.add(TfaItem.OBLIGATOR)
			.add(TfaItem.ZORYAS_TOME, 2)
			.add(TfaItem.ORION)
			.add(TfaItem.ASCENSION_SHARDS, 500)
			.add(TfaItem.LIVING_RECORD_T1)
			.add(TfaItem.FRAGMENT_EARTH);
		expect(chincannonDestroyedUniqueCount(bank)).toBe(3);
	});

	test('task name matches its requirement (5 different uniques)', async () => {
		const { mediumTasks } = await import('@/lib/bso/leagues/mediumTasks.js');
		const task = mediumTasks.find(t => t.id === 1153)!;
		expect(task.name).toBe('Have 5 unique items destroyed by the Chincannon');
		const uniques = [TfaItem.RONDACHE, TfaItem.ZORYAS_TOME, TfaItem.HORN_OF_BRAN, TfaItem.OBLIGATOR, TfaItem.ORION];
		const has = (ids: number[]) =>
			task.has({
				userStats: { chincannon_destroyed_loot_bank: ids.reduce((b, id) => b.add(id), new Bank()).toJSON() }
			} as any);
		expect(await has(uniques.slice(0, 4))).toBe(false);
		expect(await has(uniques)).toBe(true);
	});

	test('mixed raids add up', () => {
		const bank = new Bank().add(TfaItem.RONDACHE).add(chambersOfXericCL[0]).add(theatreOfBLoodCL[0]);
		expect(chincannonDestroyedUniqueCount(bank)).toBe(3);
	});
});
