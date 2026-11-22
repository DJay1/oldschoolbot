import { AkumuLootTable } from '@/lib/bso/monsters/bosses/Akumu.js';

import { itemID } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

function tertiaryChance(itemName: string) {
	const drop = AkumuLootTable.tertiaryItems.find(entry => entry.item === itemID(itemName));
	return drop?.chance;
}

describe('Akumu loot rates', () => {
	test('Demon statuette is 1/50 and other tertiaries are unchanged', () => {
		expect(tertiaryChance('Demon statuette')).toBe(50);
		expect(tertiaryChance('Cursed onyx')).toBe(4);
		expect(tertiaryChance('Elder scroll piece')).toBe(85);
		expect(tertiaryChance('Mini akumu')).toBe(1000);
	});
});
