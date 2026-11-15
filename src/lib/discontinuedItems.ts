import { discontinuedDyes } from '@/lib/bso/dyedItems.js';
import { keyCrates } from '@/lib/bso/keyCrates.js';

import { Items, resolveItems } from 'oldschooljs';

import { isCustomItem } from '@/lib/customItems/util.js';
import { allClNames, allCollectionLogs, discontinuedCollections } from '@/lib/data/Collections.js';
import { allPetIDs } from '@/lib/data/CollectionsExport.js';
import { filterableTypes } from '@/lib/data/filterables.js';
import { launchBoxCL } from '@/lib/events/launch/collectionLog.js';
import { LaunchItem } from '@/lib/events/launch/items.js';
import { isEventActive } from '@/lib/events/registry.js';
import { allOpenables } from '@/lib/openables.js';

export const releasedDiscontinuedItemIDs = new Set<number>();

/** BSC limited items that are discontinued but not in any old event log. */
const limitedItemIDs = [LaunchItem.LAUNCH_BOX, LaunchItem.CORGO_PARTY_HAT];

export function getDiscontinuedItemStatus(itemID: number, now = Date.now()): string {
	if (launchBoxCL.includes(itemID) && isEventActive('launch', now)) return 'Released (Launch box)';
	if (releasedDiscontinuedItemIDs.has(itemID)) return 'Released';
	return 'Unreleased';
}

const discontinuedItemPerks: Record<string, string[]> = {
	Kuro: ['2x faster Gnome Restaurant deliveries', '5% faster Ourania Delivery Service waves'],
	Gregoyle: ['20% faster kills on Gargoyles and the Grotesque Guardians'],
	Smokey: ['10% chance of a bonus roll on each supported item you open (just needs to be owned)'],
	Flappy: [
		'2x loot and rewards from raids and most minigames, e.g. Wintertodt, Tithe Farm, Guardians of the Rift, Pest Control, Soul Wars, Barbarian Assault and Castle Wars'
	],
	Cob: ['2x faster Hallowed Sepulchre laps', '2x faster solo Nightmare kills'],
	Partycrab: [
		'1.6x longer fishing trips',
		'Finds bottles while fishing more often',
		'+30 minutes on beach combing trips during the Summer event'
	],
	Patricia: [
		'1.75x longer fishing trips',
		'Finds bottles and crab cages while fishing more often',
		'2x longer beach combing trips during the Summer event'
	]
};

let perksByItemID: Map<number, string[]> | null = null;

export function getDiscontinuedItemPerks(itemID: number): string[] {
	if (!perksByItemID) {
		perksByItemID = new Map(
			Object.entries(discontinuedItemPerks).map(([name, perks]) => [Items.getOrThrow(name).id, perks])
		);
	}
	return perksByItemID.get(itemID) ?? [];
}

let discontinuedItemIDs: Set<number> | null = null;

function itemsObtainableOutsideCrates(): Set<number> {
	const crateIDs = new Set(keyCrates.map(crate => crate.item.id));
	const obtainable = new Set<number>();
	for (const [category, collection] of Object.entries(allCollectionLogs)) {
		if (category === 'Discontinued') continue;
		for (const activity of Object.values(collection.activities)) {
			for (const itemID of [...activity.items, ...(activity.allItems ?? [])]) obtainable.add(itemID);
		}
	}
	for (const openable of allOpenables) {
		if (crateIDs.has(openable.openedItem.id) || openable.isMysteryBox) continue;
		for (const itemID of openable.allItems) obtainable.add(itemID);
	}
	return obtainable;
}

export function getDiscontinuedItemIDs(): Set<number> {
	if (discontinuedItemIDs) return discontinuedItemIDs;

	const crateNames = new Set(keyCrates.map(crate => crate.item.name));
	const eventItems = new Set<number>();
	const crateItems = new Set<number>();
	for (const [name, activity] of Object.entries(discontinuedCollections)) {
		for (const itemID of activity.items) {
			if (!isCustomItem(itemID)) continue;
			(crateNames.has(name) ? crateItems : eventItems).add(itemID);
		}
	}

	const obtainableOutsideCrates = itemsObtainableOutsideCrates();
	discontinuedItemIDs = new Set([...eventItems, ...limitedItemIDs]);
	for (const itemID of crateItems) {
		if (discontinuedDyes.includes(itemID) || !obtainableOutsideCrates.has(itemID)) {
			discontinuedItemIDs.add(itemID);
		}
	}
	return discontinuedItemIDs;
}

export function isDiscontinuedItem(itemID: number): boolean {
	return getDiscontinuedItemIDs().has(itemID);
}

export function getUnreleasedItemIDs(): number[] {
	return [...getDiscontinuedItemIDs()].filter(itemID => getDiscontinuedItemStatus(itemID) === 'Unreleased');
}

export const DISCONTINUED_CL_CATEGORY = 'Discontinued';

export const DiscontinuedCLName = {
	Pets: 'Discontinued Pets',
	Partyhats: 'Discontinued Partyhats',
	Gear: 'Discontinued Gear',
	Boxes: 'Discontinued Boxes & Crates',
	Other: 'Discontinued Other'
} as const;
export type DiscontinuedCLNameType = (typeof DiscontinuedCLName)[keyof typeof DiscontinuedCLName];

const discontinuedCLAliases: Record<DiscontinuedCLNameType, string[]> = {
	[DiscontinuedCLName.Pets]: ['discontinued pets', 'dc pets log', 'disc pets'],
	[DiscontinuedCLName.Partyhats]: ['discontinued partyhats', 'discontinued party hats', 'disc partyhats', 'dc phats'],
	[DiscontinuedCLName.Gear]: ['discontinued gear', 'disc gear', 'dc gear'],
	[DiscontinuedCLName.Boxes]: [
		'discontinued boxes',
		'discontinued crates',
		'discontinued boxes and crates',
		'disc boxes',
		'dc boxes'
	],
	[DiscontinuedCLName.Other]: ['discontinued other', 'disc other', 'dc other']
};

let discontinuedCLGroups: Record<DiscontinuedCLNameType, number[]> | null = null;

/**
 * Splits every discontinued item into exactly one log, checked in this order:
 * pets, partyhats, boxes & crates (openables, crate keys), gear (equippable), other.
 */
export function getDiscontinuedCLGroups(): Record<DiscontinuedCLNameType, number[]> {
	if (discontinuedCLGroups) return discontinuedCLGroups;

	const petIDs = new Set<number>([
		...(allPetIDs.flat(Number.POSITIVE_INFINITY) as number[]),
		...resolveItems(['Black swan', 'Radiant magnabbit'])
	]);
	const boxIDs = new Set<number>([
		...allOpenables.map(openable => openable.openedItem.id),
		...keyCrates.flatMap(crate => [crate.item.id, crate.key.id])
	]);

	const groups: Record<DiscontinuedCLNameType, number[]> = {
		[DiscontinuedCLName.Pets]: [],
		[DiscontinuedCLName.Partyhats]: [],
		[DiscontinuedCLName.Gear]: [],
		[DiscontinuedCLName.Boxes]: [],
		[DiscontinuedCLName.Other]: []
	};

	const sorted = [...getDiscontinuedItemIDs()].sort((a, b) =>
		Items.getOrThrow(a).name.localeCompare(Items.getOrThrow(b).name)
	);
	for (const itemID of sorted) {
		const item = Items.getOrThrow(itemID);
		if (petIDs.has(itemID)) groups[DiscontinuedCLName.Pets].push(itemID);
		else if (/party ?hat/i.test(item.name)) groups[DiscontinuedCLName.Partyhats].push(itemID);
		else if (boxIDs.has(itemID)) groups[DiscontinuedCLName.Boxes].push(itemID);
		else if (item.equipable || item.equipment) groups[DiscontinuedCLName.Gear].push(itemID);
		else groups[DiscontinuedCLName.Other].push(itemID);
	}

	discontinuedCLGroups = groups;
	return groups;
}

/**
 * Adds the public "Discontinued" CL category. It is registered after Collections.ts loads because the
 * discontinued list needs every other log and openable first. The category name must stay exactly
 * "Discontinued": overall+ (Top Collector role) and the obtainable check above both skip it by that name.
 * Every page is counts:false, so it never affects overall CL %, CL leaderboards counts or new-CL messages.
 */
export function registerDiscontinuedCollectionLogs() {
	if (allCollectionLogs[DISCONTINUED_CL_CATEGORY]) return;
	const groups = getDiscontinuedCLGroups();
	const activities: (typeof allCollectionLogs)[string]['activities'] = {};
	for (const [name, items] of Object.entries(groups) as [DiscontinuedCLNameType, number[]][]) {
		if (items.length === 0) continue;
		activities[name] = { alias: discontinuedCLAliases[name], items, counts: false };
	}
	allCollectionLogs[DISCONTINUED_CL_CATEGORY] = { activities };
	allClNames.push(DISCONTINUED_CL_CATEGORY, ...Object.keys(activities));
}
// /bank filter:discontinued. Added here (not in filterables.ts) so filterables.ts doesn't import this module.
if (!filterableTypes.some(f => f.name === 'Discontinued')) {
	filterableTypes.unshift({
		name: 'Discontinued',
		aliases: ['discontinued', 'disc', 'discontinued items', 'dc items'],
		items: () => [...getDiscontinuedItemIDs()]
	});
}
