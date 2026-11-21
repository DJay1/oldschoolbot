import { plants } from '@/lib/skilling/skills/farming/index.js';
import type { FarmingPatchName } from '@/lib/skilling/skills/farming/utils/farmingHelpers.js';
import { findPlant, isPatchName } from '@/lib/skilling/skills/farming/utils/farmingHelpers.js';
import type {
	FarmingPreferredSeeds,
	FarmingSeedPreference,
	IPatchDataDetailed
} from '@/lib/skilling/skills/farming/utils/types.js';
import type { Plant } from '@/lib/skilling/types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const plantsByPatch = new Map<FarmingPatchName, Plant[]>();
const validPatchNames = new Set<FarmingPatchName>();
for (const plant of plants) {
	const patchName = plant.seedType as FarmingPatchName;
	validPatchNames.add(patchName);
	const list = plantsByPatch.get(patchName) ?? [];
	list.push(plant);
	plantsByPatch.set(patchName, list);
}
for (const list of plantsByPatch.values()) {
	list.sort((a, b) => b.level - a.level);
}

export function getPlantsForPatch(patchName: FarmingPatchName): Plant[] {
	return plantsByPatch.get(patchName) ?? [];
}

export function findPlantBySeedID(seedID: number, patchName: FarmingPatchName): Plant | null {
	for (const plant of getPlantsForPatch(patchName)) {
		if (plant.inputItems.amount(seedID) > 0) {
			return plant;
		}
	}
	return null;
}

function isValidPreferenceRecord(value: unknown): value is { type: string; seedID?: unknown; quantity?: unknown } {
	return isRecord(value) && typeof value.type === 'string';
}

export function normalizeSeedPreference(patchName: FarmingPatchName, value: unknown): FarmingSeedPreference | null {
	if (!isValidPreferenceRecord(value)) {
		return null;
	}

	const quantity =
		value.quantity === undefined
			? undefined
			: typeof value.quantity === 'number' && Number.isSafeInteger(value.quantity) && value.quantity > 0
				? value.quantity
				: null;
	if (quantity === null) {
		return null;
	}
	const quantityData = quantity === undefined ? {} : { quantity };

	if (value.type === 'highest_available') {
		return { type: 'highest_available', ...quantityData };
	}
	if (value.type === 'empty') {
		return { type: 'empty', ...quantityData };
	}
	if (value.type === 'seed' && typeof value.seedID === 'number') {
		const plant = findPlantBySeedID(value.seedID, patchName);
		if (!plant) {
			return null;
		}
		return { type: 'seed', seedID: value.seedID, ...quantityData };
	}
	return null;
}

export function getPrimarySeedForPlant(plant: Plant): number | null {
	for (const [item] of plant.inputItems.items()) {
		return item.id;
	}
	return null;
}

export function parsePreferredSeeds(raw: unknown): Map<FarmingPatchName, FarmingSeedPreference> {
	const result = new Map<FarmingPatchName, FarmingSeedPreference>();
	if (!isRecord(raw)) {
		return result;
	}

	for (const [key, value] of Object.entries(raw)) {
		if (!isPatchName(key)) {
			continue;
		}
		if (!validPatchNames.has(key)) {
			continue;
		}
		const normalized = normalizeSeedPreference(key, value);
		if (normalized) {
			result.set(key, normalized);
		}
	}

	return result;
}

export function serializePreferredSeeds(
	preferences: Map<FarmingPatchName, FarmingSeedPreference>
): FarmingPreferredSeeds {
	const entries: [FarmingPatchName, FarmingSeedPreference][] = [];
	for (const [patchName, preference] of preferences) {
		if (!validPatchNames.has(patchName)) {
			continue;
		}
		const normalized = normalizeSeedPreference(patchName, preference);
		if (!normalized) {
			continue;
		}
		entries.push([patchName, normalized]);
	}
	return Object.fromEntries(entries);
}

export function preferencesEqual(
	a: Map<FarmingPatchName, FarmingSeedPreference>,
	b: Map<FarmingPatchName, FarmingSeedPreference>
): boolean {
	return JSON.stringify(serializePreferredSeeds(a)) === JSON.stringify(serializePreferredSeeds(b));
}

/**
 * After Auto Farm plants a crop on a patch type with no saved preference, remember
 * that crop so later trips keep planting it until the player changes it with
 * /farming set_preferred. Existing preferences (including highest_available and empty)
 * are left alone.
 */
export function rememberCropsInPreferences(
	current: Map<FarmingPatchName, FarmingSeedPreference>,
	planted: { patchName: FarmingPatchName; plant: Plant }[]
): Map<FarmingPatchName, FarmingSeedPreference> {
	const next = new Map(current);
	for (const { patchName, plant } of planted) {
		if (next.has(patchName)) continue;
		const seedID = getPrimarySeedForPlant(plant);
		if (!seedID) continue;
		next.set(patchName, { type: 'seed', seedID });
	}
	return next;
}

export interface ResolveSeedForPatchOptions {
	patch: IPatchDataDetailed;
	preferContract: boolean;
	hasActiveContract?: boolean;
	contractPlant: Plant | null;
	preferences: Map<FarmingPatchName, FarmingSeedPreference>;
	fallbackPlant: Plant | null;
}

export type ResolvedSeedForPatchResult =
	| { type: 'plant'; plant: Plant; reason: 'contract' | 'preference_seed' | 'fallback' | 'last_planted' }
	| { type: 'highest'; reason: 'preference_highest' };

function lastPlantedCrop(patch: IPatchDataDetailed): Plant | null {
	if (patch.plant && patch.plant.seedType === patch.patchName) {
		return patch.plant;
	}
	const fromName = findPlant(patch.lastPlanted);
	if (fromName && fromName.seedType === patch.patchName) {
		return fromName;
	}
	return null;
}

export function resolveSeedForPatch({
	patch,
	preferContract,
	hasActiveContract = false,
	contractPlant,
	preferences,
	fallbackPlant
}: ResolveSeedForPatchOptions): ResolvedSeedForPatchResult | null {
	if (patch.ready === false) {
		return null;
	}

	const patchAlreadyHasContractCrop =
		patch.patchPlanted && contractPlant !== null && patch.lastPlanted === contractPlant.name;

	const contractFitsPatch =
		hasActiveContract &&
		contractPlant !== null &&
		contractPlant.seedType === patch.patchName &&
		!patchAlreadyHasContractCrop;

	if (preferContract && contractFitsPatch) {
		return { type: 'plant', plant: contractPlant, reason: 'contract' };
	}

	const preference = preferences.get(patch.patchName);
	if (preference) {
		if (preference.type === 'empty') {
			return null;
		}
		if (preference.type === 'seed') {
			const plant = findPlantBySeedID(preference.seedID, patch.patchName);
			if (!plant) {
				return null;
			}
			return { type: 'plant', plant, reason: 'preference_seed' };
		}
		if (preference.type === 'highest_available') {
			return { type: 'highest', reason: 'preference_highest' };
		}
	}

	if (contractFitsPatch) {
		return { type: 'plant', plant: contractPlant, reason: 'contract' };
	}

	// Keep planting the same crop that is already in the patch until the player
	// changes it. Do not fall through to a different seed type.
	const sameCrop = lastPlantedCrop(patch);
	if (sameCrop) {
		return { type: 'plant', plant: sameCrop, reason: 'last_planted' };
	}

	if (fallbackPlant && fallbackPlant.seedType === patch.patchName) {
		return { type: 'plant', plant: fallbackPlant, reason: 'fallback' };
	}

	return null;
}
