import {
	FIRST_AGE_REQUIRED_SACRIFICES,
	firstAgeMaxUpgrades,
	getFirstAgeSacrificeSlots
} from '@/lib/bso/firstAge/shards.js';
import {
	allSkillingOutfitItemIDs,
	findSkillingOutfitOption,
	formatSkillingOutfitEquipMessage,
	getSkillingOutfitOptions,
	ownsAllSkillingOutfitPieces,
	pickSkillingOutfitEquip,
	skillingOutfitPresetAutocompleteChoices
} from '@/lib/bso/firstAge/skillingOutfitEquip.js';
import { skillXpOutfits } from '@/lib/bso/firstAge/skillOutfits.js';

import { Bank, itemID } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { filterableTypes, getFilterAutocompleteChoices } from '@/lib/data/filterables.js';

const emptySkills = {};
const maxWearSkills = { defence: 99, prayer: 99, attack: 99, strength: 99, ranged: 99, magic: 99 };

function idsFrom(names: string[]) {
	return names.map(name => itemID(name));
}

describe('Skilling outfit bank filter', () => {
	const filter = filterableTypes.find(f => f.aliases.includes('skilling outfit'));
	const filterIDs = new Set(filter?.items() ?? []);

	test('is named like the other filters and shares the list with sell/drop', () => {
		expect(filter?.name).toBe('Skilling outfit');
		expect(filter?.aliases).toEqual(['skilling outfit', 'skilling outfits', 'outfits', 'skilling_outfit']);
		expect(new Set(allSkillingOutfitItemIDs())).toEqual(filterIDs);
	});

	test('contains every First Age sacrifice piece, First Age items and XP outfit piece', () => {
		for (const slot of getFirstAgeSacrificeSlots()) {
			for (const id of slot.ids) {
				expect(filterIDs.has(id), `missing sacrifice item ${id}`).toBe(true);
			}
		}
		for (const piece of firstAgeMaxUpgrades) {
			expect(filterIDs.has(piece.baseId), piece.baseName).toBe(true);
			expect(filterIDs.has(piece.maxId), piece.maxName).toBe(true);
		}
		for (const outfit of skillXpOutfits) {
			for (const piece of outfit.pieces) {
				for (const id of piece.ids) {
					expect(filterIDs.has(id), `missing ${outfit.outfit} piece ${id}`).toBe(true);
				}
			}
		}
		expect(filterIDs.size).toBe(allSkillingOutfitItemIDs().length);
	});

	test('includes Smiths uniform, Graceful variants, hunter outfits and dyed Raiments', () => {
		for (const name of [
			'Smiths tunic',
			'Smiths trousers',
			'Smiths gloves',
			'Smiths boots',
			'Graceful hood',
			'Arceuus graceful hood',
			'Spooky graceful cape',
			'Varlamore graceful top',
			'Trailblazer graceful legs',
			'Launch graceful hood',
			'Launch graceful cape',
			'Polar camo top',
			'Wood camo legs',
			'Jungle camo top',
			'Desert camo legs',
			'Larupia hat',
			'Graahk headdress',
			'Kyatt top',
			'Hat of the eye (red)',
			'Robe top of the eye (green)',
			'Robe bottoms of the eye (blue)'
		]) {
			expect(filterIDs.has(itemID(name)), name).toBe(true);
		}
		for (const name of [
			'Max cape',
			'Agility cape',
			'Agility cape (t)',
			'Silverhawk boots',
			'Corgo partyhat',
			'Varrock armour 1'
		]) {
			expect(filterIDs.has(itemID(name)), name).toBe(false);
		}
	});

	test("typing skill or outfit finds it inside Discord's 25-choice limit", () => {
		for (const query of ['skill', 'outfit', 'skilling outfit', 'outfits']) {
			const choices = getFilterAutocompleteChoices(query);
			expect(choices.length).toBeLessThanOrEqual(25);
			expect(
				choices.some(choice => choice.name === 'Skilling outfit' && choice.value === 'skilling outfit'),
				`missing from query "${query}": ${choices.map(choice => choice.name).join(', ')}`
			).toBe(true);
		}
		const skillChoices = getFilterAutocompleteChoices('skill');
		expect(skillChoices.some(choice => choice.name === 'Skilling')).toBe(true);
	});
});

describe('Skilling outfit auto-equip picker', () => {
	test('prefers a higher-tier owned piece and never picks unowned items', () => {
		const option = findSkillingOutfitOption('woodcutting');
		expect(option?.outfitName).toBe('Lumberjack');
		const bank = new Bank().add('Lumberjack hat').add('Forestry top').add('Lumberjack legs').add('Dragon boots');
		const picked = pickSkillingOutfitEquip({
			option: option!,
			bank,
			equippedIds: new Set(),
			skills: emptySkills
		});
		expect(picked.toEquipIds).toEqual(idsFrom(['Lumberjack hat', 'Forestry top', 'Lumberjack legs']));
		expect(picked.toEquipIds.includes(itemID('Forestry hat'))).toBe(false);
		expect(picked.toEquipIds.includes(itemID('Forestry legs'))).toBe(false);
		expect(picked.toEquipIds.includes(itemID('Dragon boots'))).toBe(false);
		expect(picked.toEquipIds.includes(itemID('Lumberjack boots'))).toBe(false);
		expect(picked.alreadyEquippedIds).toEqual([]);
	});

	test('keeps an already equipped best piece and upgrades a lower one from the bank', () => {
		const option = findSkillingOutfitOption('lumberjack');
		const bank = new Bank().add('Forestry hat');
		const picked = pickSkillingOutfitEquip({
			option: option!,
			bank,
			equippedIds: new Set(idsFrom(['Lumberjack hat', 'Lumberjack top'])),
			skills: emptySkills
		});
		expect(picked.toEquipIds).toEqual([itemID('Forestry hat')]);
		expect(picked.alreadyEquippedIds).toEqual([itemID('Lumberjack top')]);
	});

	test('equips the First Age (max) set when every max piece is owned', () => {
		const option = findSkillingOutfitOption('fishing');
		const bank = new Bank();
		for (const piece of firstAgeMaxUpgrades) bank.add(piece.maxId);
		bank.add('Angler hat');
		const picked = pickSkillingOutfitEquip({
			option: option!,
			bank,
			equippedIds: new Set(),
			skills: maxWearSkills
		});
		expect(picked.fromMaxSet).toBe(true);
		expect(picked.label).toBe('First Age (max)');
		expect(picked.toEquipIds.sort()).toEqual(firstAgeMaxUpgrades.map(piece => piece.maxId).sort());
		expect(picked.toEquipIds.includes(itemID('Angler hat'))).toBe(false);
	});

	test('does not use a partial First Age (max) set in place of the skill outfit', () => {
		const option = findSkillingOutfitOption('fishing');
		const bank = new Bank().add('Angler hat').add('Angler top').add(firstAgeMaxUpgrades[0].maxId);
		const picked = pickSkillingOutfitEquip({
			option: option!,
			bank,
			equippedIds: new Set(),
			skills: emptySkills
		});
		expect(picked.fromMaxSet).toBe(false);
		expect(picked.toEquipIds).toEqual(idsFrom(['Angler hat', 'Angler top']));
	});

	test('First Age option prefers max pieces over base, and only owned pieces', () => {
		const option = findSkillingOutfitOption('first_age');
		const bank = new Bank().add(firstAgeMaxUpgrades[0].maxId).add(firstAgeMaxUpgrades[1].baseId).add('Angler hat');
		const picked = pickSkillingOutfitEquip({
			option: option!,
			bank,
			equippedIds: new Set([firstAgeMaxUpgrades[2].maxId]),
			skills: maxWearSkills
		});
		expect(picked.toEquipIds.sort()).toEqual([firstAgeMaxUpgrades[0].maxId, firstAgeMaxUpgrades[1].baseId].sort());
		expect(picked.alreadyEquippedIds).toEqual([firstAgeMaxUpgrades[2].maxId]);
		expect(picked.toEquipIds.includes(itemID('Angler hat'))).toBe(false);
	});

	test('skips a higher-tier piece the player cannot wear and falls back to a lower one', () => {
		const option = findSkillingOutfitOption('mining');
		const goldenHelmet = itemID('Golden prospector helmet');
		const regularHelmet = itemID('Prospector helmet');
		const bank = new Bank().add('Prospector helmet').add('Prospector jacket');
		const picked = pickSkillingOutfitEquip({
			option: option!,
			bank,
			equippedIds: new Set(),
			skills: emptySkills
		});
		expect(picked.toEquipIds.includes(goldenHelmet)).toBe(false);
		expect(picked.toEquipIds).toEqual(idsFrom(['Prospector helmet', 'Prospector jacket']));
		expect(picked.toEquipIds).toContain(regularHelmet);
	});

	test('Hunter auto-equip prefers Kyatt over Larupia and camo, and never equips unowned pieces', () => {
		const option = findSkillingOutfitOption('hunter');
		expect(option?.outfitName).toBe('Hunter');
		const bank = new Bank()
			.add('Larupia hat')
			.add('Larupia top')
			.add('Kyatt hat')
			.add('Jungle camo top')
			.add('Jungle camo legs');
		const picked = pickSkillingOutfitEquip({
			option: option!,
			bank,
			equippedIds: new Set(),
			skills: { hunter: 99 }
		});
		expect(picked.toEquipIds).toEqual(idsFrom(['Kyatt hat', 'Larupia top', 'Jungle camo legs']));
		expect(picked.toEquipIds.includes(itemID('Larupia hat'))).toBe(false);
		expect(picked.toEquipIds.includes(itemID('Kyatt top'))).toBe(false);
	});

	test('returns one short line and does not list equipped items', () => {
		const longName = 'A'.repeat(80);
		const equippedNames = Array.from({ length: 7 }, (_, i) => `${longName} ${i}`);
		const alreadyNames = Array.from({ length: 7 }, (_, i) => `${longName} already ${i}`);
		const failReasons = Array.from(
			{ length: 7 },
			(_, i) => `${longName} ${i} needs 99 Woodcutting, 99 Strength, 99 Defence and 99 Attack.`
		);
		const message = formatSkillingOutfitEquipMessage({
			label: 'First Age (max)',
			setup: 'skilling',
			equippedNames,
			alreadyNames,
			failReasons
		});
		expect(message).toBe('You equipped your First Age (max) in your skilling setup.');
		expect(message.includes(longName)).toBe(false);
		expect(message.includes('\n')).toBe(false);
		expect(
			formatSkillingOutfitEquipMessage({
				label: 'Graceful',
				setup: 'skilling',
				equippedNames: [],
				alreadyNames: ['Graceful hood'],
				failReasons: []
			})
		).toBe('Your skilling setup already has your best Graceful pieces.');
		expect(
			formatSkillingOutfitEquipMessage({
				label: 'Lumberjack',
				setup: 'skilling',
				equippedNames: [],
				alreadyNames: [],
				failReasons: []
			})
		).toBe("You don't have any Lumberjack pieces to equip.");
	});

	test('outfit names stay plain and skill searches still find them', () => {
		const lumberjack = findSkillingOutfitOption('woodcutting');
		expect(lumberjack?.name).toBe('Lumberjack');
		expect(lumberjack?.name.includes('(')).toBe(false);
		expect(findSkillingOutfitOption('Graceful')?.name).toBe('Graceful');
		expect(findSkillingOutfitOption('first age')?.name).toBe('First Age (max)');
		expect(findSkillingOutfitOption("Smiths' uniform")?.name).toBe("Smiths' uniform");
		expect(
			getSkillingOutfitOptions().every(option => !option.name.includes('(') || option.name === 'First Age (max)')
		).toBe(true);
		expect(getSkillingOutfitOptions().every(option => findSkillingOutfitOption(option.name))).toBe(true);
	});

	test('/gear equip preset outfit autocomplete uses dots, plain names and skips reserved preset names', () => {
		const emptyBank = new Bank();
		const empty = skillingOutfitPresetAutocompleteChoices({
			value: '',
			bank: emptyBank,
			equippedIds: new Set()
		});
		expect(empty.some(choice => choice.value === 'Graceful' && choice.name === '🔴 Graceful')).toBe(true);
		expect(empty.some(choice => choice.value === 'Lumberjack' && choice.name === '🔴 Lumberjack')).toBe(true);
		expect(empty.every(choice => !choice.name.includes('Outfit:') && !choice.name.includes('(woodcutting)'))).toBe(
			true
		);

		const fullGraceful = new Bank()
			.add('Graceful hood')
			.add('Graceful top')
			.add('Graceful legs')
			.add('Graceful gloves')
			.add('Graceful boots')
			.add('Graceful cape');
		const gracefulOption = findSkillingOutfitOption('Graceful')!;
		expect(ownsAllSkillingOutfitPieces(gracefulOption, fullGraceful, new Set())).toBe(true);
		const owned = skillingOutfitPresetAutocompleteChoices({
			value: 'grace',
			bank: fullGraceful,
			equippedIds: new Set()
		});
		expect(owned.some(choice => choice.value === 'Graceful' && choice.name === '🟢 Graceful')).toBe(true);

		const wood = skillingOutfitPresetAutocompleteChoices({
			value: 'wood',
			bank: emptyBank,
			equippedIds: new Set()
		});
		expect(wood.some(choice => choice.value === 'Lumberjack')).toBe(true);

		const reserved = skillingOutfitPresetAutocompleteChoices({
			value: 'grace',
			bank: fullGraceful,
			equippedIds: new Set(),
			reservedNames: ['Graceful']
		});
		expect(reserved.some(choice => choice.value === 'Graceful')).toBe(false);
	});
});

describe('First Age sacrifice list coverage', () => {
	test('every sacrifice outfit is a selectable auto-equip option', () => {
		const names = new Set(getSkillingOutfitOptions().map(option => option.outfitName));
		for (const group of FIRST_AGE_REQUIRED_SACRIFICES) {
			expect(names.has(group.outfit), group.outfit).toBe(true);
		}
		for (const name of ["Smiths' uniform", 'Graceful', 'Hunter', 'Larupia', 'Kyatt', 'Jungle camo']) {
			expect(names.has(name), name).toBe(true);
		}
	});
});
