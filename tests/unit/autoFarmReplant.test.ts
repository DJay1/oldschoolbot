import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

import './setup.js';

import { Bank, convertLVLtoXP } from 'oldschooljs';

import { autoFarm, buildAutoFarmTripStartMessage, planAutoFarmTrip } from '../../src/lib/minions/functions/autoFarm.js';
import {
	AUTO_FARM_START_MESSAGE_SAFE_LIMIT,
	buildSummaryForStep,
	formatCouldNotReplantLine,
	type PlannedAutoFarmStep
} from '../../src/lib/minions/functions/autoFarmHelpers.js';
import { getPrimarySeedForPlant } from '../../src/lib/skilling/skills/farming/autoFarm/preferences.js';
import { plants } from '../../src/lib/skilling/skills/farming/index.js';
import { farmingPatchNames } from '../../src/lib/skilling/skills/farming/utils/farming.shared.js';
import type { FarmingPatchName } from '../../src/lib/skilling/skills/farming/utils/farmingHelpers.js';
import type { IPatchData, IPatchDataDetailed } from '../../src/lib/skilling/skills/farming/utils/types.js';
import type { FarmingActivityTaskOptions } from '../../src/lib/types/minions.js';
import addSubTaskToActivityTask from '../../src/lib/util/addSubTaskToActivityTask.js';
import * as calcMaxTripLengthModule from '../../src/lib/util/calcMaxTripLength.js';
import { AutoFarmFilterEnum, CropUpgradeType } from '../../src/prisma/main/enums.js';
import type { User } from '../../src/prisma/main.js';
import { mockMUser } from './userutil.js';
import '../../src/lib/util/clientSettings.js';

vi.mock('../../src/lib/util/addSubTaskToActivityTask.js', () => ({
	default: vi.fn()
}));

vi.mock('@oldschoolgg/discord', async () => {
	const actual = await vi.importActual<any>('@oldschoolgg/discord');

	class FakeButtonBuilder {
		private data: any = { type: 2 };

		setCustomId(id: string) {
			this.data.custom_id = id;
			return this;
		}

		setLabel(label: string) {
			this.data.label = label;
			return this;
		}

		setEmoji(emoji: any) {
			if (typeof emoji === 'string') {
				this.data.emoji = { name: emoji };
			} else if (emoji && typeof emoji === 'object' && 'name' in emoji) {
				this.data.emoji = emoji;
			} else {
				this.data.emoji = { name: String(emoji) };
			}
			return this;
		}

		setStyle(style: number) {
			this.data.style = style;
			return this;
		}

		toJSON() {
			return this.data;
		}
	}

	return {
		...actual,
		ButtonBuilder: FakeButtonBuilder
	};
});

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type MutableUser = Mutable<User>;

const marrentill = plants.find(p => p.name === 'Marrentill');
const irit = plants.find(p => p.name === 'Irit');
const cabbage = plants.find(p => p.name === 'Cabbage');
const sweetcorn = plants.find(p => p.name === 'Sweetcorn');
const oak = plants.find(p => p.name === 'Oak tree');
if (!marrentill || !irit || !cabbage || !sweetcorn || !oak) {
	throw new Error('Expected Marrentill, Irit, Cabbage, Sweetcorn, and Oak tree plants to exist');
}

const iritSeedID = getPrimarySeedForPlant(irit);
const sweetcornSeedID = getPrimarySeedForPlant(sweetcorn);
if (!iritSeedID || !sweetcornSeedID) {
	throw new Error('Expected Irit and Sweetcorn to have seed items');
}

function readyPatch(plant: typeof marrentill, quantity: number, friendlyName: string): IPatchDataDetailed {
	return {
		lastPlanted: plant.name,
		patchPlanted: true,
		plantTime: Date.now(),
		lastQuantity: quantity,
		lastUpgradeType: null,
		lastPayment: false,
		ready: true,
		readyIn: 0,
		readyAt: new Date(),
		patchName: plant.seedType as FarmingPatchName,
		friendlyName,
		plant
	};
}

function patchDataFrom(detailed: IPatchDataDetailed): IPatchData {
	return {
		lastPlanted: detailed.lastPlanted,
		patchPlanted: detailed.patchPlanted,
		plantTime: detailed.plantTime,
		lastQuantity: detailed.lastQuantity,
		lastUpgradeType: detailed.lastUpgradeType,
		lastPayment: detailed.lastPayment
	};
}

const herbReady = readyPatch(marrentill, 10, 'Herb');
const allotmentReady = readyPatch(cabbage, 17, 'Allotment');
const treeReady = readyPatch(oak, 2, 'Tree');
const emptyHerb: IPatchDataDetailed = {
	...herbReady,
	lastPlanted: null,
	patchPlanted: false,
	lastQuantity: 0,
	ready: null,
	plant: null
};

const baseInteraction = { channelId: '123' } satisfies Pick<MInteraction, 'channelId'>;

type GlobalActivityManager = {
	minionIsBusy?: (userID: string) => Promise<boolean>;
};

let calcMaxTripLengthSpy: MockInstance;
const originalPrisma = (globalThis as { prisma?: unknown }).prisma;
const originalMinionIsBusy = (global.ActivityManager as GlobalActivityManager).minionIsBusy;

beforeAll(() => {
	(global.ActivityManager as GlobalActivityManager).minionIsBusy = async () => false;
	calcMaxTripLengthSpy = vi.spyOn(calcMaxTripLengthModule, 'calcMaxTripLength');
	(globalThis as { prisma?: unknown }).prisma = undefined;
});

afterAll(() => {
	calcMaxTripLengthSpy.mockRestore();
	(globalThis as { prisma?: unknown }).prisma = originalPrisma;
	(global.ActivityManager as GlobalActivityManager).minionIsBusy = originalMinionIsBusy;
});

beforeEach(() => {
	vi.clearAllMocks();
	calcMaxTripLengthSpy.mockReset();
	calcMaxTripLengthSpy.mockReturnValue(60 * 60 * 1000);
});

afterEach(() => {
	vi.useRealTimers();
});

function mockCostFns(user: ReturnType<typeof mockMUser>) {
	const transactResult = {
		newUser: user,
		itemsAdded: new Bank(),
		itemsRemoved: new Bank(),
		newBank: user.bank.clone(),
		newCL: user.cl.clone(),
		previousCL: new Bank(),
		clLootBank: null
	} satisfies Awaited<ReturnType<typeof user.transactItems>>;
	const transactSpy = vi.spyOn(user, 'transactItems').mockResolvedValue(transactResult);
	vi.spyOn(user, 'statsBankUpdate').mockResolvedValue(undefined);
	vi.spyOn(global.ClientSettings, 'updateBankSetting').mockResolvedValue();
	return transactSpy;
}

describe('Auto Farm Replant uses the planted seed', () => {
	it('replants Marrentill and Cabbage instead of preferred Irit and Sweetcorn when the filter is on', async () => {
		const user = mockMUser({
			bank: new Bank()
				.add('Marrentill seed', 20)
				.add('Irit seed', 20)
				.add('Cabbage seed', 50)
				.add('Sweetcorn seed', 50)
				.add('Compost', 50)
				.add('Coins', 10_000),
			skills_farming: convertLVLtoXP(50)
		});
		const mutableUser = user.user as MutableUser;
		mutableUser.auto_farm_filter = AutoFarmFilterEnum.Replant;
		mutableUser.minion_defaultCompostToUse = CropUpgradeType.compost;
		(mutableUser as any).minion_farmingPreferredSeeds = {
			herb: { type: 'seed', seedID: iritSeedID },
			allotment: { type: 'seed', seedID: sweetcornSeedID }
		};

		const transactSpy = mockCostFns(user);
		const patches = {
			[herbReady.patchName]: patchDataFrom(herbReady),
			[allotmentReady.patchName]: patchDataFrom(allotmentReady)
		} as Record<FarmingPatchName, IPatchData>;

		const plan = await planAutoFarmTrip(user, [herbReady, allotmentReady], patches);
		expect(plan.plannedSteps.map(step => step.plant.name)).toEqual(['Marrentill', 'Cabbage']);
		expect(plan.plannedSteps.every(step => step.planting !== false)).toBe(true);
		expect(plan.totalDuration).toBeGreaterThan(0);
		expect(plan.totalCost.amount('Marrentill seed')).toBeGreaterThan(0);
		expect(plan.totalCost.amount('Cabbage seed')).toBeGreaterThan(0);
		expect(plan.totalCost.amount('Irit seed')).toBe(0);
		expect(plan.totalCost.amount('Sweetcorn seed')).toBe(0);

		const response = await autoFarm(user, [herbReady, allotmentReady], patches, baseInteraction as MInteraction);
		expect(typeof response).toBe('string');
		expect(response).toMatch(/\d+x Marrentill/);
		expect(response).toMatch(/\d+x Cabbage/);
		expect(response).not.toContain('Irit');
		expect(response).not.toContain('Sweetcorn');
		expect(response).not.toContain("Couldn't replant");

		expect(transactSpy).toHaveBeenCalledTimes(1);
		const removed = transactSpy.mock.calls[0][0].itemsToRemove!;
		expect(removed.amount('Marrentill seed')).toBeGreaterThan(0);
		expect(removed.amount('Cabbage seed')).toBeGreaterThan(0);
		expect(removed.amount('Irit seed')).toBe(0);
		expect(removed.amount('Sweetcorn seed')).toBe(0);

		const queued = (addSubTaskToActivityTask as unknown as MockInstance).mock.calls[0]?.[0] as
			| FarmingActivityTaskOptions
			| undefined;
		expect(queued?.duration).toBe(plan.totalDuration);
		expect(queued?.autoFarmPlan?.every(step => step.planting)).toBe(true);
	});

	it('harvests a ready tree and leaves it empty when the same seed is missing', async () => {
		const user = mockMUser({
			bank: new Bank().add('Maple seed', 5).add('Compost', 5).add('Coins', 10_000),
			skills_farming: convertLVLtoXP(40),
			skills_woodcutting: convertLVLtoXP(1)
		});
		const mutableUser = user.user as MutableUser;
		mutableUser.auto_farm_filter = AutoFarmFilterEnum.Replant;
		const maple = plants.find(p => p.name === 'Maple tree');
		const mapleSeedID = maple ? getPrimarySeedForPlant(maple) : null;
		if (mapleSeedID) {
			(mutableUser as any).minion_farmingPreferredSeeds = {
				tree: { type: 'seed', seedID: mapleSeedID }
			};
		}

		const transactSpy = mockCostFns(user);
		const patches = { [treeReady.patchName]: patchDataFrom(treeReady) } as Record<FarmingPatchName, IPatchData>;

		const plan = await planAutoFarmTrip(user, [treeReady], patches);
		expect(plan.plannedSteps).toHaveLength(1);
		expect(plan.plannedSteps[0]?.plant.name).toBe('Oak tree');
		expect(plan.plannedSteps[0]?.planting).toBe(false);
		expect(plan.plannedSteps[0]?.couldNotReplantNeed).toContain('Acorn');
		expect(plan.totalCost.amount('Acorn')).toBe(0);
		expect(plan.totalCost.amount('Maple seed')).toBe(0);

		const response = await autoFarm(user, [treeReady], patches, baseInteraction as MInteraction);
		expect(response).toContain("Couldn't replant: Tree (need Acorn)");
		expect(response).toContain('harvested 2x Oak tree (not replanted)');
		expect(String(response).indexOf("Couldn't replant")).toBeLessThan(String(response).indexOf('**Patches:**'));

		expect(transactSpy).toHaveBeenCalledTimes(1);
		const removed = transactSpy.mock.calls[0][0].itemsToRemove!;
		expect(removed.amount('Acorn')).toBe(0);
		expect(removed.amount('Maple seed')).toBe(0);

		const queued = (addSubTaskToActivityTask as unknown as MockInstance).mock.calls[0]?.[0] as
			| FarmingActivityTaskOptions
			| undefined;
		expect(queued?.planting).toBe(false);
		expect(queued?.autoFarmPlan?.[0]?.planting).toBe(false);
		expect(queued?.duration).toBe(plan.totalDuration);
	});

	it('does not fill an empty patch when the Replant filter is on', async () => {
		const user = mockMUser({
			bank: new Bank().add('Irit seed', 20).add('Compost', 20).add('Coins', 10_000),
			skills_farming: convertLVLtoXP(50)
		});
		const mutableUser = user.user as MutableUser;
		mutableUser.auto_farm_filter = AutoFarmFilterEnum.Replant;
		(mutableUser as any).minion_farmingPreferredSeeds = {
			herb: { type: 'seed', seedID: iritSeedID }
		};

		const patches = { [emptyHerb.patchName]: patchDataFrom(emptyHerb) } as Record<FarmingPatchName, IPatchData>;
		const plan = await planAutoFarmTrip(user, [emptyHerb], patches);
		expect(plan.plannedSteps).toHaveLength(0);

		const response = await autoFarm(user, [emptyHerb], patches, baseInteraction as MInteraction);
		expect(addSubTaskToActivityTask).not.toHaveBeenCalled();
		if (typeof response === 'string') {
			expect(response).toMatch(/no Farming crops|preferences/i);
		}
	});

	it('still plants the preferred seed when the Replant filter is off', async () => {
		const user = mockMUser({
			bank: new Bank().add('Marrentill seed', 20).add('Irit seed', 20).add('Compost', 20).add('Coins', 10_000),
			skills_farming: convertLVLtoXP(50)
		});
		const mutableUser = user.user as MutableUser;
		mutableUser.auto_farm_filter = AutoFarmFilterEnum.AllFarm;
		(mutableUser as any).minion_farmingPreferredSeeds = {
			herb: { type: 'seed', seedID: iritSeedID }
		};

		const patches = { [herbReady.patchName]: patchDataFrom(herbReady) } as Record<FarmingPatchName, IPatchData>;
		const plan = await planAutoFarmTrip(user, [herbReady], patches);
		expect(plan.plannedSteps).toHaveLength(1);
		expect(plan.plannedSteps[0]?.plant.name).toBe('Irit');
		expect(plan.totalCost.amount('Irit seed')).toBeGreaterThan(0);
		expect(plan.totalCost.amount('Marrentill seed')).toBe(0);
	});
});

describe('Auto Farm Replant message length', () => {
	it("keeps the worst-case trip start message at least 150 under Discord's 2000 character limit", () => {
		const longName = `DJ ${'A'.repeat(80)}`;
		const summaryLines: string[] = [];
		const entries: { friendlyName: string; need: string }[] = [];
		const infoDetails: string[] = [];
		const skipped: string[] = [];

		for (const [index, patchName] of farmingPatchNames.entries()) {
			const friendlyName = `${patchName.replaceAll('_', ' ')} patch`;
			const plantName = 'Mysterious crystalline potato cactus tree';
			const seedName = 'Mysterious crystalline potato cactus tree seed';
			const step: PlannedAutoFarmStep = {
				plant: oak,
				quantity: 99_999,
				duration: 60_000,
				upgradeType: CropUpgradeType.ultracompost,
				didPay: false,
				treeChopFee: 0,
				patch: patchDataFrom(treeReady),
				patchName: patchName as FarmingPatchName,
				friendlyName,
				info: [
					`You did not have enough Ultracompost to treat 99999 patches, so they were planted with Supercompost.`
				],
				boosts: [],
				planting: false,
				couldNotReplantNeed: seedName
			};
			summaryLines.push(buildSummaryForStep(index, step).summaryLine);
			infoDetails.push(`${friendlyName}: ${step.info[0]}`);
			entries.push({ friendlyName, need: seedName });
			skipped.push(friendlyName);
		}

		const message = buildAutoFarmTripStartMessage({
			minionName: longName,
			tripDurationText: '99 hours, 59 minutes, and 59 seconds',
			summaryLines,
			couldNotReplantLine: formatCouldNotReplantLine(entries),
			itemsUsed: '**Items used:** 99999x Ultracompost, 99999x Coins, 99999x Tomatoes(5).',
			chargeLine: 'Bottomless compost bucket: 10,000 charges used (0 left)',
			infoDetails,
			uniqueBoosts: [
				'10% faster for Graceful outfit',
				'10% faster for Ring of endurance',
				'25% faster for Moondash charm',
				'4% faster for Ardougne hard diary',
				'4% faster for Ardougne elite diary',
				'50% less seeds used'
			],
			skippedDueToTripLength: true,
			skippedPatchNames: skipped,
			maxTripLength: 99 * 60 * 60 * 1000
		});

		expect(message).toContain('Bottomless compost bucket: 10,000 charges used (0 left)');
		expect(message).toContain("Couldn't replant");
		expect(message.indexOf("Couldn't replant")).toBeLessThan(message.indexOf('**Patches:**'));
		expect(message.length).toBeLessThanOrEqual(AUTO_FARM_START_MESSAGE_SAFE_LIMIT);
	});
});
