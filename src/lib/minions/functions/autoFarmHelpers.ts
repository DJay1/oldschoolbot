import { formatDuration } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import type { CropUpgradeType } from '@/prisma/main/enums.js';
import {
	getPreferredPlants,
	lastPlantedCrop,
	resolveSeedForPatch
} from '@/lib/skilling/skills/farming/autoFarm/preferences.js';
import {
	applyBottomlessUse,
	type BottomlessCompostState
} from '@/lib/skilling/skills/farming/bottomlessCompostBucket.js';
import type { FarmingPatchName } from '@/lib/skilling/skills/farming/utils/farmingHelpers.js';
import type {
	FarmingSeedPreference,
	IPatchData,
	IPatchDataDetailed
} from '@/lib/skilling/skills/farming/utils/types.js';
import type { Plant } from '@/lib/skilling/types.js';
import type { AutoFarmStepData } from '@/lib/types/minions.js';
import { prepareFarmingStep } from './farmingTripHelpers.js';

export interface PlannedAutoFarmStep {
	plant: Plant;
	quantity: number;
	duration: number;
	upgradeType: CropUpgradeType | null;
	didPay: boolean;
	treeChopFee: number;
	patch: IPatchData;
	patchName: FarmingPatchName;
	friendlyName: string;
	info: string[];
	boosts: string[];
	bucketChargesUsed?: number;
	planting?: boolean;
	couldNotReplantNeed?: string;
}

export interface PlanRequest {
	type: 'highest' | 'plant';
	patch: IPatchDataDetailed;
	plant?: Plant;
	plants?: Plant[];
	quantity?: number;
}

export interface BuildSummaryResult {
	summaryLine: string;
	extraInfoLines: string[];
}

interface CandidateEvaluationResult {
	success: boolean;
	error?: string;
	plannedStep?: PlannedAutoFarmStep;
	updatedTotalDuration?: number;
	skippedTripLength?: boolean;
}

export function shouldHideInfoLine(line: string): boolean {
	const normalized = line.toLowerCase();
	return (
		normalized.startsWith('you are treating your patches with') ||
		normalized.startsWith('you are paying a nearby farmer') ||
		normalized.startsWith('you may need to pay a nearby farmer')
	);
}

export function buildSummaryForStep(index: number, step: PlannedAutoFarmStep): BuildSummaryResult {
	const extraInfoLines = step.info
		.filter(infoLine => !shouldHideInfoLine(infoLine))
		.map(infoLine => `${step.friendlyName}: ${infoLine}`);

	const summaryLine =
		step.planting === false
			? `${index + 1}. ${step.friendlyName}: harvested ${step.quantity.toLocaleString()}x ${step.plant.name} (not replanted)`
			: `${index + 1}. ${step.friendlyName}: ${step.quantity.toLocaleString()}x ${step.plant.name}`;

	return {
		summaryLine,
		extraInfoLines
	};
}

export function missingPlantInputNames(plant: Plant, bank: Bank): string[] {
	const names: string[] = [];
	for (const [item, qty] of plant.inputItems.items()) {
		if (bank.amount(item.id) < qty && !names.includes(item.name)) {
			names.push(item.name);
		}
	}
	return names;
}

export const AUTO_FARM_START_MESSAGE_SAFE_LIMIT = 2000 - 150;
const COULD_NOT_REPLANT_LINE_LIMIT = 500;

export function formatCouldNotReplantLine(
	entries: { friendlyName: string; need: string }[],
	maxLength = COULD_NOT_REPLANT_LINE_LIMIT
): string {
	if (entries.length === 0) {
		return '';
	}
	const prefix = "⚠️ Couldn't replant: ";
	const partFor = (entry: { friendlyName: string; need: string }) => `${entry.friendlyName} (need ${entry.need})`;
	const full = `${prefix}${entries.map(partFor).join(', ')}.`;
	if (full.length <= maxLength) {
		return full;
	}

	const kept: string[] = [];
	for (let i = 0; i < entries.length; i++) {
		const remaining = entries.length - (i + 1);
		const suffix = remaining > 0 ? `, and ${remaining} more.` : '.';
		const candidate = `${prefix}${[...kept, partFor(entries[i])].join(', ')}${suffix}`;
		if (candidate.length > maxLength) {
			break;
		}
		kept.push(partFor(entries[i]));
	}
	if (kept.length === 0) {
		const fallback = `${prefix}${entries.length} patches (need the same seed).`;
		return fallback.length <= maxLength ? fallback : fallback.slice(0, maxLength);
	}
	const remaining = entries.length - kept.length;
	return `${prefix}${kept.join(', ')}${remaining > 0 ? `, and ${remaining} more.` : '.'}`;
}

export function buildPlanRequests({
	patchesDetailed,
	preferredSeeds,
	preferContract,
	hasActiveContract,
	contractPlant,
	fallbackPlantsByPatch,
	replantFilter = false
}: {
	patchesDetailed: IPatchDataDetailed[];
	preferredSeeds: Map<FarmingPatchName, FarmingSeedPreference>;
	preferContract: boolean;
	hasActiveContract: boolean;
	contractPlant: Plant | null | undefined;
	fallbackPlantsByPatch: Map<FarmingPatchName, Plant>;
	replantFilter?: boolean;
}): PlanRequest[] {
	const planRequests: PlanRequest[] = [];
	for (const patch of patchesDetailed) {
		const preferredQuantity = replantFilter ? undefined : preferredSeeds.get(patch.patchName)?.quantity;
		const resolved = resolveSeedForPatch({
			patch,
			preferContract,
			hasActiveContract,
			contractPlant: contractPlant ?? null,
			preferences: preferredSeeds,
			fallbackPlant: fallbackPlantsByPatch.get(patch.patchName) ?? null,
			replantFilter
		});

		if (!resolved) {
			continue;
		}

		if (resolved.type === 'plant' || resolved.type === 'plants') {
			const plants =
				resolved.type === 'plants'
					? resolved.plants
					: resolved.reason === 'preference_seed'
						? getPreferredPlants(patch.patchName, preferredSeeds.get(patch.patchName))
						: [resolved.plant];
			const chosenPlants = plants.length > 0 ? plants : resolved.type === 'plant' ? [resolved.plant] : [];
			if (chosenPlants.length === 0) {
				continue;
			}
			const planRequest: PlanRequest = {
				type: 'plant',
				patch,
				plant: chosenPlants[0],
				plants: chosenPlants,
				quantity: preferredQuantity
			};
			if (resolved.reason === 'contract') {
				planRequests.unshift(planRequest);
			} else {
				planRequests.push(planRequest);
			}
			continue;
		}

		planRequests.push({ type: 'highest', patch, quantity: preferredQuantity });
	}

	return planRequests;
}

export function buildAutoFarmPlan(plannedSteps: PlannedAutoFarmStep[], planningStartTime: number): AutoFarmStepData[] {
	const autoFarmPlan: AutoFarmStepData[] = [];
	let accumulatedDuration = 0;
	for (const step of plannedSteps) {
		autoFarmPlan.push({
			plantsName: step.plant.name,
			quantity: step.quantity,
			upgradeType: step.upgradeType,
			patchName: step.patchName,
			payment: step.didPay,
			treeChopFeePaid: step.treeChopFee,
			treeChopFeePlanned: step.treeChopFee,
			patchType: step.patch,
			planting: step.planting !== false,
			currentDate: planningStartTime + accumulatedDuration,
			duration: step.duration
		});
		accumulatedDuration += step.duration;
	}
	return autoFarmPlan;
}

export function buildFallbackPlantsByPatch(
	eligiblePlants: Plant[],
	patchesByName: Map<FarmingPatchName, IPatchDataDetailed>
): Map<FarmingPatchName, Plant> {
	const fallbackPlantsByPatch = new Map<FarmingPatchName, Plant>();
	for (const plant of eligiblePlants) {
		const patchName = plant.seedType as FarmingPatchName;
		if (fallbackPlantsByPatch.has(patchName)) {
			continue;
		}
		const patch = patchesByName.get(patchName);
		if (!patch || patch.ready === false) {
			continue;
		}
		fallbackPlantsByPatch.set(patchName, plant);
	}
	return fallbackPlantsByPatch;
}

export async function evaluateCandidateForPatch({
	user,
	candidate,
	patch,
	maxTripLength,
	remainingBank,
	totalDuration,
	totalCost,
	compostTier,
	patches,
	preferredQuantity,
	remainingBottomless,
	totalBucketChargesUsed,
	harvestOnly = false
}: {
	user: MUser;
	candidate: Plant;
	patch: IPatchDataDetailed;
	maxTripLength: number;
	remainingBank: Bank;
	totalDuration: number;
	totalCost: Bank;
	compostTier: CropUpgradeType;
	patches: Record<FarmingPatchName, IPatchData>;
	preferredQuantity?: number;
	remainingBottomless: BottomlessCompostState;
	totalBucketChargesUsed: { value: number };
	harvestOnly?: boolean;
}): Promise<CandidateEvaluationResult> {
	const prepared = await prepareFarmingStep({
		user,
		plant: candidate,
		quantity: preferredQuantity ?? null,
		pay: false,
		patchDetailed: patch,
		maxTripLength,
		availableBank: remainingBank,
		compostTier,
		bottomless: remainingBottomless,
		harvestOnly
	});
	if (!prepared.success) {
		return { success: false, error: prepared.error };
	}

	const { quantity, duration, cost, upgradeType, didPay, infoStr, boostStr, treeChopFee, bucketChargesUsed } =
		prepared.data;
	if (quantity <= 0 || duration <= 0) {
		return { success: false };
	}
	if (duration > maxTripLength) {
		return {
			success: false,
			error: `${user.minionName} can't go on trips longer than ${formatDuration(maxTripLength)}.`
		};
	}
	const totalCoinCost = cost.amount('Coins') + treeChopFee;
	if (totalCoinCost > 0 && remainingBank.amount('Coins') < totalCoinCost) {
		return { success: false, error: `You don't own ${new Bank().add('Coins', totalCoinCost)}.` };
	}
	if (!remainingBank.has(cost)) {
		return { success: false, error: `You don't own ${cost}.` };
	}
	if (totalDuration + duration > maxTripLength) {
		return {
			success: false,
			skippedTripLength: true
		};
	}
	const patchData = patches[patch.patchName];
	if (!patchData) {
		return { success: false, error: `Unable to resolve patch data for ${patch.friendlyName}.` };
	}

	remainingBank.remove(cost);
	if (treeChopFee > 0) {
		const treeFeeBank = new Bank().add('Coins', treeChopFee);
		remainingBank.remove(treeFeeBank);
		totalCost.add(treeFeeBank);
	}
	totalCost.add(cost);
	if (bucketChargesUsed > 0) {
		const next = applyBottomlessUse(remainingBottomless, bucketChargesUsed);
		remainingBottomless.charges = next.charges;
		remainingBottomless.type = next.type;
		totalBucketChargesUsed.value += bucketChargesUsed;
	}
	const updatedTotalDuration = totalDuration + duration;
	return {
		success: true,
		plannedStep: {
			plant: candidate,
			quantity,
			duration,
			upgradeType,
			didPay,
			treeChopFee,
			patch: patchData,
			patchName: patch.patchName,
			friendlyName: patch.friendlyName,
			info: infoStr,
			boosts: boostStr,
			bucketChargesUsed,
			planting: !harvestOnly
		},
		updatedTotalDuration
	};
}

export async function selectCandidateForPatch({
	user,
	patch,
	candidates,
	maxTripLength,
	remainingBank,
	totalDuration,
	totalCost,
	compostTier,
	patches,
	skippedPatchNamesDueToTripLength,
	plannedSteps,
	quantity: preferredQuantity,
	remainingBottomless,
	totalBucketChargesUsed,
	replantFilter = false
}: {
	user: MUser;
	patch: IPatchDataDetailed;
	candidates: Plant[];
	maxTripLength: number;
	remainingBank: Bank;
	totalDuration: number;
	totalCost: Bank;
	compostTier: CropUpgradeType;
	patches: Record<FarmingPatchName, IPatchData>;
	skippedPatchNamesDueToTripLength: Set<string>;
	plannedSteps: PlannedAutoFarmStep[];
	quantity?: number;
	remainingBottomless: BottomlessCompostState;
	totalBucketChargesUsed: { value: number };
	replantFilter?: boolean;
}): Promise<{
	planned: boolean;
	updatedTotalDuration: number;
	firstError: string | null;
	skippedDueToTripLength: boolean;
}> {
	let planned = false;
	let currentTotalDuration = totalDuration;
	let skippedThisPatch = false;
	const errorsForPatch: string[] = [];

	for (const candidate of candidates) {
		const result = await evaluateCandidateForPatch({
			user,
			candidate,
			patch,
			maxTripLength,
			remainingBank,
			totalDuration: currentTotalDuration,
			totalCost,
			compostTier,
			patches,
			preferredQuantity,
			remainingBottomless,
			totalBucketChargesUsed
		});
		if (!result.success) {
			if (result.skippedTripLength) {
				skippedThisPatch = true;
				skippedPatchNamesDueToTripLength.add(patch.friendlyName);
				continue;
			}
			if (result.error) {
				errorsForPatch.push(result.error);
			}
			continue;
		}
		if (result.plannedStep) {
			plannedSteps.push(result.plannedStep);
			planned = true;
			currentTotalDuration = result.updatedTotalDuration ?? currentTotalDuration;
			break;
		}
	}

	if (!planned && !skippedThisPatch && replantFilter && patch.ready === true && patch.patchPlanted) {
		const sameCrop = lastPlantedCrop(patch) ?? candidates[0] ?? null;
		if (sameCrop) {
			const harvestResult = await evaluateCandidateForPatch({
				user,
				candidate: sameCrop,
				patch,
				maxTripLength,
				remainingBank,
				totalDuration: currentTotalDuration,
				totalCost,
				compostTier,
				patches,
				remainingBottomless,
				totalBucketChargesUsed,
				harvestOnly: true
			});
			if (harvestResult.success && harvestResult.plannedStep) {
				const missing = missingPlantInputNames(sameCrop, remainingBank);
				harvestResult.plannedStep.couldNotReplantNeed =
					missing.length > 0 ? missing.join(', ') : 'the same seed';
				plannedSteps.push(harvestResult.plannedStep);
				planned = true;
				currentTotalDuration = harvestResult.updatedTotalDuration ?? currentTotalDuration;
			} else if (harvestResult.skippedTripLength) {
				skippedThisPatch = true;
				skippedPatchNamesDueToTripLength.add(patch.friendlyName);
			} else if (harvestResult.error && errorsForPatch.length === 0) {
				errorsForPatch.push(harvestResult.error);
			}
		}
	}

	return {
		planned,
		updatedTotalDuration: currentTotalDuration,
		firstError: errorsForPatch[0] ?? null,
		skippedDueToTripLength: skippedThisPatch
	};
}
