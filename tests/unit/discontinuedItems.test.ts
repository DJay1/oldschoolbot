import { Items } from 'oldschooljs';
import { describe, expect, test, vi } from 'vitest';

import {
	getDiscontinuedItemIDs,
	getDiscontinuedItemPerks,
	getDiscontinuedItemStatus,
	isDiscontinuedItem
} from '@/lib/discontinuedItems.js';

const launchActive = vi.hoisted(() => ({ value: true }));

vi.mock('@/lib/events/registry.js', async importOriginal => {
	const original = await importOriginal<typeof import('@/lib/events/registry.js')>();
	return {
		...original,
		isEventActive: (id: Parameters<typeof original.isEventActive>[0], now?: number) =>
			id === 'launch' ? launchActive.value : original.isEventActive(id, now)
	};
});

describe('discontinued items', () => {
	test('includes discontinued event items and pets', () => {
		for (const name of ['Kuro', 'Chickaxe', 'Gregoyle', 'Maledict codex', 'Archon headdress', 'Christmas dye']) {
			expect(isDiscontinuedItem(Items.getOrThrow(name).id), name).toBe(true);
		}
	});

	test('excludes regular game items from key crate and event loot tables', () => {
		for (const name of [
			'Coins',
			'Magic logs',
			'Chocolate bar',
			'Pumpkin seed',
			'Draconic visage',
			'Clue scroll (grandmaster)',
			'Clue scroll (elder)',
			'Elder scroll piece'
		]) {
			expect(isDiscontinuedItem(Items.getOrThrow(name).id), name).toBe(false);
		}
	});

	test('pets with perks show them, and every pet with perks is a discontinued item', () => {
		expect(getDiscontinuedItemPerks(Items.getOrThrow('Kuro').id).length).toBeGreaterThan(0);
		expect(getDiscontinuedItemPerks(Items.getOrThrow('Gregoyle').id).length).toBeGreaterThan(0);
		expect(getDiscontinuedItemPerks(Items.getOrThrow('Chickaxe').id)).toEqual([]);
		for (const name of ['Kuro', 'Gregoyle', 'Smokey', 'Flappy', 'Cob', 'Partycrab', 'Patricia']) {
			expect(isDiscontinuedItem(Items.getOrThrow(name).id), name).toBe(true);
		}
	});

	test('Launch box items show as released only while the Launch event is on', () => {
		const kuro = Items.getOrThrow('Kuro').id;
		const chickaxe = Items.getOrThrow('Chickaxe').id;

		launchActive.value = true;
		expect(getDiscontinuedItemStatus(kuro)).toBe('Released (Launch box)');
		expect(getDiscontinuedItemStatus(Items.getOrThrow('Flappy').id)).toBe('Released (Launch box)');
		expect(getDiscontinuedItemStatus(Items.getOrThrow('Gregoyle').id)).toBe('Released (Launch box)');
		expect(isDiscontinuedItem(Items.getOrThrow('Corgo party hat').id)).toBe(true);
		expect(getDiscontinuedItemStatus(Items.getOrThrow('Corgo party hat').id)).toBe('Released (Launch box)');
		expect(getDiscontinuedItemStatus(chickaxe)).toBe('Unreleased');

		launchActive.value = false;
		expect(getDiscontinuedItemStatus(kuro)).toBe('Unreleased');
	});

	test('the list is a reasonable size', () => {
		const size = getDiscontinuedItemIDs().size;
		expect(size).toBeGreaterThan(100);
		expect(size).toBeLessThan(1000);
	});
});
