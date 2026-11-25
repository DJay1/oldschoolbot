import { stringMatches } from '@oldschoolgg/toolkit';
import { Items } from 'oldschooljs';

import { plants } from '@/lib/skilling/skills/farming/index.js';
import type { FarmingPatchName } from '@/lib/skilling/skills/farming/utils/farmingHelpers.js';
import { findPlant, isPatchName } from '@/lib/skilling/skills/farming/utils/farmingHelpers.js';
import type {
	FarmingPreferredSeeds,
	FarmingSeedPreference,
	IPatchDataDetailed
} from '@/lib/skilling/skills/farming/utils/types.js';
import type { Plant } from '@/lib/skilling/types.js';

export const MAX_PREFERRED_SEEDS_PER_PATCH = 5;
export const PREFERRED_SEEDS_EMBED_DESCRIPTION_LIMIT = 4096 - 150;

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

function isValidPreferenceRecord(
	value: unknown
): value is { type: string; seedID?: unknown; seedIDs?: unknown; fallbackSeedIDs?: unknown; quantity?: unknown } {
	return isRecord(value) && typeof value.type === 'string';
}

export function normalizeSeedIDList(patchName: FarmingPatchName, seedIDs: unknown): number[] {
	const rawIDs = Array.isArray(seedIDs) ? seedIDs : [seedIDs];
	const result: number[] = [];
	for (const id of rawIDs) {
		if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) {
			continue;
		}
		if (result.includes(id)) {
			continue;
		}
		if (!findPlantBySeedID(id, patchName)) {
			continue;
		}
		result.push(id);
		if (result.length >= MAX_PREFERRED_SEEDS_PER_PATCH) {
			break;
		}
	}
	return result;
}

export function preferenceFromSeedIDs(seedIDs: number[], quantity?: number): FarmingSeedPreference | null {
	if (seedIDs.length === 0) {
		return null;
	}
	const [seedID, ...fallbackSeedIDs] = seedIDs;
	const quantityData = quantity === undefined ? {} : { quantity };
	return fallbackSeedIDs.length > 0
		? { type: 'seed', seedID, fallbackSeedIDs, ...quantityData }
		: { type: 'seed', seedID, ...quantityData };
}

export function getPreferenceSeedIDs(preference: FarmingSeedPreference): number[] {
	if (preference.type !== 'seed') {
		return [];
	}
	const unique: number[] = [];
	for (const id of [preference.seedID, ...(preference.fallbackSeedIDs ?? [])]) {
		if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) {
			continue;
		}
		if (unique.includes(id)) {
			continue;
		}
		unique.push(id);
		if (unique.length >= MAX_PREFERRED_SEEDS_PER_PATCH) {
			break;
		}
	}
	return unique;
}

export function getPreferredPlants(
	patchName: FarmingPatchName,
	preference: FarmingSeedPreference | undefined
): Plant[] {
	if (!preference || preference.type !== 'seed') {
		return [];
	}
	const plantsForIDs: Plant[] = [];
	for (const seedID of normalizeSeedIDList(patchName, [preference.seedID, ...(preference.fallbackSeedIDs ?? [])])) {
		const plant = findPlantBySeedID(seedID, patchName);
		if (plant) {
			plantsForIDs.push(plant);
		}
	}
	return plantsForIDs;
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

	if (value.type === 'highest_available') {
		return quantity === undefined ? { type: 'highest_available' } : { type: 'highest_available', quantity };
	}
	if (value.type === 'empty') {
		return quantity === undefined ? { type: 'empty' } : { type: 'empty', quantity };
	}
	if (value.type === 'seed') {
		const rawIDs: unknown[] = [];
		if (typeof value.seedID === 'number') {
			rawIDs.push(value.seedID);
		}
		if (Array.isArray(value.seedIDs)) {
			rawIDs.push(...value.seedIDs);
		}
		if (Array.isArray(value.fallbackSeedIDs)) {
			rawIDs.push(...value.fallbackSeedIDs);
		}
		return preferenceFromSeedIDs(normalizeSeedIDList(patchName, rawIDs), quantity);
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

function resolveSeedNameForPatch(patchName: FarmingPatchName, seedInput: string): number | string {
	const trimmed = seedInput.trim();
	const normalized = trimmed.toLowerCase().replace(/\s+/g, '_');
	const plantsForPatch = getPlantsForPatch(patchName);
	let matchingPlant = plantsForPatch.find(
		plant => stringMatches(plant.name, trimmed) || plant.aliases.some(alias => stringMatches(alias, trimmed))
	);

	if (!matchingPlant) {
		matchingPlant = plantsForPatch.find(plant =>
			plant.inputItems
				.items()
				.some(([item]) => stringMatches(item.name, trimmed) || stringMatches(item.name, normalized))
		);
	}

	if (!matchingPlant) {
		return `I couldn't find a seed or plant matching "${seedInput}" for that patch.`;
	}

	const seedID = getPrimarySeedForPlant(matchingPlant);
	if (!seedID) {
		return `Unable to determine the seed item for ${matchingPlant.name}.`;
	}

	return seedID;
}

export function parseSeedPreferenceInput(
	patchName: FarmingPatchName,
	seedInput: string
): FarmingSeedPreference | string {
	const trimmed = seedInput.trim();
	if (trimmed.length === 0) {
		return 'Please specify a seed preference.';
	}

	const parts = trimmed
		.split(',')
		.map(part => part.trim())
		.filter(part => part.length > 0);
	if (parts.length === 0) {
		return 'Please specify a seed preference.';
	}
	if (parts.length > MAX_PREFERRED_SEEDS_PER_PATCH) {
		return `You can set up to ${MAX_PREFERRED_SEEDS_PER_PATCH} preferred seeds for each patch type.`;
	}

	const specials = parts.map(part => part.toLowerCase().replace(/\s+/g, '_'));
	const hasHighest = specials.includes('highest_available');
	const hasEmpty = specials.includes('empty');
	if ((hasHighest || hasEmpty) && parts.length > 1) {
		return 'highest_available and empty cannot be combined with a seed list.';
	}
	if (hasHighest) {
		return { type: 'highest_available' };
	}
	if (hasEmpty) {
		return { type: 'empty' };
	}

	const seedIDs: number[] = [];
	for (const part of parts) {
		const seedID = resolveSeedNameForPatch(patchName, part);
		if (typeof seedID === 'string') {
			return seedID;
		}
		if (!seedIDs.includes(seedID)) {
			seedIDs.push(seedID);
		}
	}
	const preference = preferenceFromSeedIDs(seedIDs);
	if (!preference) {
		return 'Please specify a seed preference.';
	}
	return preference;
}

export function appendPreferredSeeds(
	existing: FarmingSeedPreference | undefined,
	incoming: FarmingSeedPreference,
	patchFriendlyName: string
): FarmingSeedPreference | string {
	if (incoming.type !== 'seed') {
		return 'Use add with a seed name, not highest_available or empty.';
	}
	if (existing && existing.type !== 'seed') {
		return `Clear the saved preference for ${patchFriendlyName} before adding fallback seeds.`;
	}
	if (!existing) {
		return incoming;
	}

	const currentIDs = getPreferenceSeedIDs(existing);
	const incomingIDs = getPreferenceSeedIDs(incoming);
	const toAdd = incomingIDs.filter(id => !currentIDs.includes(id));
	if (toAdd.length === 0) {
		const names = incomingIDs.map(id => Items.getItem(id)?.name ?? `Item ${id}`);
		if (names.length === 1) {
			return `${names[0]} is already in your ${patchFriendlyName} preference list.`;
		}
		return `${names.join(', ')} are already in your ${patchFriendlyName} preference list.`;
	}
	if (currentIDs.length + toAdd.length > MAX_PREFERRED_SEEDS_PER_PATCH) {
		return `You can set up to ${MAX_PREFERRED_SEEDS_PER_PATCH} preferred seeds for each patch type.`;
	}
	const merged = preferenceFromSeedIDs([...currentIDs, ...toAdd], existing.quantity);
	if (!merged) {
		return 'Please specify a seed preference.';
	}
	return merged;
}

export function formatSeedPreference(preference: FarmingSeedPreference): string {
	if (preference.type === 'highest_available') {
		return preference.quantity === undefined
			? 'highest_available'
			: `highest_available, quantity: ${preference.quantity}`;
	}
	if (preference.type === 'empty') {
		return preference.quantity === undefined ? 'empty' : `empty, quantity: ${preference.quantity}`;
	}
	const names = getPreferenceSeedIDs(preference).map(seedID => Items.getItem(seedID)?.name ?? `Item ${seedID}`);
	const seedText = `seed: ${names.join(', then ')}`;
	return preference.quantity === undefined ? seedText : `${seedText}, quantity: ${preference.quantity}`;
}

export function buildPreferredSeedsEmbedDescription(lines: string[]): string {
	const joined = lines.join('\n');
	if (joined.length <= PREFERRED_SEEDS_EMBED_DESCRIPTION_LIMIT) {
		return joined;
	}
	const suffix = '\nAnd more patches.';
	const keep: string[] = [];
	for (const line of lines) {
		const next = `${[...keep, line].join('\n')}${suffix}`;
		if (next.length > PREFERRED_SEEDS_EMBED_DESCRIPTION_LIMIT) {
			break;
		}
		keep.push(line);
	}
	if (keep.length === 0) {
		return joined.slice(0, PREFERRED_SEEDS_EMBED_DESCRIPTION_LIMIT);
	}
	return `${keep.join('\n')}${suffix}`;
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
	| { type: 'plants'; plants: Plant[]; reason: 'preference_seed' }
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
			const preferredPlants = getPreferredPlants(patch.patchName, preference);
			if (preferredPlants.length === 0) {
				return null;
			}
			if (preferredPlants.length === 1) {
				return { type: 'plant', plant: preferredPlants[0], reason: 'preference_seed' };
			}
			return { type: 'plants', plants: preferredPlants, reason: 'preference_seed' };
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
