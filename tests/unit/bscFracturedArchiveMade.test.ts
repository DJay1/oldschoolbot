import { Bank, Items } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { TFA_UNCHARGEABLE, tfaUnchargeRefund } from '@/lib/bsc/tfa/tfaCharges.js';
import { TfaItem, tfaAscensionBoltIDs, tfaCL } from '@/lib/bsc/tfa/tfaItems.js';
import { degradeableItems } from '@/lib/degradeableItems.js';
import { projectiles } from '@/lib/gear/projectiles.js';
import { Fletchables, fletchingCL } from '@/lib/skilling/skills/fletching/fletchables/index.js';
import { Enchantables } from '@/lib/skilling/skills/magic/enchantables.js';
import Mining from '@/lib/skilling/skills/mining.js';

describe('The Fractured Archive made items', () => {
	test('new items: names, tradeability, ammo', () => {
		const expected: [number, string, boolean][] = [
			[TfaItem.ZORYAS_TOME_CHARGED, "Zorya's tome", false],
			[TfaItem.OBLIGATOR_CHARGED, 'Obligator', false],
			[TfaItem.ARCHIVISTS_FOLIO_CHARGED, "Archivist's folio", false],
			[TfaItem.ASCENSION_BOLTS, 'Ascension bolts', true],
			[TfaItem.DIAMOND_ASCENSION_BOLTS, 'Diamond ascension bolts', true],
			[TfaItem.ONYX_ASCENSION_BOLTS, 'Onyx ascension bolts', true],
			[TfaItem.DIAMOND_ASCENSION_BOLTS_E, 'Diamond ascension bolts (e)', true],
			[TfaItem.ONYX_ASCENSION_BOLTS_E, 'Onyx ascension bolts (e)', true]
		];
		for (const [id, name, tradeable] of expected) {
			const item = Items.getOrThrow(id);
			expect(item.name).toBe(name);
			expect(Boolean(item.tradeable)).toBe(tradeable);
		}
		for (const id of tfaAscensionBoltIDs) {
			const item = Items.getOrThrow(id);
			expect(item.stackable).toBe(true);
			expect(item.equipment?.slot).toBe('ammo');
		}
		expect(Items.getOrThrow(TfaItem.ASCENSION_BOLTS).equipment?.ranged_strength).toBe(53);
		// None of the made items are in the TFA collection log (OSRS doesn't log them).
		for (const id of [...tfaAscensionBoltIDs, 74_617, 74_618, 74_619]) expect(tfaCL.includes(id)).toBe(false);
	});

	test('Ascension crossbows only fire Ascension bolts', () => {
		expect([...projectiles.ascensionBolt.weapons]).toEqual([TfaItem.ASCENSION_CROSSBOWS]);
		expect([...projectiles.ascensionBolt.items].sort()).toEqual([...tfaAscensionBoltIDs].sort());
		for (const [key, group] of Object.entries(projectiles)) {
			if (key === 'ascensionBolt') continue;
			expect((group.weapons as readonly number[]).includes(TfaItem.ASCENSION_CROSSBOWS)).toBe(false);
			for (const id of tfaAscensionBoltIDs) expect((group.items as readonly number[]).includes(id)).toBe(false);
		}
	});

	test('Fletching and enchanting recipes match OSRS', () => {
		const bolts = Fletchables.find(f => f.id === TfaItem.ASCENSION_BOLTS)!;
		expect(bolts.level).toBe(86);
		expect(bolts.xp).toBe(140);
		expect(bolts.outputMultiple).toBe(10);
		expect(bolts.inputItems.equals(new Bank().add(TfaItem.ASCENSION_SHARDS))).toBe(true);
		const diamond = Fletchables.find(f => f.id === TfaItem.DIAMOND_ASCENSION_BOLTS)!;
		expect(diamond.inputItems.equals(new Bank().add(TfaItem.ASCENSION_BOLTS).add('Diamond bolt tips'))).toBe(true);
		const onyx = Fletchables.find(f => f.id === TfaItem.ONYX_ASCENSION_BOLTS)!;
		expect(onyx.inputItems.equals(new Bank().add(TfaItem.ASCENSION_BOLTS).add('Onyx bolt tips'))).toBe(true);
		for (const id of [TfaItem.ASCENSION_BOLTS, TfaItem.DIAMOND_ASCENSION_BOLTS, TfaItem.ONYX_ASCENSION_BOLTS]) {
			expect(fletchingCL.includes(id)).toBe(false);
		}

		const dE = Enchantables.find(e => e.output.has(TfaItem.DIAMOND_ASCENSION_BOLTS_E))!;
		expect(dE.level).toBe(57);
		expect(
			dE.input.equals(
				new Bank()
					.add(TfaItem.DIAMOND_ASCENSION_BOLTS, 10)
					.add('Law rune', 2)
					.add('Cosmic rune', 1)
					.add('Earth rune', 10)
			)
		).toBe(true);
		const oE = Enchantables.find(e => e.output.has(TfaItem.ONYX_ASCENSION_BOLTS_E))!;
		expect(oE.level).toBe(87);
		expect(
			oE.input.equals(
				new Bank()
					.add(TfaItem.ONYX_ASCENSION_BOLTS, 10)
					.add('Fire rune', 20)
					.add('Death rune')
					.add('Cosmic rune')
			)
		).toBe(true);
	});

	test('Ascension rocks', () => {
		const ore = Mining.Ores.find(o => o.name === 'Ascension rocks')!;
		expect(ore.id).toBe(TfaItem.ASCENSION_SHARDS);
		expect(ore.level).toBe(80);
		expect(ore.xp).toBe(15);
	});

	test('charges: OSRS costs, caps, and uncharge never gives back more than was put in', () => {
		const obligator = degradeableItems.find(d => d.item.id === TfaItem.OBLIGATOR_CHARGED)!;
		const tome = degradeableItems.find(d => d.item.id === TfaItem.ZORYAS_TOME_CHARGED)!;
		const folio = degradeableItems.find(d => d.item.id === TfaItem.ARCHIVISTS_FOLIO_CHARGED)!;
		expect(obligator.chargeInput.charges).toBe(30);
		expect(
			obligator.chargeInput.cost.equals(
				new Bank().add(TfaItem.ASCENSION_SHARDS).add('Nature rune', 60).add('Death rune', 60)
			)
		).toBe(true);
		expect(tome.chargeInput.charges).toBe(1);
		expect(tome.chargeInput.cost.equals(new Bank().add('Astral rune', 3).add('Nature rune', 2))).toBe(true);
		expect(folio.chargeInput.charges).toBe(5);
		for (const d of [obligator, tome, folio]) {
			expect(d.maxCharges).toBe(20_000);
			expect(d.convertOnCharge).toBe(true);
			expect(Items.getOrThrow(d.item.id).tradeable).toBeFalsy();
		}
		expect(obligator.unchargedItem?.id).toBe(TfaItem.OBLIGATOR);
		expect(tome.unchargedItem?.id).toBe(TfaItem.ZORYAS_TOME);
		expect(folio.unchargedItem?.id).toBe(TfaItem.ARCHIVISTS_FOLIO);
		// The folio can't be uncharged (OSRS: charges can't be refunded).
		expect((TFA_UNCHARGEABLE as readonly number[]).includes(TfaItem.ARCHIVISTS_FOLIO_CHARGED)).toBe(false);

		// Obligator: only whole 30-charge units refund.
		const r1 = tfaUnchargeRefund(obligator, 95);
		expect(r1.refund.equals(obligator.chargeInput.cost.clone().multiply(3))).toBe(true);
		expect(r1.lostCharges).toBe(5);
		// Zorya's tome: everything back.
		const r2 = tfaUnchargeRefund(tome, 1234);
		expect(r2.refund.equals(tome.chargeInput.cost.clone().multiply(1234))).toBe(true);
		expect(r2.lostCharges).toBe(0);
		expect(tfaUnchargeRefund(obligator, 0).refund.length).toBe(0);
		expect(tfaUnchargeRefund(obligator, -10).refund.length).toBe(0);
		// Charging N times then uncharging gives back exactly what was spent.
		for (const n of [1, 7, 666]) {
			const spent = obligator.chargeInput.cost.clone().multiply(n);
			expect(tfaUnchargeRefund(obligator, obligator.chargeInput.charges * n).refund.equals(spent)).toBe(true);
		}
	});

	test('uncharge is a single transaction that zeroes charges', async () => {
		const { readFileSync } = await import('node:fs');
		const src = readFileSync('src/lib/bsc/tfa/tfaCharges.ts', 'utf8');
		expect(src.match(/transactItems\(/g)?.length).toBe(1);
		expect(src).toMatch(/otherUpdates: \{ \[degItem\.settingsKey\]: 0 \}/);
		expect(src).toMatch(/minionIsBusy/);
	});
});
