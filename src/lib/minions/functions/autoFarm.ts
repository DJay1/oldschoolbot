import { ButtonBuilder, ButtonStyle } from '@oldschoolgg/discord';
import { Emoji, formatDuration } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import type { CropUpgradeType } from '@/prisma/main/enums.js';
import { AutoFarmFilterEnum } from '@/prisma/main/enums.js';
import { MessageBuilderClass } from '@/discord/MessageBuilder.js';
import { InteractionID } from '@/lib/InteractionID.js';
import { allFarm, replant } from '@/lib/minions/functions/autoFarmFilters.js';
import {
	AUTO_FARM_START_MESSAGE_SAFE_LIMIT,
	buildAutoFarmPlan,
	buildFallbackPlantsByPatch,
	buildPlanRequests,
	buildSummaryForStep,
	formatCouldNotReplantLine,
	type PlannedAutoFarmStep,
	selectCandidateForPatch
} from '@/lib/minions/functions/autoFarmHelpers.js';
import {
	getPlantsForPatch,
	parsePreferredSeeds,
	preferencesEqual,
	rememberCropsInPreferences,
	serializePreferredSeeds
} from '@/lib/skilling/skills/farming/autoFarm/preferences.js';
import {
	applyBottomlessUse,
	bottomlessChargeUpdates,
	getBottomlessState
} from '@/lib/skilling/skills/farming/bottomlessCompostBucket.js';
import { plants } from '@/lib/skilling/skills/farming/index.js';
import {
	condenseCompostInfoLines,
	formatBottomlessChargesUsed,
	formatFarmingBoosts,
	formatItemsUsed
} from '@/lib/skilling/skills/farming/utils/farmingFormatters.js';
import type { FarmingPatchName } from '@/lib/skilling/skills/farming/utils/farmingHelpers.js';
import type { IPatchData, IPatchDataDetailed } from '@/lib/skilling/skills/farming/utils/types.js';
import type { AutoFarmStepData, FarmingActivityTaskOptions } from '@/lib/types/minions.js';
import addSubTaskToActivityTask from '@/lib/util/addSubTaskToActivityTask.js';
import { calcMaxTripLength } from '@/lib/util/calcMaxTripLength.js';
import { formatTripDuration } from '@/lib/util/minionUtils.js';

export interface PrepareAutoFarmResult {
	plannedSteps: PlannedAutoFarmStep[];
	totalDuration: number;
	totalCost: Bank;
	maxTripLength: number;
	skippedDueToTripLength: boolean;
	skippedPatchNamesDueToTripLength: string[];
	firstPrepareError: string | null;
	errorString: string;
	autoFarmPlan: AutoFarmStepData[];
	totalBucketChargesUsed: number;
	bottomlessBefore: ReturnType<typeof getBottomlessState>;
}

export async function planAutoFarmTrip(
	user: MUser,
	patchesDetailed: IPatchDataDetailed[],
	patches: Record<FarmingPatchName, IPatchData>
): Promise<PrepareAutoFarmResult> {
	const farmingLevel = user.skillsAsLevels.farming;
	const autoFarmFilter = user.autoFarmFilter ?? AutoFarmFilterEnum.AllFarm;
	const preferContract = Boolean(user.user.minion_farmingPreferredContract);
	const preferredSeeds = parsePreferredSeeds(user.user.minion_farmingPreferredSeeds);
	const baseBank = user.bank.clone().add('Coins', user.GP);

	const eligiblePlants = [...plants]
		.filter(p => {
			switch (autoFarmFilter) {
				case AutoFarmFilterEnum.AllFarm:
					return allFarm(p, farmingLevel, user, user.bank);
				case AutoFarmFilterEnum.Replant:
					return replant(p, farmingLevel, user, user.bank, patchesDetailed);
				default:
					return allFarm(p, farmingLevel, user, user.bank);
			}
		})
		.sort((a, b) => b.level - a.level);

	const maxTripLength = await calcMaxTripLength(user, 'Farming');
	const compostTier = ((user.user.minion_defaultCompostToUse as CropUpgradeType) ?? 'compost') as CropUpgradeType;

	const plannedSteps: PlannedAutoFarmStep[] = [];
	let totalDuration = 0;
	const totalCost = new Bank();
	const remainingBank = baseBank.clone();
	const remainingBottomless = getBottomlessState(user);
	const totalBucketChargesUsed = { value: 0 };
	let skippedDueToTripLength = false;
	const skippedPatchNamesDueToTripLength = new Set<string>();

	const hasPreferenceInfluence = preferContract || preferredSeeds.size > 0;
	let errorString =
		autoFarmFilter === AutoFarmFilterEnum.AllFarm
			? "There's no Farming crops that you have the requirements to plant, and nothing to harvest."
			: "There's no Farming crops that you have planted that are ready to be replanted or no seeds remaining.";
	if (hasPreferenceInfluence) {
		errorString = "There's no Farming actions available for your saved preferences.";
	}

	let firstPrepareError: string | null = null;

	const patchesByName = new Map<FarmingPatchName, IPatchDataDetailed>(
		patchesDetailed.map(patch => [patch.patchName, patch])
	);
	const fallbackPlantsByPatch = buildFallbackPlantsByPatch(eligiblePlants, patchesByName);

	const contract = user.farmingContract();
	const hasActiveContract = Boolean(contract.contract?.hasContract);
	const assignedContractPlant =
		hasActiveContract && contract.contract?.plantToGrow
			? (contract.plant ??
				(contract.contract?.plantToGrow ? plants.find(pl => pl.name === contract.contract?.plantToGrow) : null))
			: null;
	const contractPlant =
		assignedContractPlant &&
		assignedContractPlant.level <= farmingLevel &&
		user.bank.has(assignedContractPlant.inputItems)
			? assignedContractPlant
			: null;

	const replantFilter = autoFarmFilter === AutoFarmFilterEnum.Replant;
	const planRequests = buildPlanRequests({
		patchesDetailed,
		preferredSeeds,
		preferContract,
		hasActiveContract,
		contractPlant: contractPlant ?? null,
		fallbackPlantsByPatch,
		replantFilter
	});

	for (const request of planRequests) {
		const patch = request.patch;
		const candidates =
			request.type === 'highest'
				? getPlantsForPatch(patch.patchName)
				: request.plants && request.plants.length > 0
					? request.plants
					: request.plant
						? [request.plant]
						: [];
		const levelEligibleCandidates = candidates.filter(candidate => candidate.level <= farmingLevel);
		if (levelEligibleCandidates.length === 0) {
			continue;
		}

		const selection = await selectCandidateForPatch({
			user,
			patch,
			candidates: levelEligibleCandidates,
			maxTripLength,
			remainingBank,
			totalDuration,
			totalCost,
			compostTier,
			patches,
			skippedPatchNamesDueToTripLength,
			plannedSteps,
			quantity: request.quantity,
			remainingBottomless,
			totalBucketChargesUsed,
			replantFilter
		});

		totalDuration = selection.updatedTotalDuration;
		skippedDueToTripLength = skippedDueToTripLength || selection.skippedDueToTripLength;
		if (!selection.planned && selection.firstError && !firstPrepareError) {
			firstPrepareError = selection.firstError;
		}
	}

	const autoFarmPlan = buildAutoFarmPlan(plannedSteps, Date.now());

	return {
		plannedSteps,
		totalDuration,
		totalCost,
		maxTripLength,
		skippedDueToTripLength,
		skippedPatchNamesDueToTripLength: [...skippedPatchNamesDueToTripLength],
		firstPrepareError,
		errorString,
		autoFarmPlan,
		totalBucketChargesUsed: totalBucketChargesUsed.value,
		bottomlessBefore: getBottomlessState(user)
	};
}

export function buildAutoFarmTripStartMessage({
	minionName,
	tripDurationText,
	summaryLines,
	couldNotReplantLine,
	itemsUsed,
	chargeLine,
	infoDetails,
	uniqueBoosts,
	skippedDueToTripLength,
	skippedPatchNames,
	maxTripLength
}: {
	minionName: string;
	tripDurationText: string;
	summaryLines: string[];
	couldNotReplantLine: string;
	itemsUsed: string;
	chargeLine?: string;
	infoDetails: string[];
	uniqueBoosts: string[];
	skippedDueToTripLength: boolean;
	skippedPatchNames: string[];
	maxTripLength: number;
}): string {
	const patchGroupCount = summaryLines.length;
	const intro = `${minionName} is now auto farming ${patchGroupCount.toLocaleString()} patch group${
		patchGroupCount === 1 ? '' : 's'
	}, the trip will return in about ${tripDurationText}:`;
	const skippedPatchStr = skippedDueToTripLength
		? skippedPatchNames.length > 0
			? `Skipped due to trip length: ${skippedPatchNames.join(', ')}. Your maximum trip length is ${formatDuration(maxTripLength)}.`
			: `Some ready patches were skipped. Your maximum trip length is ${formatDuration(maxTripLength)}.`
		: '';
	const condensedInfo = infoDetails.length > 0 ? condenseCompostInfoLines(infoDetails).join('\n') : '';
	const boostText = formatFarmingBoosts(uniqueBoosts, { label: '**Boosts**:', suffix: '' });

	const assemble = ({
		warning,
		lines,
		includeItems,
		includeInfo,
		includeBoosts,
		includeSkipped
	}: {
		warning: string;
		lines: string[];
		includeItems: boolean;
		includeInfo: boolean;
		includeBoosts: boolean;
		includeSkipped: boolean;
	}) => {
		let response = intro;
		if (warning) {
			response += `\n\n${warning}`;
		}
		response += `\n\n**Patches:**\n${lines.join('\n')}`;
		if (chargeLine) {
			response += `\n\n${chargeLine}`;
		}
		if (includeItems && itemsUsed.length > 0) {
			response += `\n\n${itemsUsed}`;
		}
		if (includeInfo && condensedInfo.length > 0) {
			response += `\n\n${condensedInfo}`;
		}
		if (includeBoosts) {
			response += boostText;
		}
		if (includeSkipped && skippedPatchStr) {
			response += `\n\n${skippedPatchStr}`;
		}
		return response;
	};

	let warning = couldNotReplantLine;
	let lines = [...summaryLines];
	let includeItems = true;
	let includeInfo = true;
	let includeBoosts = true;
	let includeSkipped = true;
	let response = assemble({ warning, lines, includeItems, includeInfo, includeBoosts, includeSkipped });

	const shrinkSteps: Array<() => boolean> = [
		() => {
			if (!includeInfo) return false;
			includeInfo = false;
			return true;
		},
		() => {
			if (!includeBoosts) return false;
			includeBoosts = false;
			return true;
		},
		() => {
			if (!includeSkipped) return false;
			includeSkipped = false;
			return true;
		},
		() => {
			if (!includeItems) return false;
			includeItems = false;
			return true;
		},
		() => {
			const keptCount = lines.filter(line => !line.startsWith('And ')).length;
			if (keptCount <= 1) return false;
			const nextCount = keptCount - 1;
			const omitted = summaryLines.length - nextCount;
			lines = [
				...summaryLines.slice(0, nextCount),
				`And ${omitted} more patch group${omitted === 1 ? '' : 's'}.`
			];
			return true;
		}
	];

	let step = 0;
	while (response.length > AUTO_FARM_START_MESSAGE_SAFE_LIMIT && step < 100) {
		const shrink = shrinkSteps[Math.min(step, shrinkSteps.length - 1)];
		if (!shrink()) {
			if (warning.length > 120) {
				warning = `${warning.slice(0, 117).trimEnd()}...`;
			} else {
				break;
			}
		}
		response = assemble({ warning, lines, includeItems, includeInfo, includeBoosts, includeSkipped });
		step += 1;
	}

	return response;
}

export async function autoFarm(
	user: MUser,
	patchesDetailed: IPatchDataDetailed[],
	patches: Record<FarmingPatchName, IPatchData>,
	interaction: MInteraction
) {
	if (await user.minionIsBusy()) {
		return 'Your minion must not be busy to use this command.';
	}

	const planning = await planAutoFarmTrip(user, patchesDetailed, patches);
	const {
		plannedSteps,
		totalDuration,
		totalCost,
		maxTripLength,
		skippedDueToTripLength,
		skippedPatchNamesDueToTripLength,
		firstPrepareError,
		errorString,
		autoFarmPlan,
		totalBucketChargesUsed,
		bottomlessBefore
	} = planning;

	if (plannedSteps.length === 0) {
		if (firstPrepareError !== null) {
			return firstPrepareError;
		}

		const checkPatchesButton = new ButtonBuilder()
			.setCustomId(InteractionID.Commands.CheckPatches)
			.setLabel('Check Patches')
			.setEmoji({ name: Emoji.Stopwatch })
			.setStyle(ButtonStyle.Secondary);

		const components: ButtonBuilder[] = [checkPatchesButton];

		return new MessageBuilderClass().setContent(errorString).addComponents(components);
	}

	const firstStep = autoFarmPlan[0];
	if (!firstStep) {
		return errorString;
	}

	const channelId = interaction.channelId;
	const firstTask = {
		userID: user.id,
		type: 'Farming',
		duration: totalDuration,
		channelId,
		plantsName: firstStep.plantsName,
		patchType: firstStep.patchType,
		quantity: firstStep.quantity,
		upgradeType: firstStep.upgradeType,
		payment: firstStep.payment,
		treeChopFeePaid: firstStep.treeChopFeePaid,
		treeChopFeePlanned: firstStep.treeChopFeePlanned,
		planting: firstStep.planting,
		autoFarmed: true,
		autoFarmCombined: autoFarmPlan.length > 1,
		autoFarmPlan,
		currentDate: firstStep.currentDate,
		patchName: firstStep.patchName
	} satisfies Omit<FarmingActivityTaskOptions, 'finishDate' | 'id'>;

	let chargedCost = false;
	try {
		if (!user.owns(totalCost)) {
			return `You don't own ${totalCost}.`;
		}
		if (totalCost.length > 0 || totalBucketChargesUsed > 0) {
			await user.transactItems({
				itemsToRemove: totalCost.length > 0 ? totalCost : undefined,
				otherUpdates:
					totalBucketChargesUsed > 0
						? bottomlessChargeUpdates(applyBottomlessUse(bottomlessBefore, totalBucketChargesUsed))
						: undefined
			});
			chargedCost = true;
		}
		await addSubTaskToActivityTask(firstTask);
	} catch (err) {
		const startFailContext = { type: 'AUTO_FARM_START_FAIL', user_id: user.id, charged_cost: chargedCost };
		if ((globalThis as { prisma?: unknown }).prisma) {
			Logging.logError(err as Error, startFailContext);
		} else {
			Logging.logDebug(`AutoFarm failed to start for ${user.id}: ${(err as Error).message}`, startFailContext);
		}
		if (chargedCost && (totalCost.length > 0 || totalBucketChargesUsed > 0)) {
			try {
				await user.transactItems({
					itemsToAdd: totalCost.length > 0 ? totalCost : undefined,
					otherUpdates: totalBucketChargesUsed > 0 ? bottomlessChargeUpdates(bottomlessBefore) : undefined
				});
			} catch (refundErr) {
				Logging.logError(refundErr as Error);
			}
		}
		if (err instanceof Error) {
			return err.message;
		}
		return 'There was an error starting your activity.';
	}
	const currentPreferences = parsePreferredSeeds(user.user.minion_farmingPreferredSeeds);
	const nextPreferences = rememberCropsInPreferences(
		currentPreferences,
		plannedSteps
			.filter(step => step.planting !== false)
			.map(step => ({ patchName: step.patchName, plant: step.plant }))
	);
	if (!preferencesEqual(currentPreferences, nextPreferences)) {
		try {
			await user.update({
				minion_farmingPreferredSeeds: serializePreferredSeeds(nextPreferences)
			});
		} catch (err) {
			if ((globalThis as { prisma?: unknown }).prisma) {
				Logging.logError(err as Error);
			} else {
				Logging.logDebug(`Failed to save Auto Farm crop preference: ${(err as Error).message}`);
			}
		}
	}

	await ClientSettings.updateBankSetting('farming_cost_bank', totalCost);
	await user.statsBankUpdate('farming_plant_cost_bank', totalCost);

	const uniqueBoosts = [...new Set(plannedSteps.flatMap(step => step.boosts))];
	const summaryLines: string[] = [];
	const infoDetails: string[] = [];

	plannedSteps.forEach((step, index) => {
		const { summaryLine, extraInfoLines } = buildSummaryForStep(index, step);
		summaryLines.push(summaryLine);
		infoDetails.push(...extraInfoLines);
	});

	const couldNotReplantLine = formatCouldNotReplantLine(
		plannedSteps
			.filter(step => step.couldNotReplantNeed)
			.map(step => ({ friendlyName: step.friendlyName, need: step.couldNotReplantNeed as string }))
	);

	return buildAutoFarmTripStartMessage({
		minionName: user.minionName,
		tripDurationText: formatTripDuration(user, totalDuration),
		summaryLines,
		couldNotReplantLine,
		itemsUsed: formatItemsUsed(totalCost),
		chargeLine: formatBottomlessChargesUsed(
			totalBucketChargesUsed,
			Math.max(0, bottomlessBefore.charges - totalBucketChargesUsed)
		),
		infoDetails,
		uniqueBoosts,
		skippedDueToTripLength,
		skippedPatchNames: skippedPatchNamesDueToTripLength,
		maxTripLength
	});
}
