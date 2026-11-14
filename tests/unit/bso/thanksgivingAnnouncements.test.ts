import { Bank } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { rareAnnounceKindForItem } from '@/lib/bsc/rareAnnouncements.js';
import { thanksgivingPetAnnouncement } from '@/lib/events/thanksgiving/core.js';
import { ThanksgivingItem } from '@/lib/events/thanksgiving/items.js';

describe('Straw Hat Harvest announcements', () => {
	test('event items no longer use the first-in-collection-log announcement (every pet is announced instead)', () => {
		for (const id of Object.values(ThanksgivingItem)) {
			expect(rareAnnounceKindForItem(id)).toBeNull();
		}
	});

	test('every pet is announced with which one it is for the player', () => {
		const second = thanksgivingPetAnnouncement({
			name: 'Bob',
			gained: new Bank().add(ThanksgivingItem.GOBBLES),
			clAfter: new Bank().add(ThanksgivingItem.GOBBLES, 2),
			source: 'from a Straw Hat Harvest offer'
		});
		expect(second).toBe('🦃 Bob just got **Gobbles** (their 2nd) from a Straw Hat Harvest offer!');

		const several = thanksgivingPetAnnouncement({
			name: 'Bob',
			gained: new Bank().add(ThanksgivingItem.GOBBLES).add(ThanksgivingItem.LABOON, 2),
			clAfter: new Bank().add(ThanksgivingItem.GOBBLES).add(ThanksgivingItem.LABOON, 3),
			source: 'from a Straw Hat Harvest offer'
		});
		expect(several).toBe(
			'🦃 Bob just got **Gobbles** (their 1st) and **2x Laboon** (3 total) from a Straw Hat Harvest offer!'
		);

		const made = thanksgivingPetAnnouncement({
			name: 'Bob',
			gained: new Bank().add(ThanksgivingItem.LABOON_STRAW_HAT),
			clAfter: new Bank().add(ThanksgivingItem.LABOON_STRAW_HAT),
			source: 'by giving their pet a hat'
		});
		expect(made).toBe('🦃 Bob just got **Captain Laboon** (their 1st) by giving their pet a hat!');
	});

	test('no message without an event pet', () => {
		expect(
			thanksgivingPetAnnouncement({
				name: 'Bob',
				gained: new Bank().add(ThanksgivingItem.PILGRIM_HAT).add('Coal', 5),
				clAfter: new Bank(),
				source: 'on a trip'
			})
		).toBeNull();
	});
});
