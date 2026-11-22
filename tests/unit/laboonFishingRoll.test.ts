import { Time } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';
import { afterEach, describe, expect, test } from 'vitest';

import { clearSeasonalEventOverrides, setSeasonalEventOverride } from '@/lib/events/registry.js';
import {
	isLaboonFishingActivity,
	LABOON_FISHING_ACTIVITY_TYPES,
	LABOON_FISHING_MESSAGE,
	LABOON_FISHING_MIN_TRIP_MS,
	LABOON_FISHING_RATE_PER_MINUTE,
	rollLaboonFromFishingTrip
} from '@/lib/events/thanksgiving/core.js';
import { ThanksgivingItem } from '@/lib/events/thanksgiving/items.js';

const neverRng = { randInt: (_min: number, max: number) => max };
const alwaysRng = { randInt: (min: number) => min };

const START = Date.parse('2026-11-22T16:46:19.332Z');
const END = Date.parse('2026-12-07T16:46:19.332Z');
const during = START + 60_000;

afterEach(() => {
	clearSeasonalEventOverrides();
});

function activateThanksgiving() {
	setSeasonalEventOverride('thanksgiving', { enabled: true, start: START, end: END });
}

describe('Laboon fishing roll', () => {
	test('does not roll when the event is off', () => {
		const loot = new Bank();
		const msg = rollLaboonFromFishingTrip(alwaysRng, 30 * Time.Minute, loot, during);
		expect(msg).toBeNull();
		expect(loot.amount(ThanksgivingItem.LABOON)).toBe(0);
	});

	test('does not roll trips shorter than 5 minutes', () => {
		activateThanksgiving();
		const loot = new Bank();
		const msg = rollLaboonFromFishingTrip(alwaysRng, LABOON_FISHING_MIN_TRIP_MS - 1, loot, during);
		expect(msg).toBeNull();
		expect(loot.amount(ThanksgivingItem.LABOON)).toBe(0);
	});

	test('a 5-minute trip is eligible and unlucky rolls give nothing', () => {
		activateThanksgiving();
		const hit = new Bank();
		expect(rollLaboonFromFishingTrip(alwaysRng, LABOON_FISHING_MIN_TRIP_MS, hit, during)).toBe(
			LABOON_FISHING_MESSAGE
		);
		expect(hit.amount(ThanksgivingItem.LABOON)).toBe(1);

		const miss = new Bank();
		expect(rollLaboonFromFishingTrip(neverRng, 60 * Time.Minute, miss, during)).toBeNull();
		expect(miss.amount(ThanksgivingItem.LABOON)).toBe(0);
	});

	test('rolls once per full minute and stops after the first Laboon', () => {
		activateThanksgiving();
		const loot = new Bank();
		const msg = rollLaboonFromFishingTrip(alwaysRng, 10 * Time.Minute, loot, during);
		expect(msg).toBe(LABOON_FISHING_MESSAGE);
		expect(loot.amount(ThanksgivingItem.LABOON)).toBe(1);

		let rolls = 0;
		const countingRng = {
			randInt: (_min: number, max: number) => {
				rolls++;
				return max;
			}
		};
		rollLaboonFromFishingTrip(countingRng, 5 * Time.Minute + Time.Minute - 1, new Bank(), during);
		expect(rolls).toBe(5);
	});

	test('uses 1 in 3000 per minute with a 5-minute minimum', () => {
		expect(LABOON_FISHING_RATE_PER_MINUTE).toBe(3000);
		expect(LABOON_FISHING_MIN_TRIP_MS).toBe(5 * Time.Minute);
	});

	test('trip-finish message stays under the Discord length limit', () => {
		expect(LABOON_FISHING_MESSAGE.length).toBeGreaterThan(20);
		expect(LABOON_FISHING_MESSAGE.length).toBeLessThanOrEqual(2000 - 150);
	});

	test('covers regular fishing and the fishing minigames, not other trips', () => {
		expect(LABOON_FISHING_ACTIVITY_TYPES).toEqual([
			'Fishing',
			'Tempoross',
			'FishingTrawler',
			'DriftNet',
			'AerialFishing',
			'CamdozaalFishing',
			'FishingContest'
		]);
		for (const type of LABOON_FISHING_ACTIVITY_TYPES) {
			expect(isLaboonFishingActivity(type)).toBe(true);
		}
		expect(isLaboonFishingActivity('Mining')).toBe(false);
	});
});
