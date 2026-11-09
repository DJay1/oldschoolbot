import { discontinuedDyes } from '@/lib/bso/dyedItems.js';
import { keyCrates } from '@/lib/bso/keyCrates.js';

import { Items } from 'oldschooljs';

import { isCustomItem } from '@/lib/customItems/util.js';
import { allCollectionLogs } from '@/lib/data/Collections.js';
import { launchBoxCL } from '@/lib/events/launch/collectionLog.js';
import { LaunchItem } from '@/lib/events/launch/items.js';
import { isEventActive } from '@/lib/events/registry.js';
import { allOpenables } from '@/lib/openables.js';

export const releasedDiscontinuedItemIDs = new Set<number>();

const limitedItemIDs = [LaunchItem.CORGO_PARTY_HAT];

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
	for (const [name, activity] of Object.entries(allCollectionLogs.Discontinued.activities)) {
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
