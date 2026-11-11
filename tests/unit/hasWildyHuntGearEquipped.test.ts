import { expect, test } from 'vitest';

import { hasWildyHuntGearEquipped } from '@/lib/gear/functions/hasWildyHuntGearEquipped.js';
import { constructGearSetup } from '@/lib/structures/Gear.js';

test('Masori body (f) and chaps (f) still score 100%', () => {
	const setup = constructGearSetup({
		body: 'Masori body (f)',
		legs: 'Masori chaps (f)'
	});
	const [ok, , score] = hasWildyHuntGearEquipped(setup.raw());
	expect(ok).toBe(true);
	expect(score).toBe(100);
});

test('extra equipped slots cannot raise the score above 100%', () => {
	const setup = constructGearSetup({
		head: 'Masori mask (f)',
		cape: "Ava's assembler",
		body: 'Masori body (f)',
		legs: 'Masori chaps (f)',
		hands: 'Barrows gloves',
		feet: 'Pegasian boots'
	});
	const [ok, , score] = hasWildyHuntGearEquipped(setup.raw());
	expect(ok).toBe(true);
	expect(score).toBe(100);
});

test('all equipped slots count, so body and legs are not both required', () => {
	const setup = constructGearSetup({
		head: 'Justiciar faceguard',
		cape: 'Infernal cape',
		neck: 'Amulet of fury',
		body: 'Masori body (f)',
		shield: 'Spectral spirit shield',
		hands: 'Barrows gloves',
		feet: 'Primordial boots',
		ring: 'Ring of suffering (i)'
	});
	const [ok] = hasWildyHuntGearEquipped(setup.raw());
	expect(ok).toBe(true);
});
