import { isGEUntradeable, isSuperUntradeable } from '@/lib/bso/bsoUtil.js';
import { firstAgeCL } from '@/lib/bso/collection-log/firstAge.js';
import { ElderClueTable } from '@/lib/bso/elderClue.js';
import {
	addUnchargedFirstAgeShards,
	FIRST_AGE_CHARGES_PER_ACTIVATION,
	firstAgeMaxUpgrades,
	formatMissingSacrifices,
	getFirstAgeSacrificeSlots,
	missingFirstAgeSacrifices,
	planActivation,
	planMaxUpgrade,
	UNCHARGED_FIRST_AGE_SHARD_DROP_RATE
} from '@/lib/bso/firstAge/shards.js';
import { mysteryBoxBlacklist } from '@/lib/bso/openables/mysteryBoxBlacklist.js';
import { embTable, tmbTable, umbTable } from '@/lib/bso/openables/mysteryBoxes.js';

import { Bank, Items } from 'oldschooljs';
import { expect, test } from 'vitest';

import { ClueTiers } from '@/lib/clues/clueTiers.js';
import { FIRST_AGE_MAX_PIECES_TRADEABLE, FirstAgeItem } from '@/lib/customItems/firstAge.js';
import { allCollectionLogs } from '@/lib/data/Collections.js';
import Createables from '@/lib/data/createables.js';
import { allOpenables } from '@/lib/openables.js';
import { Gear } from '@/lib/structures/Gear.js';
import itemIsTradeable from '@/lib/util/itemIsTradeable.js';

function sacrificedAll(exceptLabels: string[] = []): Bank {
	const bank = new Bank();
	for (const slot of getFirstAgeSacrificeSlots()) {
		if (exceptLabels.includes(slot.label)) continue;
		bank.add(slot.ids[0]);
	}
	return bank;
}

test('elder caskets roll the uncharged shard once per casket at 1/300', () => {
	expect(UNCHARGED_FIRST_AGE_SHARD_DROP_RATE).toEqual(300);
	const rates: number[] = [];
	const missed = new Bank();
	expect(
		addUnchargedFirstAgeShards(missed, 4, rate => {
			rates.push(rate);
			return false;
		})
	).toEqual(0);
	expect(rates).toEqual([300, 300, 300, 300]);
	expect(missed.amount(FirstAgeItem.UNCHARGED_SHARD)).toEqual(0);

	const hit = new Bank();
	expect(addUnchargedFirstAgeShards(hit, 2, () => true)).toEqual(2);
	expect(hit.amount(FirstAgeItem.UNCHARGED_SHARD)).toEqual(2);

	const elder = ClueTiers.find(tier => tier.name === 'Elder');
	expect(elder).toBeTruthy();
	expect(ElderClueTable.allItems).toContain(FirstAgeItem.UNCHARGED_SHARD);
	expect(elder?.allItems).toContain(FirstAgeItem.UNCHARGED_SHARD);
	const casket = allOpenables.find(openable => openable.id === elder?.id);
	expect(casket?.allItems).toContain(FirstAgeItem.UNCHARGED_SHARD);
});

test('activation lists missing sacrifices, gives one charge per max piece, and blocks extra charges', () => {
	expect(FIRST_AGE_CHARGES_PER_ACTIVATION).toEqual(7);
	expect(firstAgeMaxUpgrades).toHaveLength(FIRST_AGE_CHARGES_PER_ACTIVATION);

	const none = planActivation({ sacrificed: new Bank(), unchargedOwned: 1, chargedOwned: 0 });
	expect(none.ok).toEqual(false);
	if (!none.ok) {
		expect(none.message).toContain('Lumberjack hat or Forestry hat');
		expect(none.message).toContain('Pyromancer hood');
		expect(none.message.length).toBeLessThan(1900);
	}

	const forestryOnly = new Bank().add('Forestry hat');
	const missing = missingFirstAgeSacrifices(forestryOnly);
	expect(missing.some(slot => slot.label === 'Lumberjack hat or Forestry hat')).toEqual(false);
	expect(formatMissingSacrifices(missing)).not.toContain('Lumberjack hat or Forestry hat');

	const almost = sacrificedAll(['Pyromancer hood']);
	const almostPlan = planActivation({ sacrificed: almost, unchargedOwned: 1, chargedOwned: 0 });
	expect(almostPlan.ok).toEqual(false);
	if (!almostPlan.ok) {
		expect(almostPlan.message).toContain('Pyromancer hood');
		expect(almostPlan.message).not.toContain('Lumberjack hat or Forestry hat');
	}

	const ready = sacrificedAll();
	expect(missingFirstAgeSacrifices(ready)).toEqual([]);
	const noShard = planActivation({ sacrificed: ready, unchargedOwned: 0, chargedOwned: 0 });
	expect(noShard.ok).toEqual(false);
	if (!noShard.ok) expect(noShard.message).toContain('Uncharged first age shard');

	const activated = planActivation({ sacrificed: ready, unchargedOwned: 1, chargedOwned: 0 });
	expect(activated).toEqual({ ok: true, charges: 7 });

	const stockpile = planActivation({ sacrificed: ready, unchargedOwned: 5, chargedOwned: 1 });
	expect(stockpile.ok).toEqual(false);
	if (!stockpile.ok) expect(stockpile.message).toContain('Charged first age');
	const fullSet = planActivation({ sacrificed: ready, unchargedOwned: 1, chargedOwned: 7 });
	expect(fullSet.ok).toEqual(false);
});

test('creating a max piece consumes one charged shard and the base piece', () => {
	const upgrade = planMaxUpgrade(new Bank().add(FirstAgeItem.CHARGED_SHARD, 3).add('First age tiara'), 'tiara');
	expect('remove' in upgrade).toEqual(true);
	if (!('remove' in upgrade)) return;
	expect(upgrade.remove.amount(FirstAgeItem.CHARGED_SHARD)).toEqual(1);
	expect(upgrade.remove.amount('First age tiara')).toEqual(1);
	expect(upgrade.add.amount('First age tiara (max)')).toEqual(1);

	const after = new Bank()
		.add(FirstAgeItem.CHARGED_SHARD, 3)
		.add('First age tiara')
		.remove(upgrade.remove)
		.add(upgrade.add);
	expect(after.amount(FirstAgeItem.CHARGED_SHARD)).toEqual(2);
	expect(after.amount('First age tiara')).toEqual(0);
	expect(after.amount('First age tiara (max)')).toEqual(1);

	expect('error' in planMaxUpgrade(new Bank().add('First age tiara'), 'tiara')).toEqual(true);
	expect('error' in planMaxUpgrade(new Bank().add(FirstAgeItem.CHARGED_SHARD), 'robe_bottom')).toEqual(true);

	for (const piece of firstAgeMaxUpgrades) {
		const creatable = Createables.find(entry => entry.name === piece.maxName);
		expect(creatable, piece.maxName).toBeTruthy();
		const input = creatable!.inputItems;
		const output = creatable!.outputItems;
		if (!(input instanceof Bank) || !(output instanceof Bank)) {
			throw new Error(`${piece.maxName} creatable cost must be a bank`);
		}
		expect(input.amount(FirstAgeItem.CHARGED_SHARD), piece.maxName).toEqual(1);
		expect(input.amount(piece.baseId), piece.maxName).toEqual(1);
		expect(output.amount(piece.maxId), piece.maxName).toEqual(1);
	}
});

test('the charged shard cannot be transferred and the uncharged shard and max pieces can', () => {
	const charged = Items.getOrThrow(FirstAgeItem.CHARGED_SHARD);
	expect(charged.name).toEqual('Charged first age shard');
	expect(charged.tradeable).toEqual(false);
	expect(charged.tradeable_on_ge).toEqual(false);
	expect(charged.customItemData?.isSuperUntradeable).toEqual(true);
	expect(charged.customItemData?.cantBeSacrificed).toEqual(true);
	expect(charged.customItemData?.cantDropFromMysteryBoxes).toEqual(true);
	expect(charged.equipable).toBeFalsy();
	expect(itemIsTradeable(charged.id)).toEqual(false);
	expect(isSuperUntradeable(charged.id)).toEqual(true);
	expect(isGEUntradeable(charged.id)).toEqual(true);
	expect(mysteryBoxBlacklist).toContain(charged.id);
	expect(tmbTable).not.toContain(charged.id);
	expect(umbTable).not.toContain(charged.id);
	expect(embTable).not.toContain(charged.id);

	const uncharged = Items.getOrThrow(FirstAgeItem.UNCHARGED_SHARD);
	expect(uncharged.name).toEqual('Uncharged first age shard');
	expect(uncharged.id).toEqual(74_100);
	expect(uncharged.tradeable).toEqual(true);
	expect(uncharged.tradeable_on_ge).toEqual(true);
	expect(uncharged.customItemData?.isSuperUntradeable ?? false).toEqual(false);
	expect(itemIsTradeable(uncharged.id)).toEqual(true);
	expect(isSuperUntradeable(uncharged.id)).toEqual(false);
	expect(isGEUntradeable(uncharged.id)).toEqual(false);
	expect(tmbTable).not.toContain(uncharged.id);
	expect(umbTable).not.toContain(uncharged.id);

	expect(FIRST_AGE_MAX_PIECES_TRADEABLE).toEqual(true);
	for (const piece of firstAgeMaxUpgrades) {
		const item = Items.getOrThrow(piece.maxId);
		expect(item.name).toEqual(piece.maxName);
		expect(item.tradeable, piece.maxName).toEqual(true);
		expect(item.tradeable_on_ge, piece.maxName).toEqual(true);
		expect(itemIsTradeable(item.id), piece.maxName).toEqual(true);
		expect(isSuperUntradeable(item.id), piece.maxName).toEqual(false);
		expect(item.equipment, piece.maxName).toBeTruthy();
	}
});

test('the First Age collection log lists both shards and the seven max pieces', () => {
	const page = allCollectionLogs.Skilling.activities['First Age'];
	expect(page.alias).toEqual(['firstage', 'first age']);
	expect(page.items).toEqual(firstAgeCL);
	expect(firstAgeCL).toEqual([
		FirstAgeItem.UNCHARGED_SHARD,
		FirstAgeItem.CHARGED_SHARD,
		...firstAgeMaxUpgrades.map(piece => piece.maxId)
	]);
	expect(new Set(firstAgeCL).size).toEqual(firstAgeCL.length);
	const elderPage = allCollectionLogs.Clues?.activities?.['Elder Treasure Trails'];
	expect(elderPage?.items).toContain(FirstAgeItem.UNCHARGED_SHARD);
});

test('a max piece still counts as the base First Age piece', () => {
	const gear = new Gear();
	gear.equip('First age tiara (max)');
	expect(gear.hasEquipped('First age tiara')).toEqual(true);
	expect(gear.hasEquipped('First age tiara (max)')).toEqual(true);
	expect(gear.hasEquipped('First age amulet')).toEqual(false);
});
