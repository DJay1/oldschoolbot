import { describe, expect, test } from 'vitest';

import { rareAnnounceKindForItem } from '@/lib/bsc/rareAnnouncements.js';
import { ThanksgivingItem } from '@/lib/events/thanksgiving/items.js';

describe('Straw Hat Harvest announcements', () => {
	test('the four event pets announce as event rares (tests run as the test bot)', () => {
		for (const id of [
			ThanksgivingItem.GOBBLES,
			ThanksgivingItem.GOBBLE_GOBBLE,
			ThanksgivingItem.LABOON,
			ThanksgivingItem.LABOON_STRAW_HAT
		]) {
			expect(rareAnnounceKindForItem(id)).toBe('event_rare');
		}
	});

	test('hats, parts, turkeys and the Cornucopia do not use the first-CL announcement', () => {
		for (const id of [
			ThanksgivingItem.PILGRIM_HAT,
			ThanksgivingItem.STRAW_HAT,
			ThanksgivingItem.HARVEST_BUNDLE,
			ThanksgivingItem.HARVEST_TURKEY,
			ThanksgivingItem.CORNUCOPIA_2021
		]) {
			expect(rareAnnounceKindForItem(id)).toBeNull();
		}
	});
});
