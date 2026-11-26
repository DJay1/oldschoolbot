import { Time } from '@oldschoolgg/toolkit';
import { Bank, EItem, Monsters } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { desertTreasureKillableBosses } from '@/lib/minions/data/killableMonsters/bosses/dt.js';
import type { CurrentSlayerInfo } from '@/lib/slayer/slayerUtil.js';
import { KCBank } from '@/lib/structures/KCBank.js';
import { UpdateBank } from '@/lib/structures/UpdateBank.js';
import { doMonsterTrip } from '@/tasks/minions/monsterActivity.js';
import { makeGearBank } from './utils.js';

const duke = desertTreasureKillableBosses.find(m => m.id === Monsters.DukeSucellus.id)!;
const frozenTablet = EItem.FROZEN_TABLET;
const maxMessage = 2000;

function alwaysRoll() {
	return {
		roll: () => true,
		randInt: (min: number) => min,
		randFloat: (min: number) => min,
		rand: () => 0,
		shuffle: <T>(array: T[]) => array,
		pick: <T>(array: T[]) => array[0],
		percentChance: () => false
	};
}

function neverRoll() {
	return {
		...alwaysRoll(),
		roll: () => false
	};
}

function runEffect({
	quantity,
	bankQty = 0,
	clQty = 0,
	always
}: {
	quantity: number;
	bankQty?: number;
	clQty?: number;
	always: boolean;
}) {
	const bank = new Bank();
	if (bankQty > 0) bank.add(frozenTablet, bankQty);
	const cl = new Bank();
	if (clQty > 0) cl.add(frozenTablet, clQty);
	const updateBank = new UpdateBank();
	const result = duke.effect!({
		quantity,
		monster: duke,
		loot: new Bank(),
		gearBank: makeGearBank({ bank }),
		updateBank,
		rng: always ? alwaysRoll() : neverRoll(),
		cl
	});
	return { result, updateBank };
}

function dukeTrip({ bankQty, clQty, kills }: { bankQty: number; clQty: number; kills: number }) {
	const bank = new Bank();
	if (bankQty > 0) bank.add(frozenTablet, bankQty);
	const cl = new Bank();
	if (clQty > 0) cl.add(frozenTablet, clQty);
	const slayerInfo = {
		currentTask: null,
		assignedTask: null,
		slayerMaster: null,
		slayerPoints: 0,
		statsWithStreaks: null
	} as unknown as CurrentSlayerInfo;

	return doMonsterTrip({
		type: 'MonsterKilling',
		monster: duke,
		q: kills,
		duration: Time.Minute * 30,
		hasEliteCA: false,
		hasKourendHard: false,
		hasKourendElite: false,
		kcBank: new KCBank(),
		gearBank: makeGearBank({ bank }),
		slayerInfo,
		slayerUnlocks: [],
		tertiaryItemPercentageChanges: new Map(),
		attackStyles: [],
		bitfield: [],
		cl,
		disabledInventions: [],
		stats: { onTaskMonsterScores: {}, onTaskWithMaskMonsterScores: {} },
		rng: neverRoll()
	} as Parameters<typeof doMonsterTrip>[0]);
}

describe('DT2 tablet effect', () => {
	test('rolls a tablet at 1/25 if you do not already have one', () => {
		const { result, updateBank } = runEffect({ quantity: 1, always: true });
		expect(result?.loot?.amount(frozenTablet)).toBe(1);
		expect(result?.messages.some(m => m.includes('You got a Frozen tablet!'))).toBe(true);
		expect(updateBank.itemLootBank.amount(frozenTablet)).toBe(0);
		expect(updateBank.collectionLogBank.amount(frozenTablet)).toBe(0);
	});

	test('does not roll a tablet when every 1/25 fails', () => {
		const { result, updateBank } = runEffect({ quantity: 200, always: false });
		expect(result).toBeUndefined();
		expect(updateBank.itemLootBank.amount(frozenTablet)).toBe(0);
		expect(updateBank.collectionLogBank.amount(frozenTablet)).toBe(0);
	});

	test('does not grant another tablet if it is already in the bank and the collection log', () => {
		const { result, updateBank } = runEffect({ quantity: 50, bankQty: 1, clQty: 1, always: true });
		expect(result).toBeUndefined();
		expect(updateBank.itemLootBank.amount(frozenTablet)).toBe(0);
		expect(updateBank.collectionLogBank.amount(frozenTablet)).toBe(0);
	});

	test('credits the collection log if you already have the tablet in the bank but not the log', () => {
		const { result, updateBank } = runEffect({ quantity: 1, bankQty: 100, clQty: 0, always: true });
		expect(result?.loot).toBeUndefined();
		expect(updateBank.itemLootBank.amount(frozenTablet)).toBe(0);
		expect(updateBank.collectionLogBank.amount(frozenTablet)).toBe(1);
		expect(result?.messages).toEqual(['Your Frozen tablet was added to the collection log.']);
		expect(result!.messages[0].length).toBeLessThan(maxMessage - 150);
	});

	test('a Duke trip logs an already-owned tablet without granting another copy', () => {
		const result = dukeTrip({ bankQty: 100, clQty: 0, kills: 5 });
		expect(result.updateBank.itemLootBank.amount(frozenTablet)).toBe(0);
		expect(result.updateBank.collectionLogBank.amount(frozenTablet)).toBe(1);
		expect(result.messages.some(m => m === 'Your Frozen tablet was added to the collection log.')).toBe(true);
	});

	test('a Duke trip does not mass-grant tablets to someone who does not have one', () => {
		const result = dukeTrip({ bankQty: 0, clQty: 0, kills: 5 });
		expect(result.updateBank.itemLootBank.amount(frozenTablet)).toBe(0);
		expect(result.updateBank.collectionLogBank.amount(frozenTablet)).toBe(0);
		expect(result.messages.some(m => m.toLowerCase().includes('frozen tablet'))).toBe(false);
	});
});
