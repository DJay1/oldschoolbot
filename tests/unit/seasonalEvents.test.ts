import { Items } from 'oldschooljs';
import { afterEach, expect, test } from 'vitest';

import Createables from '@/lib/data/createables.js';
import { easterUseTrollResponse } from '@/lib/events/easter/use.js';
import {
	clearSeasonalEventOverrides,
	isEventActive,
	setSeasonalEventOverride,
	shouldRegisterSeasonalItemDefinitions
} from '@/lib/events/registry.js';
import Cooking from '@/lib/skilling/skills/cooking/cooking.js';
import { genericUsables } from '@/mahoji/lib/abstracted_commands/useCommand.js';

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

function creatableUses(name: string, ingredient: string) {
	const recipe = Createables.find(item => item.name === name);
	expect(recipe, name).toBeTruthy();
	expect(typeof recipe!.inputItems).not.toBe('function');
	const inputs = recipe!.inputItems as Record<string, number>;
	expect(inputs[Items.getOrThrow(ingredient).id]).toBeGreaterThan(0);
}

function hasUseCombo(names: string[]) {
	const expected = names.map(name => Items.getOrThrow(name).id).sort((a, b) => a - b);
	return genericUsables.some(usable => {
		const ids = usable.items.map(item => item.id).sort((a, b) => a - b);
		return ids.length === expected.length && ids.every((id, index) => id === expected[index]);
	});
}

test('owned holiday items stay creatable and usable while every event is off', () => {
	expect(isEventActive('summer')).toBe(false);
	expect(isEventActive('christmas')).toBe(false);
	expect(isEventActive('halloween')).toBe(false);
	expect(isEventActive('easter')).toBe(false);
	expect(isEventActive('birthday')).toBe(false);

	creatableUses('Ho-ho hammer', 'Christmas dye');
	creatableUses('Dwarven pumpkinsmasher', 'Spooky dye');
	creatableUses('Gothic Dwarven warhammer', 'Sun Scream');
	creatableUses('Santa claws', 'Christmas dye');
	creatableUses('The Grim Reaper', 'Spooky dye');
	creatableUses('Vasa cloak (saradomin)', 'Saradomin egg');
	expect(Createables.some(item => item.name === 'Frosty')).toBe(true);
	expect(Createables.some(item => item.name === 'Golden partyhat')).toBe(true);
	expect(Createables.some(item => item.name === 'Halloween mask set')).toBe(true);

	expect(Cooking.Cookables.some(cookable => cookable.name === 'Christmas cake')).toBe(true);
	expect(Cooking.Cookables.some(cookable => cookable.name === 'Turkey')).toBe(true);

	expect(hasUseCombo(['Sun Scream', 'Patricia'])).toBe(true);
	expect(hasUseCombo(['Pumpkin carving knife', 'Heirloom pumpkin'])).toBe(true);
	expect(hasUseCombo(['Knife', 'Turkey'])).toBe(true);
	expect(hasUseCombo(['Ginger root', 'Dodgy bread'])).toBe(true);
	expect(hasUseCombo(['Christmas cake recipe', 'Doug'])).toBe(true);
	expect(easterUseTrollResponse([Items.getOrThrow('Magnegg').id])).toEqual(expect.any(String));
	expect(easterUseTrollResponse([Items.getOrThrow('Wabbit eggs').id])).toEqual(expect.any(String));
});
