import { EItem } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { filterableTypes } from '@/lib/data/filterables.js';
import Crush from '@/lib/skilling/skills/herblore/mixables/crush.js';

const herblore = filterableTypes.find(f => f.aliases.includes('herblore'));

// Other items also named "Bird nest" that cannot be crushed into Crushed nest.
const nonCrushableNests = [
	5070, // red egg
	5071, // green egg
	5072, // blue egg
	5073, // seeds
	5074, // ring
	7413, // Wyson
	13653,
	22798,
	22800
];

describe('herblore bank filter includes crushable bird nests', () => {
	test('includes the empty bird nest used to make Crushed nest, and no other nest variants', () => {
		expect(herblore).toBeTruthy();
		const ids = herblore!.items();
		const crushInput = Crush.find(i => i.item.id === EItem.CRUSHED_NEST)!.inputItems.itemIDs;
		expect(crushInput).toEqual([EItem.EMPTY_BIRD_NEST]);
		for (const id of crushInput) {
			expect(ids.includes(id), `missing crushable nest ${id}`).toBe(true);
		}
		expect(ids.includes(EItem.EMPTY_BIRD_NEST)).toBe(true);
		for (const id of nonCrushableNests) {
			expect(ids.includes(id), `non-crushable nest ${id} should not be in herblore`).toBe(false);
		}
	});

	test('filterables only return an item id list and do not change a bank', () => {
		expect(typeof herblore!.items).toBe('function');
		const first = herblore!.items();
		const second = herblore!.items();
		expect(first).toEqual(second);
		expect(first.every(id => typeof id === 'number')).toBe(true);
	});
});
