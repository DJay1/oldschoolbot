import { afterEach, expect, test } from 'vitest';

import {
	clearSeasonalEventOverrides,
	isEventActive,
	setSeasonalEventOverride,
	shouldRegisterSeasonalItemDefinitions
} from '@/lib/events/registry.js';

afterEach(() => {
	clearSeasonalEventOverrides();
});

test('seasonal events are on hold by default', () => {
	expect(isEventActive('summer')).toBe(false);
	expect(isEventActive('christmas')).toBe(false);
	expect(isEventActive('halloween')).toBe(false);
	expect(isEventActive('easter')).toBe(false);
	expect(isEventActive('birthday')).toBe(false);
});

test('an enabled event is active only inside its window', () => {
	const start = Date.parse('2026-06-01T00:00:00Z');
	const end = Date.parse('2026-06-08T00:00:00Z');
	setSeasonalEventOverride('summer', { enabled: true, start, end });
	expect(isEventActive('summer', start - 1)).toBe(false);
	expect(isEventActive('summer', start)).toBe(true);
	expect(isEventActive('summer', end - 1)).toBe(true);
	expect(isEventActive('summer', end)).toBe(false);
	expect(isEventActive('christmas', start)).toBe(false);

	setSeasonalEventOverride('summer', { enabled: false, start, end });
	expect(isEventActive('summer', start + 1000)).toBe(false);
});

test('enabling an event without dates leaves it active', () => {
	setSeasonalEventOverride('halloween', { enabled: true, start: null, end: null });
	expect(isEventActive('halloween')).toBe(true);
});

test('item definitions stay a separate switch from event activity', () => {
	const previous = process.env.LOS_PERROS_REGISTER_EVENT_ITEMS;
	process.env.LOS_PERROS_REGISTER_EVENT_ITEMS = '0';
	try {
		expect(shouldRegisterSeasonalItemDefinitions()).toBe(false);
		expect(isEventActive('summer')).toBe(false);
	} finally {
		if (previous === undefined) delete process.env.LOS_PERROS_REGISTER_EVENT_ITEMS;
		else process.env.LOS_PERROS_REGISTER_EVENT_ITEMS = previous;
	}
	expect(shouldRegisterSeasonalItemDefinitions()).toBe(true);
});
