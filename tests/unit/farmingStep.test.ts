import type { RNGProvider } from 'node-rng';
import { Bank, convertLVLtoXP } from 'oldschooljs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import './setup.js';

import { Farming } from '../../src/lib/skilling/skills/farming/index.js';
import type { IPatchData } from '../../src/lib/skilling/skills/farming/utils/types.js';
import type { FarmingActivityTaskOptions } from '../../src/lib/types/minions.js';
import {
	applyBSOPostHarvestLoot,
	applyFarmingLootBoosts,
	completeFarmingContractIfEligible,
	executeFarmingStep,
	formatFarmingContractRewardMessage
} from '../../src/tasks/minions/farmingStep.js';
import { mockMUser } from './userutil.js';
import '../../src/lib/util/clientSettings.js';

describe('farmingStep tree fee handling', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('refunds excess prepaid tree removal fee when actual fee is lower', async () => {
		const user = mockMUser({
			id: '123',
			skills_woodcutting: convertLVLtoXP(1),
			GP: 0
		});
		const addItemsToBankSpy = vi.spyOn(user, 'addItemsToBank').mockResolvedValue(undefined as any);
		const removeItemsFromBankSpy = vi.spyOn(user, 'removeItemsFromBank').mockResolvedValue(undefined as any);
		vi.spyOn(user, 'addXP').mockImplementation(async params => {
			params.amount *= 5;
			return '';
		});
		vi.spyOn(user, 'update').mockResolvedValue(user);
		vi.spyOn(user, 'statsBankUpdate').mockResolvedValue(undefined);
		vi.spyOn(global.ClientSettings, 'updateBankSetting').mockResolvedValue();
		const transactResult = {
			newUser: user,
			itemsAdded: new Bank(),
			itemsRemoved: new Bank(),
			newBank: user.bank.clone(),
			newCL: user.cl.clone(),
			previousCL: new Bank(),
			clLootBank: null
		} satisfies Awaited<ReturnType<typeof user.transactItems>>;
		vi.spyOn(user, 'transactItems').mockResolvedValue(transactResult);

		const patchType: IPatchData = {
			lastPlanted: 'Oak tree',
			patchPlanted: true,
			plantTime: Date.now() - 1000,
			lastQuantity: 1,
			lastUpgradeType: null,
			lastPayment: true
		};

		const data: FarmingActivityTaskOptions = {
			type: 'Farming',
			userID: user.id,
			channelId: 'test-channel',
			id: 1,
			finishDate: Date.now() + 60_000,
			plantsName: 'Oak tree',
			quantity: 1,
			upgradeType: null,
			payment: false,
			treeChopFeePaid: 400,
			treeChopFeePlanned: 400,
			patchType,
			planting: false,
			duration: 60_000,
			currentDate: Date.now(),
			autoFarmed: true
		};

		const rng: RNGProvider = {
			roll: () => false,
			randInt: () => 1,
			randFloat: () => 0,
			rand: () => 0,
			shuffle: <T>(arr: T[]) => arr,
			pick: <T>(arr: T[]) => arr[0],
			percentChance: () => false,
			randomVariation: (value: number) => value
		};

		const result = await executeFarmingStep({
			user,
			channelID: 'test-channel',
			data,
			rng
		});

		expect(result).not.toBeNull();
		expect(result?.message).toContain(`${user}`);
		expect(removeItemsFromBankSpy).not.toHaveBeenCalled();
		expect(addItemsToBankSpy).toHaveBeenCalledTimes(1);
		const refundArg = addItemsToBankSpy.mock.calls[0]?.[0] as { items: Bank } | undefined;
		expect(refundArg?.items.amount('Coins')).toBe(200);
		expect(result?.message).toContain('200 GP was refunded');
		expect(result?.summary?.xp.totalFarming).toBe(Math.floor(result?.summary?.xp.checkHealth ?? 0) * 5);
	});
});

describe('farmingStep contract Seed pack yield boosts', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	const rng: RNGProvider = {
		roll: () => false,
		randInt: () => 1,
		randFloat: () => 0,
		rand: () => 0,
		shuffle: <T>(arr: T[]) => arr,
		pick: <T>(arr: T[]) => arr[0],
		percentChance: () => false,
		randomVariation: (value: number) => value
	};

	function plantNamed(name: string) {
		const plant = Farming.Plants.find(item => item.name === name);
		if (!plant) throw new Error(`Missing plant ${name}`);
		return plant;
	}

	function contractUser(bank: Bank, plantName: string, materialsOwned?: Record<string, number>) {
		const user = mockMUser({
			id: 'seed-pack-tester',
			bank,
			skills_farming: convertLVLtoXP(99),
			skills_woodcutting: convertLVLtoXP(99)
		});
		const rawUser = user.user as {
			minion_farmingContract: unknown;
			materials_owned?: Record<string, number>;
			disabled_inventions?: number[];
		};
		rawUser.minion_farmingContract = {
			hasContract: true,
			difficultyLevel: 'easy',
			plantToGrow: plantName,
			plantTier: 1,
			contractsCompleted: 10
		};
		rawUser.disabled_inventions = [];
		if (materialsOwned) rawUser.materials_owned = materialsOwned;
		vi.spyOn(user, 'updateFarmingContract').mockResolvedValue(undefined);
		vi.spyOn(user, 'update').mockResolvedValue(user);
		vi.spyOn(global.ClientSettings, 'fetch').mockResolvedValue({ invention_materials_cost: {} } as any);
		vi.spyOn(global.ClientSettings, 'update').mockResolvedValue();
		return user;
	}

	async function completeAndBoost(options: {
		plantName: string;
		bank: Bank;
		materialsOwned?: Record<string, number>;
		applyMysteriousTreeBonus?: boolean;
	}) {
		const plant = plantNamed(options.plantName);
		const user = contractUser(options.bank, options.plantName, options.materialsOwned);
		const loot = new Bank();
		const boosts: string[] = [];
		const completion = await completeFarmingContractIfEligible({
			user,
			loot,
			plantToHarvest: plant,
			alivePlants: 1
		});
		await applyFarmingLootBoosts({
			user,
			method: 'harvest',
			plant,
			quantity: 1,
			loot,
			boosts
		});
		if (options.applyMysteriousTreeBonus) {
			await applyBSOPostHarvestLoot({
				user,
				rng,
				loot,
				infoStr: [],
				plantToHarvest: plant,
				planting: false,
				plant,
				quantity: 1,
				alivePlants: 1
			});
		}
		const janeMessage = completion.completed
			? formatFarmingContractRewardMessage(completion.contractsCompleted ?? 0, loot.amount('Seed pack'))
			: undefined;
		return { loot, boosts, completion, janeMessage };
	}

	it('gives 1 Seed pack with no yield boosts', async () => {
		const { loot, completion, janeMessage } = await completeAndBoost({
			plantName: 'Guam',
			bank: new Bank()
		});
		expect(completion.completed).toBe(true);
		expect(loot.amount('Seed pack')).toBe(1);
		expect(janeMessage).toBe(formatFarmingContractRewardMessage(11, 1));
	});

	it('doubles the contract Seed pack with Plopper (1 to 2)', async () => {
		const { loot, boosts, janeMessage } = await completeAndBoost({
			plantName: 'Guam',
			bank: new Bank().add('Plopper')
		});
		expect(loot.amount('Seed pack')).toBe(2);
		expect(boosts).toContain('100% for Plopper');
		expect(janeMessage).toBe(formatFarmingContractRewardMessage(11, 2));
	});

	it('gives 3 Seed packs with Plopper and Farming master cape', async () => {
		const { loot, boosts, janeMessage } = await completeAndBoost({
			plantName: 'Guam',
			bank: new Bank().add('Plopper').add('Farming master cape')
		});
		expect(loot.amount('Seed pack')).toBe(3);
		expect(boosts).toEqual(expect.arrayContaining(['100% for Plopper', '100% for Farming master cape']));
		expect(janeMessage).toBe(formatFarmingContractRewardMessage(11, 3));
	});

	it('gives 4 Seed packs with Plopper, Farming master cape, and Arcane harvester', async () => {
		const { loot, boosts, janeMessage } = await completeAndBoost({
			plantName: 'Guam',
			bank: new Bank().add('Plopper').add('Farming master cape').add('Arcane harvester'),
			materialsOwned: { organic: 100, magic: 100 }
		});
		expect(loot.amount('Seed pack')).toBe(4);
		expect(boosts.some(boost => boost.startsWith('100% bonus yield from Arcane Harvester'))).toBe(true);
		expect(janeMessage).toBe(formatFarmingContractRewardMessage(11, 4));
	});

	it('adds the Mysterious tree Seed pack after yield boosts, unmultiplied', async () => {
		const { loot, janeMessage } = await completeAndBoost({
			plantName: 'Mysterious tree',
			bank: new Bank().add('Plopper'),
			applyMysteriousTreeBonus: true
		});
		expect(loot.amount('Seed pack')).toBe(3);
		expect(janeMessage).toBe(formatFarmingContractRewardMessage(11, 3));
	});

	it('keeps Jane contract reward text under the Discord message limit', () => {
		const worstCase = formatFarmingContractRewardMessage(9_999_999_999, 99);
		const prefixed = `Jane: ${worstCase}`;
		expect(worstCase.length).toBeLessThanOrEqual(2000 - 150);
		expect(prefixed.length).toBeLessThanOrEqual(2000 - 150);
	});
});
