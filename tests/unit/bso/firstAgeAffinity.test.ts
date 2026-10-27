import {
	FIRST_AGE_MAX_SEAL_SHARD_COST,
	firstAgeAffinities,
	firstAgeMaxUpgrades,
	isAffinityActive,
	planAbsorb,
	planSeal,
	planUpgrade
} from '@/lib/bso/firstAge/affinities.js';

import { Bank, Items } from 'oldschooljs';
import { expect, test } from 'vitest';

import { FIRST_AGE_MAX_PIECES_TRADEABLE, FirstAgeItem } from '@/lib/customItems/firstAge.js';
import { calcAnglerBoostPercent } from '@/lib/skilling/skills/fishing/fishingUtil.js';
import { Gear } from '@/lib/structures/Gear.js';
import itemIsTradeable from '@/lib/util/itemIsTradeable.js';
import { makeGearBank } from '../utils.js';

test('affinity table ids, tokens, and max pieces are unique', () => {
	expect(new Set(firstAgeAffinities.map(affinity => affinity.id)).size).toEqual(firstAgeAffinities.length);
	expect(new Set(firstAgeAffinities.map(affinity => affinity.tokenId)).size).toEqual(firstAgeAffinities.length);
	expect(firstAgeMaxUpgrades).toHaveLength(7);
	expect(new Set(firstAgeMaxUpgrades.map(piece => piece.maxId)).size).toEqual(7);
	expect(new Set(firstAgeMaxUpgrades.map(piece => piece.maxName)).size).toEqual(7);
});

test('absorb takes one item per slot, including an alternate, and rejects a partial outfit', () => {
	const bank = new Bank().add('Lumberjack hat').add('Forestry top').add('Lumberjack legs').add('Lumberjack boots');
	const plan = planAbsorb(bank, 'lumberjack');
	expect('remove' in plan).toEqual(true);
	if (!('remove' in plan)) return;
	expect(plan.remove.amount('Lumberjack hat')).toEqual(1);
	expect(plan.remove.amount('Forestry top')).toEqual(1);
	expect(plan.remove.amount('Lumberjack legs')).toEqual(1);
	expect(plan.remove.amount('Lumberjack boots')).toEqual(1);
	expect(plan.affinity.shardValue).toEqual(40);

	const missing = planAbsorb(new Bank().add('Lumberjack hat'), 'lumberjack');
	expect('error' in missing).toEqual(true);
});

test('an affinity is active only when unlocked and any First Age piece is worn', () => {
	const locked = makeGearBank();
	locked.gear.skilling.equip('First age tiara');
	expect(isAffinityActive(locked, 'angler')).toEqual(false);

	const unworn = makeGearBank();
	unworn.firstAgeAffinities = [FirstAgeItem.ANGLER_TOKEN];
	expect(isAffinityActive(unworn, 'angler')).toEqual(false);

	const worn = makeGearBank();
	worn.firstAgeAffinities = [FirstAgeItem.ANGLER_TOKEN];
	worn.gear.skilling.equip('First age tiara');
	expect(isAffinityActive(worn, 'angler')).toEqual(true);
	expect(isAffinityActive(worn, 'lumberjack')).toEqual(false);

	const maxPiece = makeGearBank();
	maxPiece.firstAgeAffinities = [FirstAgeItem.ANGLER_TOKEN];
	maxPiece.gear.melee.equip('First age tiara (max)');
	expect(isAffinityActive(maxPiece, 'angler')).toEqual(true);
});

test('a max piece counts as the base First Age piece', () => {
	const gear = new Gear();
	gear.equip('First age tiara (max)');
	expect(gear.hasEquipped('First age tiara')).toEqual(true);
	expect(gear.hasEquipped('First age tiara (max)')).toEqual(true);
	expect(gear.hasEquipped('First age amulet')).toEqual(false);
});

test('angler affinity is the full 2.5% once and does not stack with the outfit', () => {
	const affinityOnly = makeGearBank();
	affinityOnly.firstAgeAffinities = [FirstAgeItem.ANGLER_TOKEN];
	affinityOnly.gear.skilling.equip('First age cape');
	expect(calcAnglerBoostPercent(affinityOnly)).toEqual(2.5);

	const stacked = makeGearBank();
	stacked.firstAgeAffinities = [FirstAgeItem.ANGLER_TOKEN];
	stacked.gear.skilling.equip('First age cape');
	stacked.gear.skilling.equip('Angler hat');
	stacked.gear.skilling.equip('Angler top');
	stacked.gear.skilling.equip('Angler waders');
	stacked.gear.skilling.equip('Angler boots');
	expect(calcAnglerBoostPercent(stacked)).toEqual(2.5);

	const pieceOnly = makeGearBank();
	pieceOnly.gear.skilling.equip('Angler hat');
	expect(calcAnglerBoostPercent(pieceOnly)).toEqual(0.4);

	const unlockedButNotWorn = makeGearBank();
	unlockedButNotWorn.firstAgeAffinities = [FirstAgeItem.ANGLER_TOKEN];
	unlockedButNotWorn.gear.skilling.equip('Angler hat');
	expect(calcAnglerBoostPercent(unlockedButNotWorn)).toEqual(0.4);
});

test('the seven max pieces are tradeable and the shard and seal are not', () => {
	expect(FIRST_AGE_MAX_PIECES_TRADEABLE).toEqual(true);
	for (const piece of firstAgeMaxUpgrades) {
		const item = Items.getOrThrow(piece.maxName);
		expect(item.id).toEqual(piece.maxId);
		expect(itemIsTradeable(item.id), piece.maxName).toEqual(true);
		expect(item.tradeable, piece.maxName).toEqual(true);
		expect(item.tradeable_on_ge, piece.maxName).toEqual(true);
		expect(item.customItemData?.isSuperUntradeable ?? false, piece.maxName).toEqual(false);
		expect(item.equipment, piece.maxName).toBeTruthy();
	}
	expect(itemIsTradeable(FirstAgeItem.AFFINITY_SHARD)).toEqual(false);
	expect(itemIsTradeable(FirstAgeItem.MAX_SEAL)).toEqual(false);
	expect(itemIsTradeable(FirstAgeItem.LUMBERJACK_TOKEN)).toEqual(false);
});

test('the max seal costs 30 shards after every affinity, and an upgrade consumes one seal plus the base piece', () => {
	const unlocked = firstAgeAffinities.map(affinity => affinity.tokenId);
	const ready = planSeal(new Bank().add(FirstAgeItem.AFFINITY_SHARD, FIRST_AGE_MAX_SEAL_SHARD_COST), unlocked, 1);
	expect(ready).toEqual({ quantity: 1, cost: FIRST_AGE_MAX_SEAL_SHARD_COST });

	const locked = planSeal(new Bank().add(FirstAgeItem.AFFINITY_SHARD, 500), [], 1);
	expect('error' in locked).toEqual(true);

	const short = planSeal(new Bank().add(FirstAgeItem.AFFINITY_SHARD, FIRST_AGE_MAX_SEAL_SHARD_COST - 1), unlocked, 1);
	expect('error' in short).toEqual(true);

	const upgrade = planUpgrade(new Bank().add(FirstAgeItem.MAX_SEAL).add('First age tiara'), 'tiara');
	expect('upgrade' in upgrade).toEqual(true);
	if ('upgrade' in upgrade) {
		expect(upgrade.upgrade.maxName).toEqual('First age tiara (max)');
	}

	const noPiece = planUpgrade(new Bank().add(FirstAgeItem.MAX_SEAL), 'robe_bottom');
	expect('error' in noPiece).toEqual(true);
});
