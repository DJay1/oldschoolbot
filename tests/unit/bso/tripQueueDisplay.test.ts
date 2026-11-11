import { describe, expect, test } from 'vitest';

import {
	formatActivityTypeName,
	formatQueuedTripLabel,
	formatQueuedTripsForCooldownList
} from '@/lib/bsc/tripQueueDisplay.js';

describe('queued trip labels', () => {
	test('formats camel-case activity types', () => {
		expect(formatActivityTypeName('MonsterKilling')).toBe('Monster Killing');
		expect(formatActivityTypeName('Offering')).toBe('Offering');
	});

	test('uses the monster name for monster-killing trips', () => {
		expect(formatQueuedTripLabel('MonsterKilling', { q: 18, mi: 2215 })).toBe('General Graardor');
		expect(formatQueuedTripLabel('MonsterKilling', '{"q":18,"mi":2215}')).toBe('General Graardor');
		expect(formatQueuedTripLabel('GroupMonsterKilling', { mi: 2215 })).toBe('General Graardor');
	});

	test('falls back to the activity type when the monster is unknown', () => {
		expect(formatQueuedTripLabel('MonsterKilling', { q: 1 })).toBe('Monster Killing');
		expect(formatQueuedTripLabel('Offering', { boneID: 532 })).toBe('Offering');
	});
});

describe('queued trips on the cd list', () => {
	test('omits the section when the queue is empty', () => {
		expect(
			formatQueuedTripsForCooldownList({ trips: [], startsAtFormatted: '4:23 PM (in 12 minutes)' })
		).toBeNull();
		expect(
			formatQueuedTripsForCooldownList({
				trips: [{ label: 'General Graardor', remaining: 0 }],
				startsAtFormatted: null
			})
		).toBeNull();
	});

	test('lists remaining trips and when the next one starts', () => {
		expect(
			formatQueuedTripsForCooldownList({
				trips: [{ label: 'General Graardor', remaining: 3 }],
				startsAtFormatted: '4:23 PM (in 12 minutes)'
			})
		).toBe('Queue: 3 General Graardor trips, starts 4:23 PM (in 12 minutes)');
	});

	test('uses singular trip and Ready when the next trip can start now', () => {
		expect(
			formatQueuedTripsForCooldownList({
				trips: [{ label: 'Offering', remaining: 1 }],
				startsAtFormatted: null
			})
		).toBe('Queue: 1 Offering trip, Ready');
	});

	test('joins more than one queued trip type', () => {
		expect(
			formatQueuedTripsForCooldownList({
				trips: [
					{ label: 'General Graardor', remaining: 3 },
					{ label: 'Offering', remaining: 2 }
				],
				startsAtFormatted: '4:23 PM (in 12 minutes)'
			})
		).toBe('Queue: 3 General Graardor trips, 2 Offering trips, starts 4:23 PM (in 12 minutes)');
	});
});
