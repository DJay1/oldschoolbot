import { Bank, convertLVLtoXP } from 'oldschooljs';
import { describe, expect, it } from 'vitest';

import './setup.js';

import { BitField } from '../../src/lib/constants.js';
import {
	compostItemName,
	prepareFarmingStep,
	resolveCompostUpgrade
} from '../../src/lib/minions/functions/farmingTripHelpers.js';
import { plants } from '../../src/lib/skilling/skills/farming/index.js';
import { farmingPatchNames } from '../../src/lib/skilling/skills/farming/utils/farming.shared.js';
import {
	condenseCompostInfoLines,
	formatCompostFallback,
	formatCondensedCompostFallback,
	formatCondensedMissingCompost,
	formatMissingCompost
} from '../../src/lib/skilling/skills/farming/utils/farmingFormatters.js';
import type { IPatchData, IPatchDataDetailed } from '../../src/lib/skilling/skills/farming/utils/types.js';
import { CropUpgradeType } from '../../src/prisma/main/enums.js';
import { mockMUser } from './userutil.js';

const maybeHerbPlant = plants.find(p => p.name === 'Guam');
if (!maybeHerbPlant) {
	throw new Error('Expected Guam plant to exist for tests');
}
const herbPlant = maybeHerbPlant;

const herbPatch: IPatchData = {
	lastPlanted: null,
	patchPlanted: false,
	plantTime: Date.now(),
	lastQuantity: 0,
	lastUpgradeType: null,
	lastPayment: false
};

const herbPatchDetailed: IPatchDataDetailed = {
	...herbPatch,
	ready: null,
	readyIn: null,
	readyAt: null,
	patchName: herbPlant.seedType,
	friendlyName: 'Herb patch',
	plant: null
};

const DISCORD_CONTENT_LIMIT = 2000;
const LENGTH_BUFFER = 150;
const MAX_PATCH_QUANTITY = 99_999;

function makeUser(bank: Bank, bitfield: BitField[] = []) {
	return mockMUser({
		bank,
		skills_farming: convertLVLtoXP(50),
		bitfield
	});
}

async function prepareHerbs(user: ReturnType<typeof mockMUser>, compostTier: CropUpgradeType, quantity = 4) {
	return prepareFarmingStep({
		user,
		plant: herbPlant,
		quantity,
		pay: false,
		patchDetailed: herbPatchDetailed,
		maxTripLength: 60 * 60 * 1000,
		availableBank: user.bank.clone().add('Coins', user.GP),
		compostTier
	});
}

describe('resolveCompostUpgrade', () => {
	it('uses the default tier when the full quantity is available', () => {
		const resolved = resolveCompostUpgrade({
			compostTier: CropUpgradeType.supercompost,
			useBestAvailable: false,
			availableBank: new Bank().add('Supercompost', 4).add('Compost', 4),
			quantityToDo: 4
		});
		expect(resolved.upgradeType).toBe(CropUpgradeType.supercompost);
		expect(resolved.compostCost?.amount('Supercompost')).toBe(4);
		expect(resolved.fallbackFrom).toBeNull();
	});

	it('walks down to a lower tier when the default is short', () => {
		const resolved = resolveCompostUpgrade({
			compostTier: CropUpgradeType.supercompost,
			useBestAvailable: false,
			availableBank: new Bank().add('Supercompost', 2).add('Compost', 4),
			quantityToDo: 4
		});
		expect(resolved.upgradeType).toBe(CropUpgradeType.compost);
		expect(resolved.compostCost?.amount('Compost')).toBe(4);
		expect(resolved.compostCost?.amount('Supercompost')).toBe(0);
		expect(resolved.fallbackFrom).toBe(CropUpgradeType.supercompost);
	});

	it('uses no compost when no lower tier covers the full quantity', () => {
		const resolved = resolveCompostUpgrade({
			compostTier: CropUpgradeType.supercompost,
			useBestAvailable: false,
			availableBank: new Bank().add('Supercompost', 2).add('Compost', 3),
			quantityToDo: 4
		});
		expect(resolved.upgradeType).toBeNull();
		expect(resolved.compostCost).toBeNull();
	});

	it('does not walk up from the default tier', () => {
		const resolved = resolveCompostUpgrade({
			compostTier: CropUpgradeType.compost,
			useBestAvailable: false,
			availableBank: new Bank().add('Ultracompost', 4).add('Supercompost', 4).add('Compost', 4),
			quantityToDo: 4
		});
		expect(resolved.upgradeType).toBe(CropUpgradeType.compost);
		expect(resolved.fallbackFrom).toBeNull();
	});

	it('best available picks Ultracompost, then Supercompost, then Compost', () => {
		const ultra = resolveCompostUpgrade({
			compostTier: CropUpgradeType.compost,
			useBestAvailable: true,
			availableBank: new Bank().add('Ultracompost', 4).add('Supercompost', 4).add('Compost', 4),
			quantityToDo: 4
		});
		expect(ultra.upgradeType).toBe(CropUpgradeType.ultracompost);
		expect(ultra.fallbackFrom).toBeNull();

		const supercompost = resolveCompostUpgrade({
			compostTier: CropUpgradeType.compost,
			useBestAvailable: true,
			availableBank: new Bank().add('Ultracompost', 2).add('Supercompost', 4).add('Compost', 4),
			quantityToDo: 4
		});
		expect(supercompost.upgradeType).toBe(CropUpgradeType.supercompost);
		expect(supercompost.fallbackFrom).toBeNull();

		const compost = resolveCompostUpgrade({
			compostTier: CropUpgradeType.compost,
			useBestAvailable: true,
			availableBank: new Bank().add('Ultracompost', 2).add('Supercompost', 2).add('Compost', 4),
			quantityToDo: 4
		});
		expect(compost.upgradeType).toBe(CropUpgradeType.compost);
		expect(compost.fallbackFrom).toBeNull();
	});
});

describe('prepareFarmingStep compost selection', () => {
	it('uses the default compost when the full quantity is available', async () => {
		const user = makeUser(new Bank().add('Guam seed', 4).add('Supercompost', 4));
		const result = await prepareHerbs(user, CropUpgradeType.supercompost);
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.upgradeType).toBe(CropUpgradeType.supercompost);
		expect(result.data.cost.amount('Supercompost')).toBe(4);
		expect(result.data.cost.amount('Compost')).toBe(0);
		expect(
			result.data.infoStr.some(
				line => line.includes('without compost') || line.includes('so they were planted with')
			)
		).toBe(false);
	});

	it('falls back to a lower tier when the default is short, and cost matches upgradeType', async () => {
		const user = makeUser(new Bank().add('Guam seed', 4).add('Supercompost', 2).add('Compost', 4));
		const result = await prepareHerbs(user, CropUpgradeType.supercompost);
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.upgradeType).toBe(CropUpgradeType.compost);
		expect(result.data.cost.amount('Compost')).toBe(4);
		expect(result.data.cost.amount('Supercompost')).toBe(0);
		expect(result.data.infoStr).toContain(formatCompostFallback('Supercompost', 'Compost', 4));
	});

	it('plants without compost when no tier covers the full quantity, and cost matches upgradeType', async () => {
		const user = makeUser(new Bank().add('Guam seed', 4).add('Supercompost', 2).add('Compost', 3));
		const result = await prepareHerbs(user, CropUpgradeType.supercompost);
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.upgradeType).toBeNull();
		expect(result.data.cost.amount('Compost')).toBe(0);
		expect(result.data.cost.amount('Supercompost')).toBe(0);
		expect(result.data.cost.amount('Ultracompost')).toBe(0);
		expect(result.data.infoStr).toContain(formatMissingCompost(4));
	});

	it('best available picks Ultracompost when it covers the group', async () => {
		const user = makeUser(
			new Bank().add('Guam seed', 4).add('Ultracompost', 4).add('Supercompost', 4).add('Compost', 4),
			[BitField.UseBestAvailableCompost]
		);
		const result = await prepareHerbs(user, CropUpgradeType.compost);
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.upgradeType).toBe(CropUpgradeType.ultracompost);
		expect(result.data.cost.amount('Ultracompost')).toBe(4);
		expect(result.data.cost.amount('Supercompost')).toBe(0);
		expect(result.data.cost.amount('Compost')).toBe(0);
	});

	it('best available picks Supercompost when Ultracompost is short', async () => {
		const user = makeUser(
			new Bank().add('Guam seed', 4).add('Ultracompost', 2).add('Supercompost', 4).add('Compost', 4),
			[BitField.UseBestAvailableCompost]
		);
		const result = await prepareHerbs(user, CropUpgradeType.compost);
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.upgradeType).toBe(CropUpgradeType.supercompost);
		expect(result.data.cost.amount('Supercompost')).toBe(4);
		expect(result.data.cost.amount('Ultracompost')).toBe(0);
	});

	it('best available picks Compost when higher tiers are short', async () => {
		const user = makeUser(
			new Bank().add('Guam seed', 4).add('Ultracompost', 2).add('Supercompost', 2).add('Compost', 4),
			[BitField.UseBestAvailableCompost]
		);
		const result = await prepareHerbs(user, CropUpgradeType.compost);
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.upgradeType).toBe(CropUpgradeType.compost);
		expect(result.data.cost.amount('Compost')).toBe(4);
		expect(result.data.cost.amount('Supercompost')).toBe(0);
		expect(result.data.cost.amount('Ultracompost')).toBe(0);
	});
});

describe('compost message length', () => {
	it('fallback and missing compost notes stay at least 150 under the Discord limit', () => {
		const fallback = formatCompostFallback(
			compostItemName(CropUpgradeType.ultracompost),
			compostItemName(CropUpgradeType.supercompost),
			MAX_PATCH_QUANTITY
		);
		const missing = formatMissingCompost(MAX_PATCH_QUANTITY);
		const bestAvailableReply =
			'You will now use the best compost you have enough of for each patch group (Ultracompost, then Supercompost, then Compost).';
		const autoFarmLine = `Spirit tree patch: ${fallback}`;
		for (const text of [fallback, missing, bestAvailableReply, autoFarmLine]) {
			expect(text.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - LENGTH_BUFFER);
			expect(text.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT);
		}
		expect('Best available'.length).toBeLessThanOrEqual(100);
		expect('The compost you want to use by default, or Best available.'.length).toBeLessThanOrEqual(100);
	});
});

describe('condenseCompostInfoLines', () => {
	const friendlyNames = farmingPatchNames.map(name =>
		name.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
	);

	it('leaves a single missing-compost or fallback line unchanged', () => {
		const missing = [
			'Fruit Tree: You did not have enough compost to treat 9 patches, so they were planted without compost.'
		];
		const fallback = [
			'Herb: You did not have enough Supercompost to treat 4 patches, so they were planted with Compost.'
		];
		expect(condenseCompostInfoLines(missing)).toEqual(missing);
		expect(condenseCompostInfoLines(fallback)).toEqual(fallback);
	});

	it('leaves unrelated info lines in place and unchanged', () => {
		const lines = [
			'Allotment: You did not have enough payment to automatically pay for crop protection.',
			'Tree: You did not have the woodcutting level required, so you paid a nearby farmer 50,000 GP to remove the previous trees.'
		];
		expect(condenseCompostInfoLines(lines)).toEqual(lines);
	});

	it('condenses Zootr-style autofarm missing-compost spam into one total line', () => {
		const lines = [
			'Fruit Tree: You did not have enough compost to treat 9 patches, so they were planted without compost.',
			'Tree: You did not have enough compost to treat 10 patches, so they were planted without compost.',
			'Allotment: You did not have enough compost to treat 5 patches, so they were planted without compost.',
			'Cactus: You did not have enough compost to treat 2 patches, so they were planted without compost.',
			'Flower: You did not have enough compost to treat 10 patches, so they were planted without compost.',
			'Belladonna: You did not have enough compost to treat 5 patches, so they were planted without compost.'
		];
		expect(condenseCompostInfoLines(lines)).toEqual([
			'You did not have enough compost to treat 41 patches (Fruit Tree, Tree, Allotment, Cactus, Flower, Belladonna), so they were planted without compost.'
		]);
	});

	it('keeps other notes and condenses only the compost shortage lines', () => {
		const lines = [
			'Herb: You did not have enough payment to automatically pay for crop protection.',
			'Fruit Tree: You did not have enough compost to treat 9 patches, so they were planted without compost.',
			'Tree: You did not have enough compost to treat 10 patches, so they were planted without compost.',
			'Bush: Your minion will harvest the patch.'
		];
		expect(condenseCompostInfoLines(lines)).toEqual([
			'Herb: You did not have enough payment to automatically pay for crop protection.',
			'You did not have enough compost to treat 19 patches (Fruit Tree, Tree), so they were planted without compost.',
			'Bush: Your minion will harvest the patch.'
		]);
	});

	it('condenses matching compost fallback lines and leaves a single different fallback intact', () => {
		const lines = [
			'Herb: You did not have enough Supercompost to treat 6 patches, so they were planted with Compost.',
			'Allotment: You did not have enough Supercompost to treat 5 patches, so they were planted with Compost.',
			'Flower: You did not have enough Ultracompost to treat 10 patches, so they were planted with Supercompost.'
		];
		expect(condenseCompostInfoLines(lines)).toEqual([
			'You did not have enough Supercompost to treat 11 patches (Herb, Allotment), so they were planted with Compost.',
			'Flower: You did not have enough Ultracompost to treat 10 patches, so they were planted with Supercompost.'
		]);
	});

	it('condensed compost notes stay at least 150 under the Discord limit in the worst case', () => {
		const missingLines = friendlyNames.map(name => `${name}: ${formatMissingCompost(MAX_PATCH_QUANTITY)}`);
		const fallbackLines = friendlyNames.map(
			name => `${name}: ${formatCompostFallback('Ultracompost', 'Supercompost', MAX_PATCH_QUANTITY)}`
		);
		const mixed = [
			...missingLines,
			'Allotment: You did not have enough payment to automatically pay for crop protection.',
			...fallbackLines
		];
		const condensed = condenseCompostInfoLines(mixed);
		const expectedMissing = formatCondensedMissingCompost(MAX_PATCH_QUANTITY * friendlyNames.length, friendlyNames);
		const expectedFallback = formatCondensedCompostFallback(
			'Ultracompost',
			'Supercompost',
			MAX_PATCH_QUANTITY * friendlyNames.length,
			friendlyNames
		);
		expect(condensed).toEqual([
			expectedMissing,
			'Allotment: You did not have enough payment to automatically pay for crop protection.',
			expectedFallback
		]);
		for (const text of condensed) {
			expect(text.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - LENGTH_BUFFER);
			expect(text.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT);
		}
		expect(condensed.join('\n').length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - LENGTH_BUFFER);
	});
});
