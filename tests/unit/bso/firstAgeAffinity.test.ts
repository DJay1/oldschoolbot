import { masterFarmerOutfit } from '@/lib/bso/bsoConstants.js';
import { isGEUntradeable, isSuperUntradeable } from '@/lib/bso/bsoUtil.js';
import { firstAgeCL } from '@/lib/bso/collection-log/firstAge.js';
import { ElderClueTable } from '@/lib/bso/elderClue.js';
import { elderRequiredClueCLItems } from '@/lib/bso/elderClueRequirements.js';
import {
	addUnchargedFirstAgeShards,
	CLUE_CASKET_DOUBLE_RATE,
	FIRST_AGE_CHARGED_SHARD_GP_COST,
	firstAgeMaxUpgrades,
	firstAgeXpBonusPercent,
	formatMissingSacrifices,
	getFirstAgeSacrificeSlots,
	isWearingFullFirstAgeMaxSet,
	missingFirstAgeSacrifices,
	namedOutfitXpLine,
	planChargedShardCreate,
	planMaxUpgrade,
	UNCHARGED_FIRST_AGE_SHARD_DROP_RATE
} from '@/lib/bso/firstAge/shards.js';
import { resolveSkillOutfitXp, skillXpBonusClauses } from '@/lib/bso/firstAge/skillOutfits.js';
import { mysteryBoxBlacklist } from '@/lib/bso/openables/mysteryBoxBlacklist.js';
import { embTable, tmbTable, umbTable } from '@/lib/bso/openables/mysteryBoxes.js';

import { Bank, ItemGroups, Items, itemID } from 'oldschooljs';
import { expect, test } from 'vitest';

import { ClueTiers } from '@/lib/clues/clueTiers.js';
import { FIRST_AGE_MAX_PIECES_TRADEABLE, FirstAgeItem } from '@/lib/customItems/firstAge.js';
import { allCollectionLogs } from '@/lib/data/Collections.js';
import Createables from '@/lib/data/createables.js';
import { getSimilarItems } from '@/lib/data/similarItems.js';
import { allOpenables } from '@/lib/openables.js';
import { raimentBonus } from '@/lib/skilling/functions/calcsRunecrafting.js';
import { Farming } from '@/lib/skilling/skills/farming/index.js';
import { calcNumOfPatches } from '@/lib/skilling/skills/farming/utils/calcsFarming.js';
import { calcAnglerBoostPercent } from '@/lib/skilling/skills/fishing/fishingUtil.js';
import Runecraft from '@/lib/skilling/skills/runecraft.js';
import { rogueOutfitPercentBonus } from '@/lib/skilling/skills/thieving/thievingUtils.js';
import { Gear } from '@/lib/structures/Gear.js';
import type { GearBank } from '@/lib/structures/GearBank.js';
import itemIsTradeable from '@/lib/util/itemIsTradeable.js';
import { wintertodtWarmPieceCount } from '@/mahoji/lib/abstracted_commands/wintertodtCommand.js';
import { FIRST_AGE_CASKET_DOUBLE_MESSAGE, firstAgeCasketDouble } from '@/tasks/minions/clueActivity.js';
import { zealOutfitBoost } from '@/tasks/minions/PrayerActivity/offeringActivity.js';
import { makeGearBank } from '../utils.js';

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

test('charging a shard needs every sacrifice, one uncharged shard, and 100b coins', () => {
	expect(FIRST_AGE_CHARGED_SHARD_GP_COST).toEqual(100_000_000_000);
	expect(firstAgeMaxUpgrades).toHaveLength(7);

	const none = planChargedShardCreate({
		sacrificed: new Bank(),
		unchargedOwned: 1,
		gp: FIRST_AGE_CHARGED_SHARD_GP_COST
	});
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
	const almostPlan = planChargedShardCreate({
		sacrificed: almost,
		unchargedOwned: 1,
		gp: FIRST_AGE_CHARGED_SHARD_GP_COST
	});
	expect(almostPlan.ok).toEqual(false);
	if (!almostPlan.ok) {
		expect(almostPlan.message).toContain('Pyromancer hood');
		expect(almostPlan.message).not.toContain('Lumberjack hat or Forestry hat');
	}

	const ready = sacrificedAll();
	expect(missingFirstAgeSacrifices(ready)).toEqual([]);
	const noShard = planChargedShardCreate({
		sacrificed: ready,
		unchargedOwned: 0,
		gp: FIRST_AGE_CHARGED_SHARD_GP_COST
	});
	expect(noShard.ok).toEqual(false);
	if (!noShard.ok) expect(noShard.message).toContain('Uncharged first age shard');

	const noCoins = planChargedShardCreate({ sacrificed: ready, unchargedOwned: 1, gp: 0 });
	expect(noCoins.ok).toEqual(false);
	if (!noCoins.ok) expect(noCoins.message).toContain('100,000,000,000');

	expect(
		planChargedShardCreate({ sacrificed: ready, unchargedOwned: 1, gp: FIRST_AGE_CHARGED_SHARD_GP_COST })
	).toEqual({
		ok: true
	});

	const creatable = Createables.find(entry => entry.name === 'Charged first age shard');
	expect(creatable).toBeTruthy();
	const input = creatable!.inputItems;
	const output = creatable!.outputItems;
	if (!(input instanceof Bank) || !(output instanceof Bank)) {
		throw new Error('Charged shard creatable cost must be a bank');
	}
	expect(input.amount(FirstAgeItem.UNCHARGED_SHARD)).toEqual(1);
	expect(input.amount('Coins')).toEqual(FIRST_AGE_CHARGED_SHARD_GP_COST);
	expect(output.amount(FirstAgeItem.CHARGED_SHARD)).toEqual(1);
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

function equipMaxSet(gear: Gear, skip?: string) {
	for (const piece of firstAgeMaxUpgrades) {
		if (piece.maxName === skip) continue;
		gear.equip(piece.maxName);
	}
}

function equipBaseSet(gear: Gear) {
	for (const piece of firstAgeMaxUpgrades) {
		gear.equip(piece.baseName);
	}
}

function asUser(gearBank: GearBank): MUser {
	return {
		gear: gearBank.gear,
		gearBank,
		bank: gearBank.bank,
		bitfield: [],
		skillsAsLevels: gearBank.skillsAsLevels,
		cl: new Bank(),
		user: { finished_quest_ids: [] },
		hasEquipped(item: number | string | (string | number)[], every = false) {
			return gearBank.hasEquipped(item, every);
		},
		hasEquippedOrInBank(item: string | number | (string | number)[], type?: 'every' | 'one') {
			return gearBank.hasEquippedOrInBank(item, type);
		}
	} as unknown as MUser;
}

test('the full First Age (max) set grants each outfit bonus once, and 6 of 7 grants none', () => {
	const maxOnly = makeGearBank();
	equipMaxSet(maxOnly.gear.melee);
	expect(isWearingFullFirstAgeMaxSet(maxOnly)).toEqual(true);
	expect(calcAnglerBoostPercent(maxOnly)).toEqual(2.5);

	const six = makeGearBank();
	equipMaxSet(six.gear.melee, 'First age robe bottom (max)');
	expect(isWearingFullFirstAgeMaxSet(six)).toEqual(false);
	expect(calcAnglerBoostPercent(six)).toEqual(0);

	const basePieces = makeGearBank();
	equipBaseSet(basePieces.gear.melee);
	expect(isWearingFullFirstAgeMaxSet(basePieces)).toEqual(false);
	expect(calcAnglerBoostPercent(basePieces)).toEqual(0);

	const anglerOnly = makeGearBank();
	for (const piece of ['Angler hat', 'Angler top', 'Angler waders', 'Angler boots']) {
		anglerOnly.gear.skilling.equip(piece);
	}
	expect(calcAnglerBoostPercent(anglerOnly)).toEqual(2.5);

	const both = makeGearBank();
	equipMaxSet(both.gear.melee);
	for (const piece of ['Angler hat', 'Angler top', 'Angler waders', 'Angler boots']) {
		both.gear.skilling.equip(piece);
	}
	expect(calcAnglerBoostPercent(both)).toEqual(calcAnglerBoostPercent(anglerOnly));

	const maxPlusOneAngler = makeGearBank();
	equipMaxSet(maxPlusOneAngler.gear.melee);
	maxPlusOneAngler.gear.skilling.equip('Angler hat');
	expect(calcAnglerBoostPercent(maxPlusOneAngler)).toEqual(2.5);

	const fullRogue = ItemGroups.rogueOutfit.length * 20;
	const rogueOnly = makeGearBank();
	for (const id of ItemGroups.rogueOutfit) rogueOnly.gear.skilling.equip(id);
	expect(rogueOutfitPercentBonus(asUser(rogueOnly))).toEqual(fullRogue);
	expect(rogueOutfitPercentBonus(asUser(maxOnly))).toEqual(fullRogue);
	const rogueAndMax = makeGearBank();
	equipMaxSet(rogueAndMax.gear.melee);
	for (const id of ItemGroups.rogueOutfit) rogueAndMax.gear.skilling.equip(id);
	expect(rogueOutfitPercentBonus(asUser(rogueAndMax))).toEqual(fullRogue);
	expect(rogueOutfitPercentBonus(asUser(six))).toEqual(0);

	const fullZeal = ItemGroups.zealOutfit.length * 1.25;
	const zealOnly = makeGearBank();
	for (const id of ItemGroups.zealOutfit) zealOnly.bank.add(id);
	expect(zealOutfitBoost(asUser(zealOnly)).zealOutfitChance).toEqual(fullZeal);
	expect(zealOutfitBoost(asUser(maxOnly)).zealOutfitChance).toEqual(fullZeal);
	const zealAndMax = makeGearBank();
	equipMaxSet(zealAndMax.gear.melee);
	for (const id of ItemGroups.zealOutfit) zealAndMax.bank.add(id);
	expect(zealOutfitBoost(asUser(zealAndMax)).zealOutfitChance).toEqual(fullZeal);
	expect(zealOutfitBoost(asUser(six)).zealOutfitChance).toEqual(0);

	const raimentIds = Object.keys(Runecraft.raimentsOfTheEyeItems).map(id => Number.parseInt(id));
	const raimentsOnly = makeGearBank();
	for (const id of raimentIds) raimentsOnly.bank.add(id);
	expect(raimentBonus(asUser(raimentsOnly), 100)).toEqual(60);
	expect(raimentBonus(asUser(maxOnly), 100)).toEqual(60);
	const raimentsAndMax = makeGearBank();
	equipMaxSet(raimentsAndMax.gear.melee);
	for (const id of raimentIds) raimentsAndMax.bank.add(id);
	expect(raimentBonus(asUser(raimentsAndMax), 100)).toEqual(60);
	expect(raimentBonus(asUser(six), 100)).toEqual(0);

	const herb = Farming.Plants.find(plant => plant.seedType === 'herb');
	expect(herb).toBeTruthy();
	const patches = (gearBank: GearBank) => calcNumOfPatches(herb!, asUser(gearBank), 0)[0];
	const bare = makeGearBank();
	const farmerOnly = makeGearBank();
	for (const id of masterFarmerOutfit) farmerOnly.bank.add(id);
	const farmerAndMax = makeGearBank();
	equipMaxSet(farmerAndMax.gear.melee);
	for (const id of masterFarmerOutfit) farmerAndMax.bank.add(id);
	expect(patches(maxOnly) - patches(bare)).toEqual(3);
	expect(patches(farmerOnly) - patches(bare)).toEqual(3);
	expect(patches(farmerAndMax) - patches(bare)).toEqual(3);
	expect(patches(six) - patches(bare)).toEqual(0);
});

test('the full max set doubles every clue tier casket at Zippy rate, after Zippy has already doubled them', () => {
	expect(CLUE_CASKET_DOUBLE_RATE).toEqual(15);
	// Same markdown as `Zippy has **doubled** your loot.`
	expect(FIRST_AGE_CASKET_DOUBLE_MESSAGE).toEqual('Your First Age (max) set **doubled** your clue casket!');

	const elder = ClueTiers.find(tier => tier.name === 'Elder')!;
	const easy = ClueTiers.find(tier => tier.name === 'Easy')!;

	const elderOnly = firstAgeCasketDouble({
		wearingFullMaxSet: true,
		rolledDouble: true,
		loot: new Bank().add(elder.id, 1)
	});
	expect(elderOnly.extraCaskets.amount(elder.id)).toEqual(1);
	expect(elderOnly.extraCaskets.length).toEqual(1);
	expect(elderOnly.message).toEqual(FIRST_AGE_CASKET_DOUBLE_MESSAGE);

	// Zippy first: 1 elder casket becomes 2. The set then adds another 2, for 4.
	const elderAfterZippy = new Bank().add(elder.id, 1);
	elderAfterZippy.multiply(2);
	const elderSet = firstAgeCasketDouble({
		wearingFullMaxSet: true,
		rolledDouble: true,
		loot: elderAfterZippy
	});
	expect(elderSet.extraCaskets.amount(elder.id)).toEqual(2);
	expect(elderSet.message).toEqual(FIRST_AGE_CASKET_DOUBLE_MESSAGE);
	elderAfterZippy.add(elderSet.extraCaskets);
	expect(elderAfterZippy.amount(elder.id)).toEqual(4);

	// Same order on a non-elder tier.
	const easyAfterZippy = new Bank().add(easy.id, 1);
	easyAfterZippy.multiply(2);
	const easySet = firstAgeCasketDouble({
		wearingFullMaxSet: true,
		rolledDouble: true,
		loot: easyAfterZippy
	});
	expect(easySet.extraCaskets.amount(easy.id)).toEqual(2);
	expect(easySet.message).toEqual(FIRST_AGE_CASKET_DOUBLE_MESSAGE);
	easyAfterZippy.add(easySet.extraCaskets);
	expect(easyAfterZippy.amount(easy.id)).toEqual(4);

	const easyOnly = firstAgeCasketDouble({
		wearingFullMaxSet: true,
		rolledDouble: true,
		loot: new Bank().add(easy.id, 5)
	});
	expect(easyOnly.extraCaskets.amount(easy.id)).toEqual(5);
	expect(easyOnly.extraCaskets.amount(elder.id)).toEqual(0);
	expect(easyOnly.message).toEqual(FIRST_AGE_CASKET_DOUBLE_MESSAGE);

	for (const tier of ClueTiers) {
		const result = firstAgeCasketDouble({
			wearingFullMaxSet: true,
			rolledDouble: true,
			loot: new Bank().add(tier.id, 3)
		});
		expect(result.extraCaskets.amount(tier.id), tier.name).toEqual(3);
		expect(result.extraCaskets.length, tier.name).toEqual(1);
		expect(result.message, tier.name).toEqual(FIRST_AGE_CASKET_DOUBLE_MESSAGE);
	}

	// Zippy can put other tiers in the same loot, then double them. The set doubles those caskets too.
	const mixed = new Bank().add(elder.id, 2).add(easy.id, 4).add('Coins', 50).add('Tradeable Mystery Box', 1);
	const mixedResult = firstAgeCasketDouble({
		wearingFullMaxSet: true,
		rolledDouble: true,
		loot: mixed
	});
	expect(mixedResult.extraCaskets.amount(elder.id)).toEqual(2);
	expect(mixedResult.extraCaskets.amount(easy.id)).toEqual(4);
	expect(mixedResult.extraCaskets.amount('Coins')).toEqual(0);
	expect(mixedResult.extraCaskets.amount('Tradeable Mystery Box')).toEqual(0);
	expect(mixedResult.message).toEqual(FIRST_AGE_CASKET_DOUBLE_MESSAGE);
	expect(mixed.amount(elder.id)).toEqual(2);

	expect(
		firstAgeCasketDouble({
			wearingFullMaxSet: true,
			rolledDouble: false,
			loot: new Bank().add(elder.id, 2)
		}).extraCaskets.length
	).toEqual(0);
	expect(
		firstAgeCasketDouble({
			wearingFullMaxSet: false,
			rolledDouble: true,
			loot: new Bank().add(easy.id, 2)
		}).extraCaskets.length
	).toEqual(0);
	expect(
		firstAgeCasketDouble({
			wearingFullMaxSet: true,
			rolledDouble: true,
			loot: new Bank().add('Coins', 10)
		}).message
	).toEqual(null);

	expect(namedOutfitXpLine({ outfit: 'Lumberjack', percent: 2.5, xp: 6435, fromMaxSet: true })).toContain('2.5%');
	expect(namedOutfitXpLine({ outfit: 'Lumberjack', percent: 2.5, xp: 6435, fromMaxSet: true })).toContain(
		'First Age (max) set'
	);
});

test('the full max set grants each skill outfit once, on fishing, mining, and firemaking', () => {
	const maxOnly = makeGearBank();
	equipMaxSet(maxOnly.gear.melee);
	const angler = resolveSkillOutfitXp({
		source: maxOnly,
		skill: 'fishing',
		baseXp: 10_000,
		wearingFullMaxSet: true
	});
	expect(angler?.percent).toEqual(2.5);
	expect(angler?.bonusXp).toEqual(250);
	expect(angler?.fromMaxSet).toEqual(true);
	expect(angler?.line).toEqual(
		'**Angler bonus:** 2.5% (250 XP) from your First Age (max) set, same as the Angler outfit.'
	);

	const prospector = resolveSkillOutfitXp({
		source: maxOnly,
		skill: 'mining',
		baseXp: 8_000,
		wearingFullMaxSet: true
	});
	expect(prospector?.percent).toEqual(2.5);
	expect(prospector?.bonusXp).toEqual(200);
	expect(prospector?.line).toEqual(
		'**Prospector bonus:** 2.5% (200 XP) from your First Age (max) set, same as the Prospector outfit.'
	);

	const pyromancer = resolveSkillOutfitXp({
		source: maxOnly,
		skill: 'firemaking',
		baseXp: 4_000,
		wearingFullMaxSet: true
	});
	expect(pyromancer?.percent).toEqual(2.5);
	expect(pyromancer?.bonusXp).toEqual(100);
	expect(pyromancer?.line).toContain('**Pyromancer bonus:** 2.5%');
	expect(pyromancer?.line).toContain('from your First Age (max) set, same as the Pyromancer outfit.');

	const partialAndSet = makeGearBank();
	equipMaxSet(partialAndSet.gear.melee);
	partialAndSet.gear.skilling.equip('Angler hat');
	const partial = resolveSkillOutfitXp({
		source: partialAndSet,
		skill: 'fishing',
		baseXp: 10_000,
		wearingFullMaxSet: true
	});
	expect(partial?.percent).toEqual(2.5);
	expect(partial?.bonusXp).toEqual(250);
	expect(partial?.fromMaxSet).toEqual(true);

	const both = makeGearBank();
	equipMaxSet(both.gear.melee);
	for (const piece of ['Angler hat', 'Angler top', 'Angler waders', 'Angler boots']) {
		both.gear.skilling.equip(piece);
	}
	const stacked = resolveSkillOutfitXp({
		source: both,
		skill: 'fishing',
		baseXp: 10_000,
		wearingFullMaxSet: true
	});
	expect(stacked?.percent).toEqual(2.5);
	expect(stacked?.bonusXp).toEqual(250);
	expect(stacked?.fromMaxSet).toEqual(false);
	expect(stacked?.line).toContain('from your Angler outfit.');

	const hatOnly = makeGearBank();
	hatOnly.gear.skilling.equip('Angler hat');
	expect(
		resolveSkillOutfitXp({
			source: hatOnly,
			skill: 'fishing',
			baseXp: 10_000,
			wearingFullMaxSet: false
		})?.percent
	).toEqual(0.4);

	expect(
		skillXpBonusClauses(
			'You received 12,000 <:fishing:630911040091193356> XP. You received 10% bonus XP for First age outfit items. **Angler bonus:** 2.5% (250 XP) from your First Age (max) set, same as the Angler outfit. (1.5m/Hr)\n**Congratulations! Your Fishing level is now 50** 🎉'
		)
	).toEqual(
		'You received 10% bonus XP for First age outfit items. **Angler bonus:** 2.5% (250 XP) from your First Age (max) set, same as the Angler outfit.'
	);
});

test('elder clue requirements include both Saradomin and Zamorak cloak ids', () => {
	expect(elderRequiredClueCLItems).toContain(10_446);
	expect(elderRequiredClueCLItems).toContain(10_450);
	expect(elderRequiredClueCLItems).toContain(itemID('Saradomin cloak'));
	expect(elderRequiredClueCLItems).toContain(itemID('Zamorak cloak'));
});

test('a max piece still counts as the base First Age piece', () => {
	const gear = new Gear();
	gear.equip('First age tiara (max)');
	expect(gear.hasEquipped('First age tiara')).toEqual(true);
	expect(gear.hasEquipped('First age tiara (max)')).toEqual(true);
	expect(gear.hasEquipped('First age amulet')).toEqual(false);
	expect(getSimilarItems(itemID('First age cape')).sort((a, b) => a - b)).toEqual(
		[itemID('First age cape'), itemID('First age cape (max)')].sort((a, b) => a - b)
	);
});

test('First Age XP scales per piece, and a missing cape is not filled in by another item', () => {
	const full = new Gear();
	equipMaxSet(full);
	expect(firstAgeXpBonusPercent(full)).toEqual(10);

	const noCape = new Gear();
	equipMaxSet(noCape, 'First age cape (max)');
	expect(noCape.hasEquipped('First age cape')).toEqual(false);
	expect(noCape.hasEquipped('First age cape (max)')).toEqual(false);
	// 4 jewelry pieces (4%) and both robes (1.5% + 1.5% + 1% set) = 8%. The 5-piece +1% is lost with the cape.
	expect(firstAgeXpBonusPercent(noCape)).toEqual(8);
	expect(isWearingFullFirstAgeMaxSet(noCape)).toEqual(false);

	const fireCapeInstead = new Gear();
	equipMaxSet(fireCapeInstead, 'First age cape (max)');
	fireCapeInstead.equip('Fire cape');
	expect(firstAgeXpBonusPercent(fireCapeInstead)).toEqual(8);

	const maxCapeInstead = new Gear();
	equipMaxSet(maxCapeInstead, 'First age cape (max)');
	maxCapeInstead.equip('Max cape');
	expect(firstAgeXpBonusPercent(maxCapeInstead)).toEqual(8);

	const baseCape = new Gear();
	equipMaxSet(baseCape, 'First age cape (max)');
	baseCape.equip('First age cape');
	expect(firstAgeXpBonusPercent(baseCape)).toEqual(10);

	const sixOnMeleeCapeElsewhere = makeGearBank();
	equipMaxSet(sixOnMeleeCapeElsewhere.gear.melee, 'First age cape (max)');
	sixOnMeleeCapeElsewhere.gear.skilling.equip('First age cape (max)');
	// The cape is still worn, but not with the other six, so it does not restore the 10%.
	expect(firstAgeXpBonusPercent(sixOnMeleeCapeElsewhere)).toEqual(8);
	expect(isWearingFullFirstAgeMaxSet(sixOnMeleeCapeElsewhere)).toEqual(false);

	const gearBank = makeGearBank();
	equipMaxSet(gearBank.gear.melee);
	expect(firstAgeXpBonusPercent(gearBank)).toEqual(10);
	expect(calcAnglerBoostPercent(gearBank)).toEqual(2.5);
	expect(isWearingFullFirstAgeMaxSet(gearBank)).toEqual(true);

	const onSkilling = makeGearBank();
	equipMaxSet(onSkilling.gear.skilling);
	expect(firstAgeXpBonusPercent(onSkilling)).toEqual(10);
	expect(isWearingFullFirstAgeMaxSet(onSkilling)).toEqual(true);
});

test('the full max set grants each outfit boost once, including warmth, and six pieces grant none', () => {
	const maxOnly = makeGearBank();
	equipMaxSet(maxOnly.gear.melee);
	const six = makeGearBank();
	equipMaxSet(six.gear.melee, 'First age cape (max)');

	expect(wintertodtWarmPieceCount(asUser(maxOnly))).toEqual(4);
	expect(wintertodtWarmPieceCount(asUser(six))).toEqual(0);

	const pyromancer = makeGearBank();
	for (const piece of ['Pyromancer hood', 'Pyromancer garb', 'Pyromancer robe', 'Pyromancer boots']) {
		pyromancer.gear.skilling.equip(piece);
	}
	expect(wintertodtWarmPieceCount(asUser(pyromancer))).toEqual(4);

	const both = makeGearBank();
	equipMaxSet(both.gear.melee);
	for (const piece of ['Pyromancer hood', 'Pyromancer garb', 'Pyromancer robe', 'Pyromancer boots']) {
		both.gear.skilling.equip(piece);
	}
	expect(wintertodtWarmPieceCount(asUser(both))).toEqual(4);

	const twoWarm = makeGearBank();
	twoWarm.gear.skilling.equip('Fire cape');
	twoWarm.gear.skilling.equip('Pyromancer hood');
	expect(wintertodtWarmPieceCount(asUser(twoWarm))).toEqual(2);
	equipMaxSet(twoWarm.gear.melee);
	expect(wintertodtWarmPieceCount(asUser(twoWarm))).toEqual(4);
});
