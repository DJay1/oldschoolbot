import { Items } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { allCLItemsFiltered, allCollectionLogs, getCollectionItems, overallPlusItems } from '@/lib/data/Collections.js';
import { filterableTypes } from '@/lib/data/filterables.js';
import {
	DISCONTINUED_CL_CATEGORY,
	DiscontinuedCLName,
	getDiscontinuedCLGroups,
	getDiscontinuedItemIDs,
	registerDiscontinuedCollectionLogs
} from '@/lib/discontinuedItems.js';

describe('discontinued collection logs and bank filter', () => {
	registerDiscontinuedCollectionLogs();
	const all = getDiscontinuedItemIDs();
	const groups = getDiscontinuedCLGroups();

	test('Launch box and Corgo party hat are discontinued', () => {
		expect(all.has(Items.getOrThrow('Launch box').id)).toBe(true);
		expect(all.has(Items.getOrThrow('Corgo party hat').id)).toBe(true);
		expect(groups[DiscontinuedCLName.Boxes]).toContain(Items.getOrThrow('Launch box').id);
		expect(groups[DiscontinuedCLName.Partyhats]).toContain(Items.getOrThrow('Corgo party hat').id);
	});

	test('every discontinued item is in exactly one discontinued log', () => {
		const seen = new Map<number, string>();
		for (const [name, items] of Object.entries(groups)) {
			for (const id of items) {
				expect(seen.get(id), `${Items.getOrThrow(id).name} in ${name} and ${seen.get(id)}`).toBeUndefined();
				seen.set(id, name);
			}
		}
		for (const id of all) expect(seen.has(id), Items.getOrThrow(id).name).toBe(true);
		expect(seen.size).toBe(all.size);
	});

	test('bank filter lists every discontinued item', () => {
		const filter = filterableTypes.find(f => f.aliases.includes('discontinued'));
		expect(filter?.name).toBe('Discontinued');
		expect(new Set(filter!.items())).toEqual(all);
	});

	test('the Discontinued category is registered once, counts:false and outside overall', () => {
		registerDiscontinuedCollectionLogs();
		const category = allCollectionLogs[DISCONTINUED_CL_CATEGORY];
		expect(Object.keys(category.activities).sort()).toEqual(
			Object.values(DiscontinuedCLName)
				.filter(n => groups[n].length > 0)
				.sort()
		);
		for (const activity of Object.values(category.activities)) expect(activity.counts).toBe(false);
		const launchBox = Items.getOrThrow('Launch box').id;
		expect(getCollectionItems('Discontinued Boxes & Crates').has(launchBox)).toBe(true);
		expect(getCollectionItems('Discontinued Partyhats').has(Items.getOrThrow('Corgo party hat').id)).toBe(true);
		// Rebuilding overall+ and overall the same way Collections.ts does must give the same sets as before
		// registering, so Top Collector, CL % and CL leaderboards are untouched.
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
