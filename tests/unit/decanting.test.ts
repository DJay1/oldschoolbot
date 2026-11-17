import { Bank } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import Potions from '../../src/lib/minions/data/potions.js';
import decantPotionFromBank, {
	countPotionDoses,
	decantAllPotionsFromBank,
	formatDecantReply
} from '../../src/lib/minions/functions/decantPotionFromBank.js';

describe('decantPotionFromBank', () => {
	test('decantPotionFromBank', () => {
		const userBank = new Bank({
			'Magic potion (3)': 1000,
			'Defence potion (4)': 733,
			'Defence potion (3)': 233,
			'Defence potion (1)': 8,
			'Attack potion (2)': 1000,
			'Strength potion (1)': 1000,
			'Prayer mix (2)': 1000,
			'Extended antifire mix (1)': 667
		});
		expect(decantPotionFromBank(userBank, 'magic potion', 4)).toMatchObject({
			potionsToAdd: new Bank({ 'Magic potion (4)': 750 }),
			potionsToRemove: new Bank({ 'Magic potion (3)': 1000 }),
			sumOfPots: 1000,
			potionName: 'Magic potion',
			finalUserBank: new Bank({
				'Magic potion (4)': 750,
				'Defence potion (4)': 733,
				'Defence potion (3)': 233,
				'Defence potion (1)': 8,
				'Attack potion (2)': 1000,
				'Strength potion (1)': 1000,
				'Prayer mix (2)': 1000,
				'Extended antifire mix (1)': 667
			})
		});
		expect(decantPotionFromBank(userBank, 'defence potion', 2)).toMatchObject({
			potionsToAdd: new Bank({
				'Defence potion (2)': 1819,
				'Defence potion (1)': 1
			}),
			potionsToRemove: new Bank({
				'Defence potion (4)': 733,
				'Defence potion (3)': 233,
				'Defence potion (1)': 8
			}),
			sumOfPots: 974,
			potionName: 'Defence potion',
			finalUserBank: new Bank({
				'Magic potion (3)': 1000,
				'Defence potion (2)': 1819,
				'Defence potion (1)': 1,
				'Attack potion (2)': 1000,
				'Strength potion (1)': 1000,
				'Prayer mix (2)': 1000,
				'Extended antifire mix (1)': 667
			})
		});
		expect(decantPotionFromBank(userBank, 'attack potion', 2)).toEqual({
			error: "You don't have any **Attack potion** to decant!"
		});
		expect(decantPotionFromBank(userBank, 'attack potion', 4)).toMatchObject({
			potionsToAdd: new Bank({
				'Attack potion (4)': 500
			}),
			potionsToRemove: new Bank({
				'Attack potion (2)': 1000
			}),
			sumOfPots: 1000,
			potionName: 'Attack potion',
			finalUserBank: new Bank({
				'Magic potion (3)': 1000,
				'Defence potion (4)': 733,
				'Defence potion (3)': 233,
				'Defence potion (1)': 8,
				'Attack potion (4)': 500,
				'Strength potion (1)': 1000,
				'Prayer mix (2)': 1000,
				'Extended antifire mix (1)': 667
			})
		});
		expect(decantPotionFromBank(userBank, 'strength potion', 3)).toMatchObject({
			potionsToAdd: new Bank({
				'Strength potion (3)': 333,
				'Strength potion (1)': 1
			}),
			potionsToRemove: new Bank({
				'Strength potion (1)': 1000
			}),
			sumOfPots: 1000,
			potionName: 'Strength potion',
			finalUserBank: new Bank({
				'Magic potion (3)': 1000,
				'Defence potion (4)': 733,
				'Defence potion (3)': 233,
				'Defence potion (1)': 8,
				'Attack potion (2)': 1000,
				'Strength potion (3)': 333,
				'Strength potion (1)': 1,
				'Prayer mix (2)': 1000,
				'Extended antifire mix (1)': 667
			})
		});
		expect(decantPotionFromBank(userBank, 'prayer mix', 1)).toMatchObject({
			potionsToAdd: new Bank({
				'Prayer mix (1)': 2000
			}),
			potionsToRemove: new Bank({
				'Prayer mix (2)': 1000
			}),
			sumOfPots: 1000,
			potionName: 'Prayer mix',
			finalUserBank: new Bank({
				'Magic potion (3)': 1000,
				'Defence potion (4)': 733,
				'Defence potion (3)': 233,
				'Defence potion (1)': 8,
				'Attack potion (2)': 1000,
				'Strength potion (1)': 1000,
				'Prayer mix (1)': 2000,
				'Extended antifire mix (1)': 667
			})
		});
		expect(decantPotionFromBank(userBank, 'extended antifire mix', 2)).toMatchObject({
			potionsToAdd: new Bank({
				'Extended antifire mix (2)': 333,
				'Extended antifire mix (1)': 1
			}),
			potionsToRemove: new Bank({
				'Extended antifire mix (1)': 667
			}),
			sumOfPots: 667,
			potionName: 'Extended antifire mix',
			finalUserBank: new Bank({
				'Magic potion (3)': 1000,
				'Defence potion (4)': 733,
				'Defence potion (3)': 233,
				'Defence potion (1)': 8,
				'Attack potion (2)': 1000,
				'Strength potion (1)': 1000,
				'Prayer mix (2)': 1000,
				'Extended antifire mix (2)': 333,
				'Extended antifire mix (1)': 1
			})
		});
	});
});

test('quantity caps how many target-dose potions are made', () => {
	const userBank = new Bank({
		'Magic potion (3)': 10
	});
	const res = decantPotionFromBank(userBank, 'magic potion', 4, 2);
	expect(res.error).toBeNull();
	if (res.error !== null) return;
	// 3 pots * 3 doses = 9 doses needed to make 2x 4-dose with 1 leftover
	expect(res.potionsToRemove).toEqual(new Bank({ 'Magic potion (3)': 3 }));
	expect(res.potionsToAdd).toEqual(new Bank({ 'Magic potion (4)': 2, 'Magic potion (1)': 1 }));
	const potion = Potions.find(p => p.name === 'Magic potion');
	expect(countPotionDoses(res.potionsToRemove, potion!.items)).toBe(
		countPotionDoses(res.potionsToAdd, potion!.items)
	);
});

test('total doses before equal total doses after for a single potion', () => {
	const userBank = new Bank({
		'Defence potion (4)': 733,
		'Defence potion (3)': 233,
		'Defence potion (1)': 8
	});
	const potion = Potions.find(p => p.name === 'Defence potion');
	expect(potion).toBeTruthy();
	const before = countPotionDoses(userBank, potion!.items);
	const res = decantPotionFromBank(userBank, 'defence potion', 2);
	expect(res.error).toBeNull();
	if (res.error !== null) return;
	expect(countPotionDoses(res.potionsToRemove, potion!.items)).toBe(
		countPotionDoses(res.potionsToAdd, potion!.items)
	);
	expect(countPotionDoses(res.finalUserBank, potion!.items)).toBe(before);
});

test('decant all conserves doses and does not overlap potion IDs', () => {
	const seen = new Set<number>();
	for (const pot of Potions) {
		for (const id of pot.items) {
			expect(seen.has(id), `duplicate potion item id ${id} in ${pot.name}`).toBe(false);
			seen.add(id);
		}
	}

	const userBank = new Bank({
		'Magic potion (3)': 1000,
		'Defence potion (4)': 733,
		'Defence potion (3)': 233,
		'Defence potion (1)': 8,
		'Attack potion (2)': 1000,
		'Strength potion (1)': 1000,
		'Prayer mix (2)': 1000,
		'Extended antifire mix (1)': 667
	});
	const beforeTotal = Potions.reduce((sum, pot) => sum + countPotionDoses(userBank, pot.items), 0);
	const res = decantAllPotionsFromBank(userBank, 4);
	expect(res.results.length).toBeGreaterThan(1);
	const afterBank = new Bank().add(userBank).add(res.potionsToAdd).remove(res.potionsToRemove);
	const afterTotal = Potions.reduce((sum, pot) => sum + countPotionDoses(afterBank, pot.items), 0);
	expect(afterTotal).toBe(beforeTotal);
	// No item is both added and removed in a way that could net extra of the same item
	for (const [item] of res.potionsToRemove.items()) {
		const removed = res.potionsToRemove.amount(item.id);
		const added = res.potionsToAdd.amount(item.id);
		expect(removed).toBeGreaterThan(0);
		// leftover can add back a lower-dose item that was also removed; net must not go negative on owns()
		expect(userBank.amount(item.id)).toBeGreaterThanOrEqual(removed);
		expect(afterBank.amount(item.id)).toBe(userBank.amount(item.id) - removed + added);
	}
	expect(userBank.clone().remove(res.potionsToRemove).toString().includes('-')).toBe(false);
});

test('decant-all reply stays under Discord length in the worst case', () => {
	const results = Potions.filter(p => p.items.length >= 2).map(p => ({
		sumOfPots: 9_999_999,
		potionName: p.name,
		potionsToAdd: new Bank().add(p.items[p.items.length - 1], 9_999_999).add(p.items[0], 9_999_999)
	}));
	expect(results.length).toBeGreaterThan(10);
	const reply = formatDecantReply(results, 4);
	expect(reply.length).toBeLessThanOrEqual(1850);
	expect(reply).toContain('potion types');
	expect(reply.startsWith('You decanted')).toBe(true);
});
