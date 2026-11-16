import '../../src/lib/util/clientSettings.js';
import { describe, expect, test } from 'vitest';

import { tfaUnchargeRefund } from '@/lib/bsc/tfa/tfaCharges.js';
import { TfaItem } from '@/lib/bsc/tfa/tfaItems.js';
import { degradeableItems } from '@/lib/degradeableItems.js';
import { planDegradeableCharge } from '@/lib/minions/functions/degradeableItemsCommand.js';

const deg = (id: number) => degradeableItems.find(d => d.item.id === id)!;
const obligator = deg(TfaItem.OBLIGATOR_CHARGED);
const tome = deg(TfaItem.ZORYAS_TOME_CHARGED);
const folio = deg(TfaItem.ARCHIVISTS_FOLIO_CHARGED);

describe('/minion charge amount means charges for TFA items', () => {
	test('Obligator: 10,000 charges on an empty one costs 334 units (rounded up) and adds 10,020', () => {
		const plan = planDegradeableCharge(obligator, 0, 10_000);
		if (typeof plan === 'string') throw new Error(plan);
		expect(plan.units).toBe(334);
		expect(plan.amountOfCharges).toBe(10_020);
		expect(plan.cost.amount(TfaItem.ASCENSION_SHARDS)).toBe(334);
		expect(plan.cost.amount('Nature rune')).toBe(334 * 60);
	});

	test('Obligator: asking for 20,000 fills to the most whole units that fit (19,980)', () => {
		const plan = planDegradeableCharge(obligator, 0, 20_000);
		if (typeof plan === 'string') throw new Error(plan);
		expect(plan.amountOfCharges).toBe(19_980);
	});

	test('amount 1 adds one unit, not 30x more than asked for in cost', () => {
		const plan = planDegradeableCharge(obligator, 0, 1);
		if (typeof plan === 'string') throw new Error(plan);
		expect(plan.units).toBe(1);
		expect(plan.amountOfCharges).toBe(30);
	});

	test('full item gives a clear error with how much room is left', () => {
		const res = planDegradeableCharge(obligator, 19_990, 100);
		expect(typeof res).toBe('string');
		expect(res).toContain('can add up to 0 more');
		const tomeRes = planDegradeableCharge(tome, 19_500, 1000);
		if (typeof tomeRes === 'string') throw new Error(tomeRes);
		expect(tomeRes.amountOfCharges).toBe(500);
	});

	test("Zorya's tome and Archivist's folio take charges too", () => {
		const t = planDegradeableCharge(tome, 0, 10_000);
		const f = planDegradeableCharge(folio, 0, 10_000);
		if (typeof t === 'string' || typeof f === 'string') throw new Error('unexpected');
		expect(t.amountOfCharges).toBe(10_000);
		expect(t.cost.amount('Astral rune')).toBe(30_000);
		expect(f.amountOfCharges).toBe(10_000);
		expect(f.cost.amount(TfaItem.ASCENSION_SHARDS)).toBe(2000);
	});

	test('charge then uncharge never refunds more than was paid', () => {
		for (const item of [obligator, tome]) {
			for (const amount of [1, 29, 31, 999, 10_000, 20_000]) {
				const plan = planDegradeableCharge(item, 0, amount);
				if (typeof plan === 'string') continue;
				const { refund } = tfaUnchargeRefund(item, plan.amountOfCharges);
				expect(plan.cost.has(refund)).toBe(true);
			}
		}
	});

	test('other degradeable items keep amount = cost units', () => {
		const scythe = degradeableItems.find(d => d.item.name === 'Scythe of vitur')!;
		const plan = planDegradeableCharge(scythe, 0, 2);
		if (typeof plan === 'string') throw new Error(plan);
		expect(plan.units).toBe(2);
		expect(plan.amountOfCharges).toBe(scythe.chargeInput.charges * 2);
	});
});