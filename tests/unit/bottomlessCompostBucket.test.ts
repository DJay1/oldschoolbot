import { Bank, Items } from 'oldschooljs';
import { describe, expect, it } from 'vitest';

import './setup.js';

import { BitField } from '../../src/lib/constants.js';
import { prepareFarmingStep, resolveCompostUpgrade } from '../../src/lib/minions/functions/farmingTripHelpers.js';
import {
	applyBottomlessUse,
	availableCompostOfType,
	BOTTOMLESS_COMPOST_BUCKET_ID,
	BOTTOMLESS_COMPOST_CHARGES_PER_BUCKET,
	BOTTOMLESS_COMPOST_MAX_CHARGES,
	calcEmptyBottomless,
	calcFillBottomless,
	chargedBottomlessRemovalError,
	checkBottomlessMessage,
	compostTypeFromItemID,
	normalizeBottomlessState,
	splitCompostUse,
	wouldLoseChargedBottomlessBucket
} from '../../src/lib/skilling/skills/farming/bottomlessCompostBucket.js';
import { plants } from '../../src/lib/skilling/skills/farming/index.js';
import { formatPatchTreatment } from '../../src/lib/skilling/skills/farming/utils/farmingFormatters.js';
import type { IPatchDataDetailed } from '../../src/lib/skilling/skills/farming/utils/types.js';
import { CropUpgradeType } from '../../src/prisma/main/enums.js';
import { mockMUser } from './userutil.js';

const bucketName = 'Bottomless compost bucket';

describe('Bottomless compost bucket fill and empty', () => {
	it('gives two charges for each bucket of compost and caps at 10,000', () => {
		const filled = calcFillBottomless({
			state: normalizeBottomlessState({ owned: true, charges: 0, type: null }),
			compostType: 'ultracompost',
			ownedCompost: 5000,
			requestedQuantity: null
		});
		expect(filled.ok).toBe(true);
		if (!filled.ok) return;
		expect(filled.bucketsToAdd).toBe(5000);
		expect(filled.chargesToAdd).toBe(10_000);
		expect(filled.newCharges).toBe(BOTTOMLESS_COMPOST_MAX_CHARGES);
		expect(filled.nowFull).toBe(true);
		expect(filled.successMessage).toContain('10,000 uses');
		expect(filled.successMessage).toContain('now full');
	});

	it('cannot mix compost types or add a partial charge at 9,999 uses', () => {
		const mixed = calcFillBottomless({
			state: normalizeBottomlessState({ owned: true, charges: 10, type: 'ultracompost' }),
			compostType: 'supercompost',
			ownedCompost: 5,
			requestedQuantity: 5
		});
		expect(mixed).toEqual({
			ok: false,
			message:
				'Your bottomless compost bucket already contains Ultracompost. You cannot fill it with Supercompost.'
		});

		const almostFull = calcFillBottomless({
			state: normalizeBottomlessState({ owned: true, charges: 9999, type: 'compost' }),
			compostType: 'compost',
			ownedCompost: 10,
			requestedQuantity: null
		});
		expect(almostFull).toEqual({
			ok: false,
			message:
				"Your bottomless compost bucket is just about full. You won't be able to squeeze any more compost in there."
		});
	});

	it('rejects filling or emptying without a bucket, and emptying discards charges', () => {
		const noBucket = calcFillBottomless({
			state: normalizeBottomlessState({ owned: false, charges: 0, type: null }),
			compostType: 'compost',
			ownedCompost: 10,
			requestedQuantity: 10
		});
		expect(noBucket).toEqual({ ok: false, message: "You don't have a Bottomless compost bucket." });

		const emptyCheck = calcEmptyBottomless(normalizeBottomlessState({ owned: true, charges: 0, type: null }));
		expect(emptyCheck).toEqual({ ok: false, message: 'Your compost bucket is currently empty.' });

		const empty = calcEmptyBottomless(normalizeBottomlessState({ owned: true, charges: 20, type: 'ultracompost' }));
		expect(empty.ok).toBe(true);
		if (!empty.ok) return;
		expect(empty.successMessage).toBe(
			'You empty your Bottomless compost bucket, discarding 20 uses of Ultracompost.'
		);
		expect(empty.successMessage).not.toContain('Bucket');
		expect(empty.confirmMessage).toContain('cannot be undone');
	});

	it('check messages match empty and filled states', () => {
		expect(checkBottomlessMessage(normalizeBottomlessState({ owned: true, charges: 0, type: null }))).toBe(
			'Your compost bucket is currently empty.'
		);
		expect(
			checkBottomlessMessage(normalizeBottomlessState({ owned: true, charges: 40, type: 'supercompost' }))
		).toBe('Your bottomless compost bucket is currently holding 40 uses of Supercompost.');
	});

	it('identifies compost items and does not create charges from nothing', () => {
		expect(compostTypeFromItemID(Items.getOrThrow('Ultracompost').id)).toBe('ultracompost');
		expect(compostTypeFromItemID(BOTTOMLESS_COMPOST_BUCKET_ID)).toBeNull();
		const noCompost = calcFillBottomless({
			state: normalizeBottomlessState({ owned: true, charges: 0, type: null }),
			compostType: 'ultracompost',
			ownedCompost: 0,
			requestedQuantity: 10
		});
		expect(noCompost).toEqual({
			ok: false,
			message: "You don't have any compost to fill your bottomless compost bucket with."
		});
		expect(BOTTOMLESS_COMPOST_CHARGES_PER_BUCKET).toBe(2);
	});
});

describe('Bottomless compost bucket charge safety', () => {
	it('blocks removing the last bucket while it still has charges', () => {
		const state = normalizeBottomlessState({ owned: true, charges: 8, type: 'compost' });
		expect(
			wouldLoseChargedBottomlessBucket({
				currentCount: 1,
				removeCount: 1,
				addCount: 0,
				nextCharges: state.charges
			})
		).toBe(true);
		expect(
			wouldLoseChargedBottomlessBucket({
				currentCount: 2,
				removeCount: 1,
				addCount: 0,
				nextCharges: state.charges
			})
		).toBe(false);
		expect(
			wouldLoseChargedBottomlessBucket({
				currentCount: 1,
				removeCount: 1,
				addCount: 0,
				nextCharges: 0
			})
		).toBe(false);
		expect(chargedBottomlessRemovalError(state)).toBe(
			'Your Bottomless compost bucket still has 8 uses of Compost. Empty it first, or keep one in your bank.'
		);
	});

	it('cannot spend charges unless the bucket is still in the bank', () => {
		const lostBucket = normalizeBottomlessState({ owned: false, charges: 50, type: 'ultracompost' });
		expect(usableChargesOrZero(lostBucket, 'ultracompost')).toBe(0);
		expect(availableCompostOfType(new Bank().add('Ultracompost', 3), lostBucket, 'ultracompost')).toBe(3);
	});
});

function usableChargesOrZero(
	state: ReturnType<typeof normalizeBottomlessState>,
	type: 'compost' | 'supercompost' | 'ultracompost'
) {
	return splitCompostUse(state, type, 99).fromBucket;
}

describe('Farming uses Bottomless compost bucket charges first', () => {
	const maybeHerbPlant = plants.find(p => p.name === 'Guam');
	if (!maybeHerbPlant) {
		throw new Error('Expected Guam plant to exist for tests');
	}
	const herbPlant = maybeHerbPlant;
	const herbPatchDetailed: IPatchDataDetailed = {
		lastPlanted: null,
		patchPlanted: false,
		plantTime: Date.now(),
		lastQuantity: 0,
		lastUpgradeType: null,
		lastPayment: false,
		ready: null,
		readyIn: null,
		readyAt: null,
		patchName: herbPlant.seedType,
		friendlyName: 'Herb patch',
		plant: null
	};

	it('treats bucket charges as the compost type they hold, then bank compost of the same type', () => {
		const state = normalizeBottomlessState({ owned: true, charges: 3, type: 'ultracompost' });
		expect(availableCompostOfType(new Bank().add('Ultracompost', 2), state, 'ultracompost')).toBe(5);
		expect(splitCompostUse(state, 'ultracompost', 4)).toEqual({ fromBucket: 3, fromBank: 1 });
		expect(splitCompostUse(state, 'supercompost', 4)).toEqual({ fromBucket: 0, fromBank: 4 });

		const resolved = resolveCompostUpgrade({
			compostTier: CropUpgradeType.ultracompost,
			useBestAvailable: false,
			availableBank: new Bank().add('Ultracompost', 1).add('Guam seed', 8),
			quantityToDo: 4,
			bottomless: state
		});
		expect(resolved.upgradeType).toBe(CropUpgradeType.ultracompost);
		expect(resolved.compostCost?.amount('Ultracompost')).toBe(1);
		expect(resolved.bucketChargesUsed).toBe(3);
	});

	it('does not spend the same charges twice when planning later patches', () => {
		const state = normalizeBottomlessState({ owned: true, charges: 4, type: 'ultracompost' });
		const first = resolveCompostUpgrade({
			compostTier: CropUpgradeType.ultracompost,
			useBestAvailable: false,
			availableBank: new Bank(),
			quantityToDo: 4,
			bottomless: state
		});
		expect(first.bucketChargesUsed).toBe(4);
		const after = applyBottomlessUse(state, first.bucketChargesUsed ?? 0);
		const second = resolveCompostUpgrade({
			compostTier: CropUpgradeType.ultracompost,
			useBestAvailable: false,
			availableBank: new Bank(),
			quantityToDo: 4,
			bottomless: after
		});
		expect(second.upgradeType).toBeNull();
		expect(second.bucketChargesUsed).toBe(0);
	});

	it('uses bucket charges in prepareFarmingStep without taking those uses from the bank', async () => {
		const user = mockMUser({
			bank: new Bank().add(bucketName).add('Guam seed', 4).add('Ultracompost', 1),
			skills_farming: 1_000_000
		});
		user.user.bottomless_compost_charges = 3;
		user.user.bottomless_compost_type = CropUpgradeType.ultracompost;

		const result = await prepareFarmingStep({
			user,
			plant: herbPlant,
			quantity: 4,
			pay: false,
			patchDetailed: herbPatchDetailed,
			maxTripLength: 60 * 60 * 1000,
			availableBank: user.bank.clone().add('Coins', user.GP),
			compostTier: CropUpgradeType.ultracompost
		});
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.upgradeType).toBe(CropUpgradeType.ultracompost);
		expect(result.data.bucketChargesUsed).toBe(3);
		expect(result.data.cost.amount('Ultracompost')).toBe(1);
		expect(result.data.cost.amount(bucketName)).toBe(0);
		expect(result.data.infoStr.some(line => line.includes('Bottomless compost bucket'))).toBe(true);
		expect(result.data.infoStr.join('\n').length).toBeLessThan(2000 - 150);
	});

	it('does not use a higher bucket type than the chosen default unless Best available is on', async () => {
		const bank = new Bank().add(bucketName).add('Guam seed', 4);
		const user = mockMUser({
			bank,
			skills_farming: 1_000_000
		});
		user.user.bottomless_compost_charges = 4;
		user.user.bottomless_compost_type = CropUpgradeType.ultracompost;

		const asSuper = await prepareFarmingStep({
			user,
			plant: herbPlant,
			quantity: 4,
			pay: false,
			patchDetailed: herbPatchDetailed,
			maxTripLength: 60 * 60 * 1000,
			availableBank: user.bank.clone(),
			compostTier: CropUpgradeType.supercompost
		});
		expect(asSuper.success).toBe(true);
		if (!asSuper.success) return;
		expect(asSuper.data.upgradeType).toBeNull();
		expect(asSuper.data.bucketChargesUsed).toBe(0);

		const bestUser = mockMUser({
			bank,
			skills_farming: 1_000_000,
			bitfield: [BitField.UseBestAvailableCompost]
		});
		bestUser.user.bottomless_compost_charges = 4;
		bestUser.user.bottomless_compost_type = CropUpgradeType.ultracompost;
		const best = await prepareFarmingStep({
			user: bestUser,
			plant: herbPlant,
			quantity: 4,
			pay: false,
			patchDetailed: herbPatchDetailed,
			maxTripLength: 60 * 60 * 1000,
			availableBank: bestUser.bank.clone(),
			compostTier: CropUpgradeType.supercompost
		});
		expect(best.success).toBe(true);
		if (!best.success) return;
		expect(best.data.upgradeType).toBe(CropUpgradeType.ultracompost);
		expect(best.data.bucketChargesUsed).toBe(4);
		expect(best.data.cost.amount('Ultracompost')).toBe(0);
	});
});

describe('Bottomless compost bucket Discord length limits', () => {
	const DISCORD_CONTENT_LIMIT = 2000;
	const LENGTH_BUFFER = 150;

	it('keeps fill, empty, check, treatment, and removal messages under the Discord cap', () => {
		const full = calcFillBottomless({
			state: normalizeBottomlessState({ owned: true, charges: 0, type: null }),
			compostType: 'ultracompost',
			ownedCompost: 5000,
			requestedQuantity: 5000
		});
		expect(full.ok).toBe(true);
		if (!full.ok) return;
		for (const text of [full.confirmMessage, full.successMessage]) {
			expect(text.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - LENGTH_BUFFER);
		}

		const empty = calcEmptyBottomless(
			normalizeBottomlessState({ owned: true, charges: BOTTOMLESS_COMPOST_MAX_CHARGES, type: 'ultracompost' })
		);
		expect(empty.ok).toBe(true);
		if (!empty.ok) return;
		for (const text of [empty.confirmMessage, empty.successMessage]) {
			expect(text.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - LENGTH_BUFFER);
		}

		const check = checkBottomlessMessage(
			normalizeBottomlessState({ owned: true, charges: BOTTOMLESS_COMPOST_MAX_CHARGES, type: 'ultracompost' })
		);
		const removal = chargedBottomlessRemovalError(
			normalizeBottomlessState({ owned: true, charges: BOTTOMLESS_COMPOST_MAX_CHARGES, type: 'ultracompost' })
		);
		const treatment = formatPatchTreatment(new Bank().add('Ultracompost', 99_999), {
			typeName: 'Ultracompost',
			charges: BOTTOMLESS_COMPOST_MAX_CHARGES
		});
		for (const text of [check, removal, treatment]) {
			expect(text.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - LENGTH_BUFFER);
		}
	});
});
