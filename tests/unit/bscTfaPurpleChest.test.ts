import '../../src/lib/util/clientSettings.js';
import { Bank } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { TfaItem, tfaPurpleItems } from '@/lib/bsc/tfa/tfaItems.js';
import { chestLootIsPurple, chestPurpleItemsFor } from '@/lib/canvas/chestImage.js';
import { buildRepeatTripArgs } from '@/lib/util/repeatStoredTrip.js';
import { activity_type_enum } from '../../src/prisma/main/enums.js';

describe('TFA purple chest', () => {
	const purples = chestPurpleItemsFor('The Fractured Archive');

	test('uses the same purple list as the drop announcements', () => {
		expect([...purples].sort()).toEqual([...tfaPurpleItems].sort());
	});

	test('a unique or Orion makes the panel purple', () => {
		for (const id of tfaPurpleItems) {
			expect(chestLootIsPurple(new Bank().add(id).add('Coins', 1000), purples)).toBe(true);
		}
	});

	test('normal loot, tertiaries and shards stay the closed chest', () => {
		const loot = new Bank()
			.add(TfaItem.ASCENSION_SHARDS, 200)
			.add(TfaItem.ARCHIVISTS_FOLIO)
			.add('Clue scroll (elite)')
			.add('Coins', 50_000);
		expect(chestLootIsPurple(loot, purples)).toBe(false);
		expect(chestLootIsPurple(new Bank(), purples)).toBe(false);
	});
});

describe('TFA repeat keeps the mass max team size', () => {
	test('mass and solo', () => {
		const mass = buildRepeatTripArgs(activity_type_enum.FracturedArchive, {
			users: ['1', '2'],
			quantity: 3,
			repeatMaxSize: 6
		}) as any;
		expect(mass.tfa.start).toMatchObject({ max_team_size: 6, quantity: 3 });
		const solo = buildRepeatTripArgs(activity_type_enum.FracturedArchive, {
			users: ['1'],
			quantity: 1,
			repeatMaxSize: 6
		}) as any;
		expect(solo.tfa.start).toMatchObject({ solo: true });
		expect(solo.tfa.start.max_team_size).toBeUndefined();
	});
});