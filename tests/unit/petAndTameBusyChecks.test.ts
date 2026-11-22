import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

import {
	busyBlocksPaintEquippedPet,
	busyBlocksUnequipOrSwap,
	PET_PAINT_BUSY_MESSAGE,
	PET_UNEQUIP_BUSY_MESSAGE
} from '@/lib/minions/functions/petActivityGuards.js';

describe('pet and tame activity guards', () => {
	test('equipping is allowed while busy if no pet is equipped', () => {
		expect(busyBlocksUnequipOrSwap(true, null)).toBeNull();
		expect(busyBlocksUnequipOrSwap(true, undefined)).toBeNull();
	});

	test('unequipping or swapping is blocked while a trip is running', () => {
		expect(busyBlocksUnequipOrSwap(true, 123)).toBe(PET_UNEQUIP_BUSY_MESSAGE);
		expect(busyBlocksUnequipOrSwap(false, 123)).toBeNull();
	});

	test('painting the equipped pet is blocked while a trip is running', () => {
		expect(busyBlocksPaintEquippedPet(true, 123, 123)).toBe(PET_PAINT_BUSY_MESSAGE);
		expect(busyBlocksPaintEquippedPet(true, 123, 456)).toBeNull();
		expect(busyBlocksPaintEquippedPet(false, 123, 123)).toBeNull();
		expect(busyBlocksPaintEquippedPet(true, null, 123)).toBeNull();
	});

	test('equip, unequip and paint call the busy guards', () => {
		const equipSrc = readFileSync('src/lib/minions/functions/equipPet.ts', 'utf8');
		const unequipSrc = readFileSync('src/lib/minions/functions/unequipPet.ts', 'utf8');
		const paintSrc = readFileSync('src/lib/bso/commands/paint.ts', 'utf8');
		expect(equipSrc).toMatch(/busyBlocksUnequipOrSwap\(await user\.minionIsBusy\(\), currentlyEquippedPet\)/);
		expect(unequipSrc).toMatch(/busyBlocksUnequipOrSwap\(await user\.minionIsBusy\(\), equippedPet\)/);
		expect(paintSrc).toMatch(/busyBlocksPaintEquippedPet\(/);
		expect(paintSrc).toMatch(/user\.user\.minion_equippedPet/);
		// Previews (no paint selected, or unowned paint can) must stay allowed.
		const previewAt = paintSrc.indexOf('paint-previews.png');
		const unownedAt = paintSrc.indexOf('paint-preview.png');
		const blockAt = paintSrc.indexOf('busyBlocksPaintEquippedPet(');
		expect(previewAt).toBeGreaterThan(-1);
		expect(unownedAt).toBeGreaterThan(previewAt);
		expect(blockAt).toBeGreaterThan(unownedAt);
	});

	test('tame rename and custom image are blocked when the tame is busy', () => {
		const src = readFileSync('src/lib/bso/commands/tames.ts', 'utf8');
		expect(src).toContain("You can't rename your tame, because it is busy.");
		expect(src).toContain("You can't change your tame's image, because it is busy.");
		expect(src).toContain("You can't select a different tame, because your current one is busy.");
		expect(src).toContain("You can't equip something to your tame, because it is busy.");
		expect(src).toContain("You can't unequip something to your tame, because it is busy.");
	});
});
