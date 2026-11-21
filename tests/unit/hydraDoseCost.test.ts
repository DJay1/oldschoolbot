import { readFileSync } from 'node:fs';
import { Time } from '@oldschoolgg/toolkit';
import { Bank, Items, Monsters } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import killableMonsters from '@/lib/minions/data/killableMonsters/index.js';
import {
	consumePotionDoses,
	doseCountForItem,
	netDoseChange,
	potionFamilyForItem,
	totalDosesInBank
} from '@/lib/minions/functions/consumePotionDoses.js';
import { getItemCostFromConsumables } from '@/mahoji/lib/abstracted_commands/minionKill/handleConsumables.js';
import { makeGearBank } from './utils.js';

const antiVenomPlusFamily = potionFamilyForItem(Items.getOrThrow('Anti-venom+(4)').id)!;

function hydraCost(bank: Bank, opts?: { inputQuantity?: number; timeToFinish?: number; monster?: 'hydra' | 'alch' }) {
	const monster = killableMonsters.find(
		m => m.id === (opts?.monster === 'alch' ? Monsters.AlchemicalHydra.id : Monsters.Hydra.id)
	)!;
	const gearBank = makeGearBank({ bank: bank.clone() });
	return getItemCostFromConsumables({
		consumableCosts: [monster.itemCost as any],
		gearBank,
		inputQuantity: opts?.inputQuantity ?? 1,
		timeToFinish: opts?.timeToFinish ?? monster.timeToFinish,
		maxTripLength: Time.Hour,
		slayerKillsRemaining: null
	});
}

describe('consumePotionDoses', () => {
	test('short use of a 4-dose vial returns a 3-dose leftover', () => {
		const bank = new Bank().add('Anti-venom+(4)', 1);
		const plan = consumePotionDoses(bank, antiVenomPlusFamily, 1);
		expect(plan).not.toBeNull();
		expect(plan!.itemsToRemove.amount('Anti-venom+(4)')).toBe(1);
		expect(plan!.itemsToAdd.amount('Anti-venom+(3)')).toBe(1);
		expect(netDoseChange(bank, antiVenomPlusFamily, plan!)).toBe(-1);
	});

	test('uses a 1-dose vial before opening a 4-dose vial', () => {
		const bank = new Bank().add('Anti-venom+(1)', 1).add('Anti-venom+(4)', 1);
		const plan = consumePotionDoses(bank, antiVenomPlusFamily, 1);
		expect(plan!.itemsToRemove.amount('Anti-venom+(1)')).toBe(1);
		expect(plan!.itemsToRemove.amount('Anti-venom+(4)')).toBe(0);
		expect(plan!.itemsToAdd.length).toBe(0);
		expect(netDoseChange(bank, antiVenomPlusFamily, plan!)).toBe(-1);
	});

	test('opening a 2-dose vial for 1 dose returns a 1-dose leftover', () => {
		const bank = new Bank().add('Anti-venom+(2)', 1);
		const plan = consumePotionDoses(bank, antiVenomPlusFamily, 1);
		expect(plan!.itemsToRemove.amount('Anti-venom+(2)')).toBe(1);
		expect(plan!.itemsToAdd.amount('Anti-venom+(1)')).toBe(1);
		expect(netDoseChange(bank, antiVenomPlusFamily, plan!)).toBe(-1);
	});

	test('using two 3-dose vials for 4 doses returns a 2-dose leftover', () => {
		const bank = new Bank().add('Anti-venom+(3)', 2);
		const plan = consumePotionDoses(bank, antiVenomPlusFamily, 4);
		expect(plan!.itemsToRemove.amount('Anti-venom+(3)')).toBe(2);
		expect(plan!.itemsToAdd.amount('Anti-venom+(2)')).toBe(1);
		expect(netDoseChange(bank, antiVenomPlusFamily, plan!)).toBe(-4);
	});

	test('returns null when the bank does not have enough doses', () => {
		const bank = new Bank().add('Anti-venom+(1)', 2);
		expect(consumePotionDoses(bank, antiVenomPlusFamily, 3)).toBeNull();
	});

	test('zero doses removes and refunds nothing', () => {
		const bank = new Bank().add('Anti-venom+(4)', 5);
		const plan = consumePotionDoses(bank, antiVenomPlusFamily, 0);
		expect(plan!.itemsToRemove.length).toBe(0);
		expect(plan!.itemsToAdd.length).toBe(0);
		expect(netDoseChange(bank, antiVenomPlusFamily, plan!)).toBe(0);
	});
});

describe('Hydra anti-venom is charged by dose', () => {
	test('a 39-second Hydra trip uses 1 dose and returns a (3)', () => {
		const bank = new Bank().add('Anti-venom+(4)', 1);
		const cost = hydraCost(bank, { timeToFinish: Time.Second * 39 });
		expect(cost.itemCost!.amount('Anti-venom+(4)')).toBe(1);
		expect(cost.itemCost!.amount('Anti-venom+(1)')).toBe(0);
		expect(cost.itemRefund!.amount('Anti-venom+(3)')).toBe(1);
		expect(
			totalDosesInBank(bank, antiVenomPlusFamily) -
				totalDosesInBank(bank.clone().remove(cost.itemCost!).add(cost.itemRefund!), antiVenomPlusFamily)
		).toBe(1);
	});

	test('a short trip can be paid with a single 1-dose vial', () => {
		const bank = new Bank().add('Anti-venom+(1)', 1);
		const cost = hydraCost(bank, { timeToFinish: Time.Second * 39 });
		expect(cost.itemCost!.amount('Anti-venom+(1)')).toBe(1);
		expect(cost.itemRefund).toBeUndefined();
	});

	test('Alchemical Hydra also consumes leftover doses instead of a whole (4)', () => {
		const bank = new Bank().add('Anti-venom+(4)', 1);
		const cost = hydraCost(bank, { monster: 'alch', inputQuantity: 1, timeToFinish: Time.Second * 39 });
		expect(cost.itemCost!.amount('Anti-venom+(4)')).toBe(1);
		expect(cost.itemRefund!.amount('Anti-venom+(3)')).toBe(1);
	});

	test('falls back to Anti-venom when Anti-venom+ is missing', () => {
		const bank = new Bank().add('Anti-venom(4)', 1);
		const cost = hydraCost(bank, { timeToFinish: Time.Second * 39 });
		expect(cost.itemCost!.amount('Anti-venom(4)')).toBe(1);
		expect(cost.itemRefund!.amount('Anti-venom(3)')).toBe(1);
		expect(cost.itemCost!.amount('Anti-venom+(4)')).toBe(0);
	});

	test('does not create doses by rounding or refunding more than was consumed', () => {
		const start = new Bank().add('Anti-venom+(4)', 1).add('Anti-venom+(1)', 2);
		const cost = hydraCost(start, { inputQuantity: 8, timeToFinish: Time.Second * 110 });
		const end = start
			.clone()
			.remove(cost.itemCost!)
			.add(cost.itemRefund ?? new Bank());
		const used = totalDosesInBank(start, antiVenomPlusFamily) - totalDosesInBank(end, antiVenomPlusFamily);
		expect(used).toBeGreaterThan(0);
		expect(used).toBeLessThanOrEqual(totalDosesInBank(start, antiVenomPlusFamily));
		for (const [item] of end.items()) {
			expect(doseCountForItem(item.id)).not.toBeNull();
		}
		// A decant of the leftover bank cannot yield more doses than were kept.
		expect(totalDosesInBank(end, antiVenomPlusFamily)).toBe(totalDosesInBank(start, antiVenomPlusFamily) - used);
	});

	test('still reports an anti-venom cost when the bank is empty', () => {
		const cost = hydraCost(new Bank(), { monster: 'alch', inputQuantity: 5 });
		const plusDoses =
			cost.itemCost!.amount('Anti-venom+(4)') * 4 +
			cost.itemCost!.amount('Anti-venom+(3)') * 3 +
			cost.itemCost!.amount('Anti-venom+(2)') * 2 +
			cost.itemCost!.amount('Anti-venom+(1)');
		expect(plusDoses).toBeGreaterThan(0);
	});
});

describe('leftover dose refunds are not collection-logged', () => {
	test('kill trips refund leftovers through itemLootBankNoCL', () => {
		const src = readFileSync('src/mahoji/lib/abstracted_commands/minionKill/timeAndSpeed.ts', 'utf8');
		expect(src).toMatch(/itemLootBankNoCL\.add\(consumablesCost\.itemRefund\)/);
		expect(src).not.toMatch(/itemLootBank\.add\(consumablesCost\.itemRefund\)/);
	});

	test('tame trips refund leftovers only after the cost is removed', () => {
		const src = readFileSync('src/lib/bso/commands/tames.ts', 'utf8');
		const removeAt = src.indexOf('await user.removeItemsFromBank(itemCost);');
		const refundAt = src.indexOf(
			'await user.addItemsToBank({ items: potionRefund, collectionLog: false, dontAddToTempCL: true });'
		);
		expect(removeAt).toBeGreaterThan(-1);
		expect(refundAt).toBeGreaterThan(removeAt);
	});
});
