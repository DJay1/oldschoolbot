import { describe, expect, test } from 'vitest';

import { formatActivityTypeName, formatQueuedTripLabel } from '@/lib/bsc/tripQueueDisplay.js';

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
