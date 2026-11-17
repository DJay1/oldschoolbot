import '../../src/lib/util/clientSettings.js';

import { describe, expect, test } from 'vitest';

import { tfaRangePercent } from '@/lib/bsc/tfa/tfa.js';
import { TfaItem } from '@/lib/bsc/tfa/tfaItems.js';
import { calcTOBRangePercent } from '@/lib/data/tob.js';
import { constructGearSetup } from '@/lib/structures/Gear.js';

const base = {
	head: 'Pernix cowl',
	neck: 'Necklace of anguish',
	body: 'Pernix body',
	cape: "Ava's assembler",
	hands: 'Pernix gloves',
	legs: 'Pernix chaps',
	feet: 'Pernix boots',
	ring: 'Venator ring'
} as const;

const withWeapon = (weapon: string, ammo?: string) =>
	constructGearSetup({ ...base, '2h': weapon, ...(ammo ? { ammo } : {}) });

describe('TFA range score with Ascension crossbows', () => {
	const bofa = calcTOBRangePercent(withWeapon('Bow of faerdhinen (c)').stats);
	const tbow = calcTOBRangePercent(withWeapon('Twisted bow', 'Dragon arrow').stats);
	const xbowGear = constructGearSetup({ ...base });
	xbowGear.equip(Items_getOrThrow(TfaItem.ASCENSION_CROSSBOWS));
	xbowGear.equip(Items_getOrThrow(TfaItem.ONYX_ASCENSION_BOLTS_E), 100);

	test('crossbows score at least a Bow of faerdhinen (c), and below a Twisted bow', () => {
		const xbow = tfaRangePercent(xbowGear);
		// ToB's stat math rates a Bofa (c) above a Twisted bow, so the crossbows get the Bofa level capped under the Twisted bow.
		expect(xbow).toBeGreaterThanOrEqual(Math.min(bofa, tbow - 2));
		expect(xbow).toBeLessThan(tbow);
		// and never lower than their real stats
		expect(xbow).toBeGreaterThanOrEqual(calcTOBRangePercent(xbowGear.stats));
	});

	test('Twisted bow setup is unaffected', () => {
		const g = withWeapon('Twisted bow', 'Dragon arrow');
		expect(tfaRangePercent(g)).toBe(calcTOBRangePercent(g.stats));
	});
});

import { Items } from 'oldschooljs';

function Items_getOrThrow(id: number) {
	return Items.getOrThrow(id);
}
