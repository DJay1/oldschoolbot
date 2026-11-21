import { Bank, convertLVLtoXP } from 'oldschooljs';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import './setup.js';

import { autoFarm, planAutoFarmTrip } from '@/lib/minions/functions/autoFarm.js';
import { allFarm, replant } from '@/lib/minions/functions/autoFarmFilters.js';
import {
	parsePreferredSeeds,
	rememberCropsInPreferences,
	resolveSeedForPatch,
	serializePreferredSeeds
} from '@/lib/skilling/skills/farming/autoFarm/preferences.js';
import { plants } from '@/lib/skilling/skills/farming/index.js';
import { calcNumOfPatches } from '@/lib/skilling/skills/farming/utils/calcsFarming.js';
import type { FarmingPatchName } from '@/lib/skilling/skills/farming/utils/farmingHelpers.js';
import type { IPatchData, IPatchDataDetailed } from '@/lib/skilling/skills/farming/utils/types.js';
import addSubTaskToActivityTask from '@/lib/util/addSubTaskToActivityTask.js';
import * as calcMaxTripLengthModule from '@/lib/util/calcMaxTripLength.js';
import { mockMUser } from './userutil.js';
import '@/lib/util/clientSettings.js';

import { AutoFarmFilterEnum, CropUpgradeType } from '@/prisma/main/enums.js';
import type { User } from '@/prisma/main.js';

vi.mock('@/lib/util/addSubTaskToActivityTask.js', () => ({
	default: vi.fn()
}));

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type MutableUser = Mutable<User>;

const guam = plants.find(p => p.name === 'Guam')!;
const ranarr = plants.find(p => p.name === 'Ranarr')!;
if (!guam || !ranarr) throw new Error('Expected Guam and Ranarr plants');

const [guamSeed] = guam.inputItems.items();
const [ranarrSeed] = ranarr.inputItems.items();
const guamSeedID = guamSeed![0].id;
const ranarrSeedID = ranarrSeed![0].id;

function herbPatch(
	lastPlanted: string | null = null,
	plant = lastPlanted === ranarr.name ? ranarr : null
): {
	patch: IPatchData;
	detailed: IPatchDataDetailed;
} {
	const patch: IPatchData = {
		lastPlanted,
		patchPlanted: Boolean(lastPlanted),
		plantTime: Date.now(),
		lastQuantity: lastPlanted ? 4 : 0,
		lastUpgradeType: null,
		lastPayment: false
	};
	const detailed: IPatchDataDetailed = {
		...patch,
		ready: lastPlanted ? true : null,
		readyIn: lastPlanted ? 0 : null,
		readyAt: lastPlanted ? new Date() : null,
		patchName: guam.seedType,
		friendlyName: 'Herb patch',
		plant
	};
	return { patch, detailed };
}

type GlobalActivityManager = {
	minionIsBusy?: (userID: string) => Promise<boolean>;
};

const originalPrisma = (globalThis as { prisma?: unknown }).prisma;
const originalMinionIsBusy = (global.ActivityManager as GlobalActivityManager).minionIsBusy;

describe('Auto Farm leftover patches and sticky crop', () => {
	let calcMaxTripLengthSpy: any;

	beforeAll(() => {
		(global.ActivityManager as GlobalActivityManager).minionIsBusy = async () => false;
		(globalThis as { prisma?: unknown }).prisma = undefined;
	});

	afterAll(() => {
		(globalThis as { prisma?: unknown }).prisma = originalPrisma;
		(global.ActivityManager as GlobalActivityManager).minionIsBusy = originalMinionIsBusy;
	});

	beforeEach(() => {
		calcMaxTripLengthSpy = vi.spyOn(calcMaxTripLengthModule, 'calcMaxTripLength').mockResolvedValue(10 * 60 * 1000);
		vi.mocked(addSubTaskToActivityTask).mockReset();
	});

	afterEach(() => {
		calcMaxTripLengthSpy.mockRestore();
	});

	it('allFarm allows a plant when the player only has seeds for some patches', () => {
		const user = mockMUser({
			bank: new Bank().add('Ranarr seed', 2),
			skills_farming: convertLVLtoXP(50)
		});
		const [patches] = calcNumOfPatches(ranarr, user, user.QP);
		expect(patches).toBeGreaterThan(2);
		expect(allFarm(ranarr, 50, user, user.bank)).toBe(true);
	});

	it('replant allows the same crop when the player only has seeds for some patches', () => {
		const { detailed } = herbPatch(ranarr.name, ranarr);
		const user = mockMUser({
			bank: new Bank().add('Ranarr seed', 2),
			skills_farming: convertLVLtoXP(50)
		});
		const [patches] = calcNumOfPatches(ranarr, user, user.QP);
		expect(patches).toBeGreaterThan(2);
		expect(replant(ranarr, 50, user, user.bank, [detailed])).toBe(true);
	});

	it('keeps the last planted crop and does not fill leftover patches with a different seed', async () => {
		const { patch, detailed } = herbPatch(ranarr.name, ranarr);
		const user = mockMUser({
			bank: new Bank().add('Ranarr seed', 2).add('Guam seed', 20).add('Compost', 20),
			skills_farming: convertLVLtoXP(50)
		});
		const mutableUser = user.user as MutableUser;
		mutableUser.auto_farm_filter = AutoFarmFilterEnum.AllFarm;
		mutableUser.minion_defaultCompostToUse = CropUpgradeType.compost;

		const resolved = resolveSeedForPatch({
			patch: detailed,
			preferContract: false,
			contractPlant: null,
			preferences: new Map(),
			fallbackPlant: guam
		});
		expect(resolved).toEqual({ type: 'plant', plant: ranarr, reason: 'last_planted' });

		const plan = await planAutoFarmTrip(user, [detailed], {
			[ranarr.seedType]: patch
		} as Record<FarmingPatchName, IPatchData>);

		expect(plan.plannedSteps).toHaveLength(1);
		expect(plan.plannedSteps[0]?.plant.name).toBe('Ranarr');
		expect(plan.plannedSteps[0]?.quantity).toBe(2);
		expect(plan.plannedSteps.some(step => step.plant.name === 'Guam')).toBe(false);
	});

	it('does not switch crops or start a different trip when the sticky crop is out of seeds', async () => {
		const { patch, detailed } = herbPatch(ranarr.name, ranarr);
		const user = mockMUser({
			bank: new Bank().add('Guam seed', 20).add('Compost', 20),
			skills_farming: convertLVLtoXP(50)
		});
		const mutableUser = user.user as MutableUser;
		mutableUser.auto_farm_filter = AutoFarmFilterEnum.AllFarm;
		mutableUser.minion_defaultCompostToUse = CropUpgradeType.compost;

		const plan = await planAutoFarmTrip(user, [detailed], {
			[ranarr.seedType]: patch
		} as Record<FarmingPatchName, IPatchData>);
		expect(plan.plannedSteps).toHaveLength(0);

		const response = await autoFarm(
			user,
			[detailed],
			{ [ranarr.seedType]: patch } as Record<FarmingPatchName, IPatchData>,
			{ channelId: '1' } as MInteraction
		);
		const text =
			typeof response === 'string'
				? response
				: ((response as { message?: { content?: string }; content?: string }).message?.content ??
					(response as { content?: string }).content ??
					'');
		expect(String(text).length).toBeGreaterThan(0);
		expect(addSubTaskToActivityTask).not.toHaveBeenCalled();
	});

	it('user.owns is checked before the Auto Farm trip starts', async () => {
		const { patch, detailed } = herbPatch(null, null);
		const bank = new Bank().add('Guam seed', 4).add('Compost', 4);
		const user = mockMUser({
			bank,
			skills_farming: convertLVLtoXP(50)
		});
		const mutableUser = user.user as MutableUser;
		mutableUser.auto_farm_filter = AutoFarmFilterEnum.AllFarm;
		mutableUser.minion_defaultCompostToUse = CropUpgradeType.compost;
		const ownsSpy = vi.spyOn(user, 'owns').mockReturnValue(false);

		const response = await autoFarm(
			user,
			[detailed],
			{ [guam.seedType]: patch } as Record<FarmingPatchName, IPatchData>,
			{ channelId: '1' } as MInteraction
		);
		expect(ownsSpy).toHaveBeenCalled();
		expect(String(response)).toContain("You don't own");
		expect(addSubTaskToActivityTask).not.toHaveBeenCalled();
	});

	it('remembers the planted crop in Auto Farm preferences until the player changes it', () => {
		const remembered = rememberCropsInPreferences(new Map(), [
			{ patchName: ranarr.seedType as FarmingPatchName, plant: ranarr }
		]);
		expect(remembered.get(ranarr.seedType as FarmingPatchName)).toEqual({
			type: 'seed',
			seedID: ranarrSeedID
		});

		const existing = new Map(remembered);
		existing.set(ranarr.seedType as FarmingPatchName, { type: 'highest_available' });
		const unchanged = rememberCropsInPreferences(existing, [
			{ patchName: ranarr.seedType as FarmingPatchName, plant: guam }
		]);
		expect(unchanged.get(ranarr.seedType as FarmingPatchName)).toEqual({ type: 'highest_available' });
	});

	it('saves the planted crop as a preference after a successful Auto Farm start', async () => {
		const { patch, detailed } = herbPatch(null, null);
		const user = mockMUser({
			bank: new Bank().add('Guam seed', 4).add('Compost', 4),
			skills_farming: convertLVLtoXP(50)
		});
		const mutableUser = user.user as MutableUser;
		mutableUser.auto_farm_filter = AutoFarmFilterEnum.AllFarm;
		mutableUser.minion_defaultCompostToUse = CropUpgradeType.compost;
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
		vi.spyOn(user, 'statsBankUpdate').mockResolvedValue(undefined);
		vi.spyOn(global.ClientSettings, 'updateBankSetting').mockResolvedValue();
		const updateSpy = vi.spyOn(user, 'update').mockResolvedValue(user as any);

		await autoFarm(
			user,
			[detailed],
			{ [guam.seedType]: patch } as Record<FarmingPatchName, IPatchData>,
			{ channelId: '1' } as MInteraction
		);

		expect(addSubTaskToActivityTask).toHaveBeenCalledTimes(1);
		expect(updateSpy).toHaveBeenCalled();
		const saved = updateSpy.mock.calls[0][0] as { minion_farmingPreferredSeeds?: unknown };
		const parsed = parsePreferredSeeds(saved.minion_farmingPreferredSeeds);
		expect(parsed.get(guam.seedType as FarmingPatchName)).toEqual({ type: 'seed', seedID: guamSeedID });
		expect(serializePreferredSeeds(parsed)[guam.seedType as FarmingPatchName]?.type).toBe('seed');
	});
});
