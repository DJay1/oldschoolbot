import { Items, itemID } from 'oldschooljs';

import type { SkillNameType } from '@/lib/skilling/types.js';
import type { Skills } from '@/lib/types/index.js';
import { formatList } from '@/lib/util/smallUtils.js';
import { FIRST_AGE_REQUIRED_SACRIFICES, firstAgeMaxUpgrades, getFirstAgeSacrificeSlots } from './shards.js';
import { skillXpOutfits } from './skillOutfits.js';

export interface SkillingOutfitSlot {
	names: readonly string[];
	ids: number[];
}

export interface SkillingOutfitOption {
	key: string;
	name: string;
	aliases: string[];
	kind: 'outfit' | 'first_age';
	outfitName: string;
	skill: SkillNameType | null;
	slots: SkillingOutfitSlot[];
}

const EXTRA_SKILL_BY_OUTFIT: Record<string, SkillNameType> = {
	'Master farmer': 'farming',
	Rogue: 'thieving',
	'Raiments of the Eye': 'runecraft',
	"Zealot's": 'prayer'
};

function slug(name: string) {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_|_$/g, '');
}

function skillForOutfit(outfitName: string): SkillNameType | null {
	const fromXp = skillXpOutfits.find(outfit => outfit.outfit === outfitName);
	if (fromXp) return fromXp.skill;
	return EXTRA_SKILL_BY_OUTFIT[outfitName] ?? null;
}

function slotFromNames(names: readonly string[]): SkillingOutfitSlot {
	return { names, ids: names.map(name => itemID(name)) };
}

function optionFromOutfit(outfitName: string, slots: readonly (readonly string[])[]): SkillingOutfitOption {
	const skill = skillForOutfit(outfitName);
	const aliases = [outfitName.toLowerCase(), slug(outfitName)];
	if (skill && !aliases.includes(skill)) aliases.push(skill);
	return {
		key: slug(outfitName),
		name: skill ? `${outfitName} (${skill})` : outfitName,
		aliases,
		kind: 'outfit',
		outfitName,
		skill,
		slots: slots.map(slotFromNames)
	};
}

let cachedOptions: SkillingOutfitOption[] | null = null;
let cachedItemIDs: number[] | null = null;

export function getSkillingOutfitOptions(): SkillingOutfitOption[] {
	if (cachedOptions) return cachedOptions;

	const firstAge: SkillingOutfitOption = {
		key: 'first_age',
		name: 'First Age (max)',
		aliases: ['first age', 'first age max', 'first_age', 'firstage', 'max', 'max set'],
		kind: 'first_age',
		outfitName: 'First Age (max)',
		skill: null,
		slots: firstAgeMaxUpgrades.map(piece => slotFromNames([piece.baseName, piece.maxName]))
	};

	const options = [
		firstAge,
		...FIRST_AGE_REQUIRED_SACRIFICES.map(group => optionFromOutfit(group.outfit, group.slots))
	];

	for (const outfit of skillXpOutfits) {
		if (options.some(option => option.outfitName === outfit.outfit)) continue;
		const slots = outfit.pieces.map(piece => {
			const names = piece.ids.map(id => Items.itemNameFromId(id)).filter((name): name is string => Boolean(name));
			return { names, ids: [...piece.ids] };
		});
		options.push({
			...optionFromOutfit(
				outfit.outfit,
				slots.map(slot => slot.names)
			),
			slots
		});
	}

	cachedOptions = options;
	return options;
}

/** Every piece used by First Age sacrifices, First Age (base and max) items, and XP skilling outfits. */
export function allSkillingOutfitItemIDs(): number[] {
	if (cachedItemIDs) return cachedItemIDs;
	const ids = new Set<number>();
	for (const slot of getFirstAgeSacrificeSlots()) {
		for (const id of slot.ids) ids.add(id);
	}
	for (const piece of firstAgeMaxUpgrades) {
		ids.add(piece.baseId);
		ids.add(piece.maxId);
	}
	for (const outfit of skillXpOutfits) {
		for (const piece of outfit.pieces) {
			for (const id of piece.ids) ids.add(id);
		}
	}
	cachedItemIDs = [...ids];
	return cachedItemIDs;
}

export function findSkillingOutfitOption(input: string): SkillingOutfitOption | undefined {
	const value = input.trim().toLowerCase();
	if (!value) return undefined;
	return getSkillingOutfitOptions().find(
		option =>
			option.key === value ||
			option.name.toLowerCase() === value ||
			option.outfitName.toLowerCase() === value ||
			option.aliases.some(alias => alias.toLowerCase() === value)
	);
}

export function equippedItemIds(
	gear:
		| { raw(): Record<string, { item: number; quantity: number } | null> }
		| Record<string, { item: number; quantity: number } | null>
): Set<number> {
	const raw =
		typeof (gear as { raw?: () => unknown }).raw === 'function'
			? (gear as { raw: () => Record<string, { item: number; quantity: number } | null> }).raw()
			: (gear as Record<string, { item: number; quantity: number } | null>);
	const ids = new Set<number>();
	for (const slot of Object.values(raw)) {
		if (slot) ids.add(slot.item);
	}
	return ids;
}

function meetsSkillRequirements(id: number, skills: Skills): boolean {
	const item = Items.get(id);
	const requirements = item?.equipment?.requirements;
	if (!requirements) return true;
	for (const [skill, requiredLevel] of Object.entries(requirements)) {
		if (!requiredLevel) continue;
		const level = skills[skill as keyof Skills] ?? 0;
		if (level < requiredLevel) return false;
	}
	return true;
}

function ownsPiece(bank: { amount(id: number): number }, equipped: Set<number>, id: number) {
	return equipped.has(id) || bank.amount(id) > 0;
}

export interface SkillingOutfitPick {
	option: SkillingOutfitOption;
	label: string;
	fromMaxSet: boolean;
	toEquipIds: number[];
	alreadyEquippedIds: number[];
	skippedRequirements: { id: number; name: string }[];
}

function pickBestIdForSlot(
	slot: SkillingOutfitSlot,
	bank: { amount(id: number): number },
	equipped: Set<number>,
	skills: Skills,
	skippedRequirements: { id: number; name: string }[]
): number | null {
	for (let i = slot.ids.length - 1; i >= 0; i--) {
		const id = slot.ids[i];
		if (!ownsPiece(bank, equipped, id)) continue;
		if (!meetsSkillRequirements(id, skills)) {
			const name = slot.names[i] ?? Items.itemNameFromId(id) ?? 'Unknown item';
			if (!skippedRequirements.some(skipped => skipped.id === id)) {
				skippedRequirements.push({ id, name });
			}
			continue;
		}
		return id;
	}
	return null;
}

function ownsFullFirstAgeMax(bank: { amount(id: number): number }, equipped: Set<number>, skills: Skills): boolean {
	return firstAgeMaxUpgrades.every(
		piece => ownsPiece(bank, equipped, piece.maxId) && meetsSkillRequirements(piece.maxId, skills)
	);
}

function labelForPickedIds(option: SkillingOutfitOption, pickedIds: number[]): string {
	if (option.kind === 'first_age') {
		const allMax =
			pickedIds.length > 0 && pickedIds.every(id => firstAgeMaxUpgrades.some(piece => piece.maxId === id));
		return allMax && pickedIds.length === firstAgeMaxUpgrades.length ? 'First Age (max)' : 'First Age';
	}
	const names = pickedIds.map(id => Items.itemNameFromId(id)).filter((name): name is string => Boolean(name));
	if (names.length === 0) return option.outfitName;
	const prefixes = names.map(name =>
		name
			.replace(
				/\s+(hat|headband|helmet|hood|headwear|top|jacket|shirt|torso|robe|garb|legs|waders|trousers|pants|skirt|legwear|boots|footwear|gloves|handwear|apron|backpack|mask|helm|strawhat|amulet|cape|bracelet|ring|tiara|robe top|robe bottom)$/i,
				''
			)
			.trim()
	);
	const first = prefixes[0];
	if (first && prefixes.every(prefix => prefix === first)) return first;
	return option.outfitName;
}

export function pickSkillingOutfitEquip(input: {
	option: SkillingOutfitOption;
	bank: { amount(id: number): number };
	equippedIds: Set<number>;
	skills: Skills;
}): SkillingOutfitPick {
	const skippedRequirements: { id: number; name: string }[] = [];
	const useMaxSet =
		input.option.kind === 'first_age' || ownsFullFirstAgeMax(input.bank, input.equippedIds, input.skills);
	const option = useMaxSet && input.option.kind !== 'first_age' ? getSkillingOutfitOptions()[0] : input.option;
	const fromMaxSet = option.kind === 'first_age' && useMaxSet && input.option.kind !== 'first_age';

	const chosenIds: number[] = [];
	for (const slot of option.slots) {
		const id = pickBestIdForSlot(slot, input.bank, input.equippedIds, input.skills, skippedRequirements);
		if (id !== null) chosenIds.push(id);
	}

	const alreadyEquippedIds = chosenIds.filter(id => input.equippedIds.has(id));
	const toEquipIds = chosenIds.filter(id => !input.equippedIds.has(id));

	return {
		option,
		label: labelForPickedIds(option, chosenIds),
		fromMaxSet,
		toEquipIds,
		alreadyEquippedIds,
		skippedRequirements
	};
}

export function formatSkillingOutfitEquipMessage(input: {
	label: string;
	setup: string;
	equippedNames: string[];
	alreadyNames: string[];
	failReasons: string[];
}): string {
	const lines: string[] = [];
	if (input.failReasons.length > 0) {
		lines.push(
			input.failReasons.length === 1
				? input.failReasons[0]
				: input.failReasons.map(reason => `- ${reason}`).join('\n')
		);
	}
	if (input.equippedNames.length > 0) {
		const setLabel =
			input.label.endsWith('set') || input.label.includes('Age') ? input.label : `${input.label} outfit`;
		if (input.equippedNames.length >= 4) {
			lines.push(`You equipped your ${setLabel} in your ${input.setup} setup.`);
		} else {
			lines.push(`You equipped ${formatList(input.equippedNames)} in your ${input.setup} setup.`);
		}
	} else if (input.alreadyNames.length > 0) {
		lines.push(`Your ${input.setup} setup already has your best ${input.label} pieces.`);
	} else if (input.failReasons.length === 0) {
		lines.push(`You don't have any ${input.label} pieces to equip.`);
	}
	return lines.join('\n');
}

export function skillingOutfitAutocompleteChoices(value: string): { name: string; value: string }[] {
	const query = value.trim().toLowerCase();
	return getSkillingOutfitOptions()
		.filter(
			option =>
				!query ||
				option.name.toLowerCase().includes(query) ||
				option.outfitName.toLowerCase().includes(query) ||
				option.aliases.some(alias => alias.toLowerCase().includes(query))
		)
		.map(option => ({ name: option.name, value: option.key }));
}
