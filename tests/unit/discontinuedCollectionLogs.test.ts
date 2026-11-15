import { Items } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { allCLItemsFiltered, allCollectionLogs, getCollectionItems, overallPlusItems } from '@/lib/data/Collections.js';
import { filterableTypes } from '@/lib/data/filterables.js';
import {
	DISCONTINUED_CL_CATEGORY,
	DiscontinuedCLName,
	getBscDiscontinuedItemIDs,
	getDiscontinuedCLGroups,
	getDiscontinuedItemIDs,
	registerDiscontinuedCollectionLogs
} from '@/lib/discontinuedItems.js';

const id = (name: string) => Items.getOrThrow(name).id;
const launchEnded = () => false;

describe('BSC discontinued collection logs and bank filter', () => {
	const all = getBscDiscontinuedItemIDs(launchEnded);
	const groups = getDiscontinuedCLGroups(all);

	test('only BSC items: Launch box and Corgo party hat once the Launch event is over', () => {
		expect([...all].sort()).toEqual([id('Launch box'), id('Corgo party hat')].sort());
		expect(groups[DiscontinuedCLName.Boxes]).toEqual([id('Launch box')]);
		expect(groups[DiscontinuedCLName.Partyhats]).toEqual([id('Corgo party hat')]);
	});

	test('returning and inherited items are left out', () => {
		for (const name of [
			'Kuro',
			'Flappy',
			'Gregoyle',
			'Spooky graceful hood',
			'Double loot token',
			'Chickaxe',
			'Golden partyhat',
			'Halloween cracker'
		]) {
			expect(all.has(id(name)), name).toBe(false);
		}
		// Inherited items are still tracked internally (staff Unreleased log, /dclookup), just not shown here.
		expect(getDiscontinuedItemIDs().has(id('Chickaxe'))).toBe(true);
	});

	test('nothing is discontinued while the Launch event is running', () => {
		expect(getBscDiscontinuedItemIDs(() => true).size).toBe(0);
	});

	test('every discontinued item is in exactly one discontinued log', () => {
		const seen = new Map<number, string>();
		for (const [name, items] of Object.entries(groups)) {
			for (const itemID of items) {
				expect(seen.get(itemID), `${Items.getOrThrow(itemID).name} in ${name}`).toBeUndefined();
				seen.set(itemID, name);
			}
		}
		expect(new Set(seen.keys())).toEqual(all);
	});

	test('bank filter equals the BSC list', () => {
		const filter = filterableTypes.find(f => f.aliases.includes('discontinued'));
		expect(filter?.name).toBe('Discontinued');
		expect(new Set(filter!.items())).toEqual(getBscDiscontinuedItemIDs());
		expect(filterableTypes.some(f => f.name === 'Custom Pets (Discontinued)')).toBe(false);
	});

	test('the Discontinued category only shows logs with items, counts:false, outside overall', () => {
		registerDiscontinuedCollectionLogs();
		registerDiscontinuedCollectionLogs();
		const category = allCollectionLogs[DISCONTINUED_CL_CATEGORY];
		const live = getDiscontinuedCLGroups();
		expect(Object.keys(category.activities).sort()).toEqual(
			Object.values(DiscontinuedCLName)
				.filter(n => live[n].length > 0)
				.sort()
		);
		for (const activity of Object.values(category.activities)) {
			expect(activity.counts).toBe(false);
			expect(activity.items.length).toBeGreaterThan(0);
		}
		if (category.activities[DiscontinuedCLName.Boxes]) {
			expect(getCollectionItems('Discontinued Boxes & Crates').has(id('Launch box'))).toBe(true);
		}
		const rebuiltOverallPlus = new Set(
			Object.entries(allCollectionLogs)
				.filter(([name]) => name !== 'Discontinued')
				.flatMap(([, c]) => Object.values(c.activities).flatMap(a => a.items))
		);
		expect(rebuiltOverallPlus).toEqual(overallPlusItems);
		const rebuiltOverall = new Set(
			Object.values(allCollectionLogs).flatMap(c =>
				Object.values(c.activities)
					.filter(a => a.counts === undefined)
					.flatMap(a => a.items)
			)
		);
		expect(rebuiltOverall).toEqual(allCLItemsFiltered);
	});
});
