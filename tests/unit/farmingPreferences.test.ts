import { describe, expect, it } from 'vitest';

import './setup.js';

import {
	appendPreferredSeeds,
	buildPreferredSeedsEmbedDescription,
	formatSeedPreference,
	getPlantsForPatch,
	getPrimarySeedForPlant,
	parsePreferredSeeds,
	parseSeedPreferenceInput,
	preferenceFromSeedIDs,
	resolveSeedForPatch,
	serializePreferredSeeds
} from '@/lib/skilling/skills/farming/autoFarm/preferences.js';
import { plants } from '@/lib/skilling/skills/farming/index.js';
import type {
	FarmingPatchName,
	FarmingSeedPreference,
	IPatchDataDetailed
} from '@/lib/skilling/skills/farming/utils/types.js';

const herbPlant = plants.find(plant => plant.name === 'Guam');
const treePlant = plants.find(plant => plant.name === 'Oak tree');
const cactusPlant = plants.find(plant => plant.name === 'Cactus');

if (!herbPlant || !treePlant || !cactusPlant) {
	throw new Error('Expected Guam, Oak tree, and Cactus plants to exist for farming preference tests');
}

const [herbSeedItem] = herbPlant.inputItems.items();
const herbSeedID = herbSeedItem?.[0].id;

if (!herbSeedID) {
	throw new Error('Expected Guam plant to have a primary seed item');
}

const basePatchData: IPatchDataDetailed = {
	lastPlanted: null,
	patchPlanted: false,
	plantTime: Date.now(),
	lastQuantity: 0,
	lastUpgradeType: null,
	lastPayment: false,
	ready: true,
	readyIn: 0,
	readyAt: new Date(),
	patchName: herbPlant.seedType as FarmingPatchName,
	friendlyName: 'Herb patch',
	plant: null
};

describe('farming seed preferences', () => {
	it('parsePreferredSeeds returns empty map for undefined input', () => {
		const result = parsePreferredSeeds(undefined);
		expect(result.size).toBe(0);
	});

	it('parsePreferredSeeds normalizes valid preferences and ignores invalid patch names', () => {
		const raw = {
			[herbPlant.seedType]: { type: 'seed', seedID: herbSeedID, quantity: 2 },
			[treePlant.seedType]: { type: 'highest_available' },
			[cactusPlant.seedType]: { type: 'empty' },
			invalid_patch: { type: 'seed', seedID: 12345 },
			[herbPlant.seedType + '_wrong']: { type: 'seed', seedID: herbSeedID }
		} as const;

		const result = parsePreferredSeeds(raw);

		expect(result.get(herbPlant.seedType as FarmingPatchName)).toEqual({
			type: 'seed',
			seedID: herbSeedID,
			quantity: 2
		});
		expect(result.get(treePlant.seedType as FarmingPatchName)).toEqual({
			type: 'highest_available'
		});
		expect(result.get(cactusPlant.seedType as FarmingPatchName)).toEqual({
			type: 'empty'
		});
		expect(result.size).toBe(3);
	});

	it('parsePreferredSeeds rejects invalid quantities', () => {
		for (const quantity of [0, -1, 1.5, '2']) {
			const result = parsePreferredSeeds({
				[herbPlant.seedType]: { type: 'seed', seedID: herbSeedID, quantity }
			});
			expect(result.size).toBe(0);
		}
	});

	it('parsePreferredSeeds skips entries with unknown seed IDs', () => {
		const raw = {
			[treePlant.seedType]: { type: 'seed', seedID: 99999 }
		} as const;

		const result = parsePreferredSeeds(raw);

		expect(result.size).toBe(0);
	});

	it('serializePreferredSeeds keeps valid entries and drops invalid ones', () => {
		const preferences = new Map<FarmingPatchName, FarmingSeedPreference>([
			[herbPlant.seedType as FarmingPatchName, { type: 'seed', seedID: herbSeedID }],
			[treePlant.seedType as FarmingPatchName, { type: 'highest_available' }],
			[cactusPlant.seedType as FarmingPatchName, { type: 'seed', seedID: 999999 }],
			['unknown_patch' as FarmingPatchName, { type: 'empty' }]
		]);

		const result = serializePreferredSeeds(preferences);
		expect(result[herbPlant.seedType as FarmingPatchName]).toEqual({ type: 'seed', seedID: herbSeedID });
		expect(result[treePlant.seedType as FarmingPatchName]).toEqual({ type: 'highest_available' });
		expect(result[cactusPlant.seedType as FarmingPatchName]).toBeUndefined();
		expect((result as Record<string, unknown>).unknown_patch).toBeUndefined();
	});

	it('getPrimarySeedForPlant returns first seed and null for plants with no inputs', () => {
		expect(getPrimarySeedForPlant(herbPlant)).toBe(herbSeedID);
		expect(
			getPrimarySeedForPlant({ ...herbPlant, inputItems: herbPlant.inputItems.clone().remove(herbSeedID) })
		).toBeNull();
	});

	it('getPlantsForPatch returns sorted plant list and handles empty patches', () => {
		const herbPlants = getPlantsForPatch(herbPlant.seedType as FarmingPatchName);
		expect(herbPlants.length).toBeGreaterThan(0);
		for (let i = 1; i < herbPlants.length; i++) {
			expect(herbPlants[i - 1].level).toBeGreaterThanOrEqual(herbPlants[i].level);
		}

		const noPlants = getPlantsForPatch('unknown_patch' as FarmingPatchName);
		expect(noPlants).toEqual([]);
	});

	it('resolveSeedForPatch prioritizes contract plants when preferred', () => {
		const result = resolveSeedForPatch({
			patch: basePatchData,
			preferContract: true,
			hasActiveContract: true,
			contractPlant: herbPlant,
			preferences: new Map(),
			fallbackPlant: null
		});

		expect(result).toEqual({ type: 'plant', plant: herbPlant, reason: 'contract' });
	});

	it('resolveSeedForPatch ignores completed contracts and falls back to preferences', () => {
		const preferences = new Map<FarmingPatchName, FarmingSeedPreference>();
		preferences.set(herbPlant.seedType as FarmingPatchName, { type: 'highest_available' });

		const result = resolveSeedForPatch({
			patch: basePatchData,
			preferContract: true,
			hasActiveContract: false,
			contractPlant: herbPlant,
			preferences,
			fallbackPlant: null
		});

		expect(result).toEqual({ type: 'highest', reason: 'preference_highest' });
	});

	it('resolveSeedForPatch does not re-prioritize contract crop when that crop is already ready', () => {
		const preferences = new Map<FarmingPatchName, FarmingSeedPreference>();
		preferences.set(herbPlant.seedType as FarmingPatchName, { type: 'highest_available' });

		const readyContractCropPatch: IPatchDataDetailed = {
			...basePatchData,
			patchPlanted: true,
			lastPlanted: herbPlant.name,
			lastQuantity: 8,
			plant: herbPlant
		};

		const result = resolveSeedForPatch({
			patch: readyContractCropPatch,
			preferContract: true,
			hasActiveContract: true,
			contractPlant: herbPlant,
			preferences,
			fallbackPlant: null
		});

		expect(result).toEqual({ type: 'highest', reason: 'preference_highest' });
	});

	it('resolveSeedForPatch uses seed preference when available', () => {
		const preferences = new Map<FarmingPatchName, FarmingSeedPreference>();
		preferences.set(herbPlant.seedType as FarmingPatchName, { type: 'seed', seedID: herbSeedID });

		const result = resolveSeedForPatch({
			patch: basePatchData,
			preferContract: false,
			contractPlant: null,
			preferences,
			fallbackPlant: null
		});

		expect(result).toEqual({
			type: 'plant',
			plant: herbPlant,
			reason: 'preference_seed'
		});
	});

	it('resolveSeedForPatch returns highest option when preference is highest_available', () => {
		const preferences = new Map<FarmingPatchName, FarmingSeedPreference>();
		preferences.set(herbPlant.seedType as FarmingPatchName, { type: 'highest_available' });

		const result = resolveSeedForPatch({
			patch: basePatchData,
			preferContract: false,
			contractPlant: null,
			preferences,
			fallbackPlant: null
		});

		expect(result).toEqual({ type: 'highest', reason: 'preference_highest' });
	});

	it('resolveSeedForPatch falls back to provided plant when no preferences apply', () => {
		const treePatch: IPatchDataDetailed = {
			...basePatchData,
			patchName: treePlant.seedType as FarmingPatchName,
			friendlyName: 'Tree patch'
		};

		const result = resolveSeedForPatch({
			patch: treePatch,
			preferContract: false,
			contractPlant: null,
			preferences: new Map(),
			fallbackPlant: treePlant
		});

		expect(result).toEqual({ type: 'plant', plant: treePlant, reason: 'fallback' });
	});

	it('resolveSeedForPatch returns null when no rule applies or patch is not ready', () => {
		const notReadyPatch: IPatchDataDetailed = {
			...basePatchData,
			ready: false
		};

		const noPreferenceResult = resolveSeedForPatch({
			patch: { ...basePatchData, patchName: cactusPlant.seedType as FarmingPatchName },
			preferContract: false,
			contractPlant: null,
			preferences: new Map(),
			fallbackPlant: null
		});

		const notReadyResult = resolveSeedForPatch({
			patch: notReadyPatch,
			preferContract: true,
			contractPlant: herbPlant,
			preferences: new Map(),
			fallbackPlant: treePlant
		});

		expect(noPreferenceResult).toBeNull();
		expect(notReadyResult).toBeNull();
	});

	it('resolveSeedForPatch ignores invalid seed preferences', () => {
		const preferences = new Map<FarmingPatchName, FarmingSeedPreference>();
		preferences.set(herbPlant.seedType as FarmingPatchName, { type: 'seed', seedID: 999999 });

		const result = resolveSeedForPatch({
			patch: basePatchData,
			preferContract: false,
			contractPlant: null,
			preferences,
			fallbackPlant: null
		});

		expect(result).toBeNull();
	});

	it('resolveSeedForPatch keeps the last planted crop when no preference is saved', () => {
		const patch = {
			...basePatchData,
			lastPlanted: herbPlant.name,
			patchPlanted: true,
			plant: herbPlant
		};
		const result = resolveSeedForPatch({
			patch,
			preferContract: false,
			contractPlant: null,
			preferences: new Map(),
			fallbackPlant: treePlant
		});
		expect(result).toEqual({ type: 'plant', plant: herbPlant, reason: 'last_planted' });
	});

	it('resolveSeedForPatch respects empty preference type', () => {
		const preferences = new Map<FarmingPatchName, FarmingSeedPreference>();
		preferences.set(herbPlant.seedType as FarmingPatchName, { type: 'empty' });

		const result = resolveSeedForPatch({
			patch: basePatchData,
			preferContract: false,
			contractPlant: herbPlant,
			preferences,
			fallbackPlant: treePlant
		});

		expect(result).toBeNull();
	});
});

describe('farming preferred seed lists', () => {
	const toadflax = plants.find(plant => plant.name === 'Toadflax');
	const ranarr = plants.find(plant => plant.name === 'Ranarr');
	const snapdragon = plants.find(plant => plant.name === 'Snapdragon');
	if (!toadflax || !ranarr || !snapdragon) {
		throw new Error('Expected Toadflax, Ranarr, and Snapdragon plants to exist');
	}
	const toadflaxSeedID = getPrimarySeedForPlant(toadflax);
	const ranarrSeedID = getPrimarySeedForPlant(ranarr);
	const snapdragonSeedID = getPrimarySeedForPlant(snapdragon);
	if (!toadflaxSeedID || !ranarrSeedID || !snapdragonSeedID) {
		throw new Error('Expected herb plants to have seed items');
	}

	it('parsePreferredSeeds accepts a legacy seed and fallbackSeedIDs list', () => {
		const result = parsePreferredSeeds({
			herb: {
				type: 'seed',
				seedID: toadflaxSeedID,
				fallbackSeedIDs: [ranarrSeedID, snapdragonSeedID],
				quantity: 3
			}
		});

		expect(result.get('herb')).toEqual({
			type: 'seed',
			seedID: toadflaxSeedID,
			fallbackSeedIDs: [ranarrSeedID, snapdragonSeedID],
			quantity: 3
		});
	});

	it('serializePreferredSeeds keeps a single-seed preference in the legacy shape', () => {
		const parsed = parsePreferredSeeds({ herb: { type: 'seed', seedID: herbSeedID } });
		const serialized = serializePreferredSeeds(parsed);
		expect(serialized.herb).toEqual({ type: 'seed', seedID: herbSeedID });
		expect((serialized.herb as FarmingSeedPreference).fallbackSeedIDs).toBeUndefined();
	});

	it('parsePreferredSeeds promotes a valid fallback when the first seed ID is invalid', () => {
		const result = parsePreferredSeeds({
			herb: { type: 'seed', seedID: 999999, fallbackSeedIDs: [toadflaxSeedID] }
		});
		expect(result.get('herb')).toEqual({ type: 'seed', seedID: toadflaxSeedID });
	});

	it('resolveSeedForPatch returns an ordered plant list for multiple preferred seeds', () => {
		const preferences = new Map<FarmingPatchName, FarmingSeedPreference>();
		preferences.set('herb', { type: 'seed', seedID: toadflaxSeedID, fallbackSeedIDs: [ranarrSeedID] });

		const result = resolveSeedForPatch({
			patch: basePatchData,
			preferContract: false,
			contractPlant: null,
			preferences,
			fallbackPlant: herbPlant
		});

		expect(result).toEqual({
			type: 'plants',
			plants: [toadflax, ranarr],
			reason: 'preference_seed'
		});
	});

	it('parseSeedPreferenceInput accepts a comma-separated seed list in order', () => {
		const result = parseSeedPreferenceInput('herb', 'Toadflax seed, Ranarr seed, Snapdragon seed');
		expect(result).toEqual({
			type: 'seed',
			seedID: toadflaxSeedID,
			fallbackSeedIDs: [ranarrSeedID, snapdragonSeedID]
		});
	});

	it('parseSeedPreferenceInput rejects mixing special values with seeds', () => {
		expect(parseSeedPreferenceInput('herb', 'Toadflax seed, highest_available')).toBe(
			'highest_available and empty cannot be combined with a seed list.'
		);
	});

	it('parseSeedPreferenceInput rejects more than 5 seeds', () => {
		const herbPlants = getPlantsForPatch('herb')
			.map(plant => plant.inputItems.items()[0]?.[0].name)
			.filter((name): name is string => Boolean(name));
		const uniqueNames = [...new Set(herbPlants)].slice(0, 6);
		expect(uniqueNames.length).toBe(6);
		expect(parseSeedPreferenceInput('herb', uniqueNames.join(', '))).toBe(
			'You can set up to 5 preferred seeds for each patch type.'
		);
	});

	it('appendPreferredSeeds appends a fallback and rejects duplicates or overflow', () => {
		const first = { type: 'seed' as const, seedID: toadflaxSeedID, quantity: 2 };
		const added = appendPreferredSeeds(first, { type: 'seed', seedID: ranarrSeedID }, 'Herb');
		expect(added).toEqual({
			type: 'seed',
			seedID: toadflaxSeedID,
			fallbackSeedIDs: [ranarrSeedID],
			quantity: 2
		});
		expect(
			appendPreferredSeeds(added as FarmingSeedPreference, { type: 'seed', seedID: ranarrSeedID }, 'Herb')
		).toBe('Ranarr seed is already in your Herb preference list.');
		expect(appendPreferredSeeds(first, { type: 'highest_available' }, 'Herb')).toBe(
			'Use add with a seed name, not highest_available or empty.'
		);
		expect(appendPreferredSeeds({ type: 'empty' }, { type: 'seed', seedID: ranarrSeedID }, 'Herb')).toBe(
			'Clear the saved preference for Herb before adding fallback seeds.'
		);

		const fiveIDs = getPlantsForPatch('herb')
			.map(plant => getPrimarySeedForPlant(plant))
			.filter((id): id is number => id !== null)
			.filter((id, index, all) => all.indexOf(id) === index)
			.slice(0, 5);
		expect(fiveIDs.length).toBe(5);
		const full = preferenceFromSeedIDs(fiveIDs);
		expect(full).not.toBeNull();
		const overflowID = getPlantsForPatch('herb')
			.map(plant => getPrimarySeedForPlant(plant))
			.find(id => id && !fiveIDs.includes(id));
		expect(overflowID).toBeTruthy();
		expect(appendPreferredSeeds(full!, { type: 'seed', seedID: overflowID as number }, 'Herb')).toBe(
			'You can set up to 5 preferred seeds for each patch type.'
		);
	});

	it('formatSeedPreference lists seeds in priority order', () => {
		expect(
			formatSeedPreference({
				type: 'seed',
				seedID: toadflaxSeedID,
				fallbackSeedIDs: [ranarrSeedID, snapdragonSeedID],
				quantity: 4
			})
		).toBe('seed: Toadflax seed, then Ranarr seed, then Snapdragon seed, quantity: 4');
		expect(formatSeedPreference({ type: 'seed', seedID: toadflaxSeedID })).toBe('seed: Toadflax seed');
	});

	it('worst-case Auto-farm preferences embed stays at least 150 under the description limit', () => {
		const DISCORD_EMBED_DESCRIPTION_LIMIT = 4096;
		const herbPlants = getPlantsForPatch('herb');
		const seedIDs = herbPlants
			.map(plant => getPrimarySeedForPlant(plant))
			.filter((id): id is number => id !== null)
			.filter((id, index, all) => all.indexOf(id) === index)
			.slice(0, 5);
		const longPreference = preferenceFromSeedIDs(seedIDs, 100_000);
		if (!longPreference) {
			throw new Error('Expected a 5-seed preference');
		}
		const longLine = formatSeedPreference(longPreference);
		const patchLines = [
			'Filter: AllFarm.',
			'Contract priority: disabled.',
			'If you set more than one seed, Auto Farm uses the first you have enough of.',
			'Fruit Tree -> ' + longLine,
			'Herb -> ' + longLine,
			'Allotment -> ' + longLine,
			'Hops -> ' + longLine,
			'Cactus -> ' + longLine,
			'Bush -> ' + longLine,
			'Spirit -> ' + longLine,
			'Hardwood -> ' + longLine,
			'Seaweed -> ' + longLine,
			'Vine -> ' + longLine,
			'Calquat -> ' + longLine,
			'Redwood -> ' + longLine,
			'Crystal -> ' + longLine,
			'Celastrus -> ' + longLine,
			'Hespori -> ' + longLine,
			'Flower -> ' + longLine,
			'Mushroom -> ' + longLine,
			'Belladonna -> ' + longLine,
			'Tree -> ' + longLine
		];
		const description = buildPreferredSeedsEmbedDescription(patchLines);
		expect(description.length).toBeLessThanOrEqual(DISCORD_EMBED_DESCRIPTION_LIMIT - 150);
		expect(description.startsWith('Filter: AllFarm.')).toBe(true);
	});
});

describe('replant filter seed resolution', () => {
	const irit = plants.find(plant => plant.name === 'Irit');
	const marrentill = plants.find(plant => plant.name === 'Marrentill');
	if (!irit || !marrentill) {
		throw new Error('Expected Irit and Marrentill plants to exist');
	}
	const iritSeedID = getPrimarySeedForPlant(irit);
	if (!iritSeedID) {
		throw new Error('Expected Irit to have a seed item');
	}

	const plantedMarrentill: IPatchDataDetailed = {
		...basePatchData,
		lastPlanted: marrentill.name,
		patchPlanted: true,
		lastQuantity: 10,
		plant: marrentill,
		ready: true
	};

	it('uses the planted crop when the Replant filter is on, even if a preferred seed is saved', () => {
		const preferences = new Map<FarmingPatchName, FarmingSeedPreference>();
		preferences.set('herb', { type: 'seed', seedID: iritSeedID });

		const result = resolveSeedForPatch({
			patch: plantedMarrentill,
			preferContract: false,
			contractPlant: irit,
			preferences,
			fallbackPlant: irit,
			replantFilter: true
		});

		expect(result).toEqual({ type: 'plant', plant: marrentill, reason: 'last_planted' });
	});

	it('leaves empty patches empty when the Replant filter is on', () => {
		const preferences = new Map<FarmingPatchName, FarmingSeedPreference>();
		preferences.set('herb', { type: 'seed', seedID: iritSeedID });

		const emptyPatch: IPatchDataDetailed = {
			...basePatchData,
			ready: null,
			patchPlanted: false,
			lastPlanted: null,
			plant: null
		};

		const result = resolveSeedForPatch({
			patch: emptyPatch,
			preferContract: true,
			hasActiveContract: true,
			contractPlant: irit,
			preferences,
			fallbackPlant: irit,
			replantFilter: true
		});

		expect(result).toBeNull();
	});

	it('still uses preferred seeds when the Replant filter is off', () => {
		const preferences = new Map<FarmingPatchName, FarmingSeedPreference>();
		preferences.set('herb', { type: 'seed', seedID: iritSeedID });

		const result = resolveSeedForPatch({
			patch: plantedMarrentill,
			preferContract: false,
			contractPlant: null,
			preferences,
			fallbackPlant: herbPlant,
			replantFilter: false
		});

		expect(result).toEqual({ type: 'plant', plant: irit, reason: 'preference_seed' });
	});
});
