import { Time } from '@oldschoolgg/toolkit';
import { MathRNG } from 'node-rng';
import { Bank, EItem, Monsters } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { BitField } from '@/lib/constants.js';
import killableMonsters from '@/lib/minions/data/killableMonsters/index.js';
import type { CurrentSlayerInfo } from '@/lib/slayer/slayerUtil.js';
import { KCBank } from '@/lib/structures/KCBank.js';
import { doMonsterTrip } from '@/tasks/minions/monsterActivity.js';
import { makeGearBank } from './utils.js';

const vorkath = killableMonsters.find(m => m.id === Monsters.Vorkath.id)!;

function vorkathTrip({ kc, kills, bitfield = [] }: { kc: number; kills: number; bitfield?: BitField[] }) {
	const kcBank = new KCBank();
	if (kc > 0) kcBank.add(vorkath.id, kc);
	const slayerInfo = {
		currentTask: null,
		assignedTask: null,
		slayerMaster: null,
		slayerPoints: 0,
		statsWithStreaks: null
	} as unknown as CurrentSlayerInfo;

	return doMonsterTrip({
		type: 'MonsterKilling',
		monster: vorkath,
		q: kills,
		duration: Time.Minute * 30,
		hasEliteCA: false,
		hasKourendHard: false,
		hasKourendElite: false,
		kcBank,
		gearBank: makeGearBank(),
		slayerInfo,
		slayerUnlocks: [],
		tertiaryItemPercentageChanges: new Map(),
		attackStyles: [],
		bitfield,
		cl: new Bank(),
		disabledInventions: [],
		stats: { onTaskMonsterScores: {}, onTaskWithMaskMonsterScores: {} },
		rng: MathRNG
	} as Parameters<typeof doMonsterTrip>[0]);
}

function guaranteedHeadGiven(result: ReturnType<typeof vorkathTrip>) {
	return result.messages.some(m => m.includes("guaranteed Vorkath's head"));
}

describe("guaranteed Vorkath's head", () => {
	test('reaching 50 kills gives the head and sets the flag', () => {
		const result = vorkathTrip({ kc: 49, kills: 2 });
		expect(guaranteedHeadGiven(result)).toBe(true);
		expect(result.updateBank.itemLootBank.amount(EItem.VORKATHS_HEAD)).toBeGreaterThanOrEqual(1);
		expect(result.updateBank.userUpdates.bitfield).toEqual({ push: BitField.ReceivedGuaranteedVorkathHead });
	});

	test('players already past 50 kills get it on their next trip', () => {
		const result = vorkathTrip({ kc: 300, kills: 1 });
		expect(guaranteedHeadGiven(result)).toBe(true);
		expect(result.updateBank.userUpdates.bitfield).toEqual({ push: BitField.ReceivedGuaranteedVorkathHead });
	});

	test('players who already got it do not get another', () => {
		const result = vorkathTrip({ kc: 300, kills: 5, bitfield: [BitField.ReceivedGuaranteedVorkathHead] });
		expect(guaranteedHeadGiven(result)).toBe(false);
		expect(result.updateBank.userUpdates.bitfield).toBeUndefined();
	});

	test('players under 50 kills do not get it yet', () => {
		const result = vorkathTrip({ kc: 10, kills: 5 });
		expect(guaranteedHeadGiven(result)).toBe(false);
		expect(result.updateBank.userUpdates.bitfield).toBeUndefined();
	});
});
