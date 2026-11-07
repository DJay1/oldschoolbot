import { BSOItem } from '@/lib/bso/BSOItem.js';
import { isGEUntradeable } from '@/lib/bso/bsoUtil.js';
import { findDisassemblyGroup } from '@/lib/bso/skills/invention/disassemble.js';

import { Items, itemID } from 'oldschooljs';
import { afterEach, expect, test } from 'vitest';

import { IconPackID, ItemIconPacks } from '@/lib/canvas/iconPacks.js';
import { allCLItems } from '@/lib/data/Collections.js';
import Createables from '@/lib/data/createables.js';
import { getSimilarItems } from '@/lib/data/similarItems.js';
import { easterUseTrollResponse } from '@/lib/events/easter/use.js';
import {
	clearSeasonalEventOverrides,
	isEventActive,
	setSeasonalEventOverride,
	shouldRegisterSeasonalItemDefinitions
} from '@/lib/events/registry.js';
import { summerFishingStartAdjustments } from '@/lib/events/summer/fishing.js';
import { growablePets } from '@/lib/growablePets.js';
import backgroundImages from '@/lib/minions/data/bankBackgrounds.js';
import Cooking from '@/lib/skilling/skills/cooking/cooking.js';
import type { GearBank } from '@/lib/structures/GearBank.js';
import { sacrificePriceOfItem } from '@/mahoji/commands/sacrifice.js';
import { sellPriceOfItem } from '@/mahoji/commands/sell.js';
import { pohWallkits } from '@/mahoji/lib/abstracted_commands/pohCommand.js';
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
	expect(isEventActive('launch')).toBe(false);
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
	expect(isEventActive('launch')).toBe(false);

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

test('owned holiday items keep their benefits while every event is off', () => {
	expect(isEventActive('summer')).toBe(false);
	expect(isEventActive('christmas')).toBe(false);
	expect(isEventActive('halloween')).toBe(false);
	expect(isEventActive('easter')).toBe(false);
	expect(isEventActive('birthday')).toBe(false);
	expect(isEventActive('launch')).toBe(false);

	const patricia = {
		hasEquipped: () => false,
		usingPet: (name: string, options?: { returnID?: boolean }) => {
			if (name !== 'Patricia') return false;
			return options?.returnID ? Items.getOrThrow('Patricia').id : true;
		}
	} as unknown as GearBank;
	const withCage = {
		hasEquipped: (id: number) => id === BSOItem.OLD_CRAB_CAGE,
		usingPet: (name: string, options?: { returnID?: boolean }) => {
			if (name !== 'Patricia') return false;
			return options?.returnID ? Items.getOrThrow('Lydia').id : true;
		}
	} as unknown as GearBank;

	const patriciaBoost = summerFishingStartAdjustments(patricia, 'Shark');
	expect(patriciaBoost.speedMultiplier).toBeCloseTo(2.15);
	expect(patriciaBoost.boosts.some(line => line.includes('expert fishing pair'))).toBe(true);

	const lobsterBoost = summerFishingStartAdjustments(withCage, 'Lobster');
	expect(lobsterBoost.speedMultiplier).toBe(3);
	expect(lobsterBoost.extraMaxTripLength).toBeGreaterThan(0);
	expect(lobsterBoost.boosts.some(line => line.includes('Lydia'))).toBe(true);

	for (const name of [
		'Christmas dye',
		'Spooky dye',
		'Sun Scream',
		'Festive scarf',
		'Birthday balloons',
		'Patricia'
	]) {
		const item = Items.getOrThrow(name);
		expect(item.customItemData?.cantBeSacrificed, name).toBeFalsy();
	}
	for (const name of ['Christmas dye', 'Spooky dye', 'Sun Scream', 'Festive scarf']) {
		const item = Items.getOrThrow(name);
		expect(sellPriceOfItem(item).basePrice, name).toBeGreaterThan(0);
		expect(sacrificePriceOfItem(item, 1), name).toBeGreaterThan(0);
	}

	expect(isGEUntradeable(Items.getOrThrow('Christmas dye'))).toBe(false);
	expect(isGEUntradeable(Items.getOrThrow('Spooky dye'))).toBe(false);
	expect(Items.getOrThrow('Ho-ho hammer').equipment).toBeTruthy();
	expect(Items.getOrThrow('Patricia').customItemData?.isPet).toBe(true);
	expect(getSimilarItems(itemID('Patricia'))).toContain(itemID('Lydia'));

	expect(findDisassemblyGroup(Items.getOrThrow('Festive jumper (2021)'))).toBeTruthy();
	expect(allCLItems.has(itemID('Christmas dye'))).toBe(true);
	expect(allCLItems.has(itemID('Patricia'))).toBe(true);
	expect(allCLItems.has(itemID('Magnegg'))).toBe(true);
	expect(allCLItems.has(itemID('Festive jumper (2021)'))).toBe(true);

	expect(backgroundImages.some(background => background.name === 'Christmas' && background.available)).toBe(true);
	expect(backgroundImages.some(background => background.name === 'Halloween Logo' && background.available)).toBe(
		true
	);
	expect(backgroundImages.some(background => background.name === 'Halloween Manor' && background.available)).toBe(
		true
	);
	expect(ItemIconPacks[IconPackID.Halloween].name).toBe('Halloween');
	expect(pohWallkits.some(kit => kit.name === 'Halloween')).toBe(true);
	expect(growablePets.some(pet => pet.stages.includes(itemID('Magnegg')))).toBe(true);
	expect(growablePets.some(pet => pet.stages.includes(itemID('Saradomin egg')))).toBe(true);
});
