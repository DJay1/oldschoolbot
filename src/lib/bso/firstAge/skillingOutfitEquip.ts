import { GearStat } from '@oldschoolgg/gear';
import { Items, itemID } from 'oldschooljs';

import {
	gracefulCapes,
	gracefulFeet,
	gracefulHands,
	gracefulHoods,
	gracefulLegs,
	gracefulTops
} from '@/lib/data/gracefulVariants.js';
import type { SkillNameType } from '@/lib/skilling/types.js';
import type { Skills } from '@/lib/types/index.js';
import { formatList } from '@/lib/util/smallUtils.js';
import { FIRST_AGE_REQUIRED_SACRIFICES, firstAgeMaxUpgrades, getFirstAgeSacrificeSlots } from './shards.js';
import { skillXpOutfits } from './skillOutfits.js';

export interface SkillingOutfitSlot {
	names: readonly string[];
	ids: number[];
	tiers: number[];
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
	"Zealot's": 'prayer',
	"Smiths' uniform": 'smithing',
	Graceful: 'agility',
	'Polar camo': 'hunter',
	'Wood camo': 'hunter',
	'Jungle camo': 'hunter',
	'Desert camo': 'hunter',
	Larupia: 'hunter',
	Graahk: 'hunter',
	Kyatt: 'hunter'
};

const NOT_GRACEFUL_OUTFIT_PIECES = new Set([
	'Max cape',
	'Agility cape',
	'Agility cape (t)',
	'Agility cape(t)',
	'Agility master cape',
	'Silverhawk boots'
]);

const RAIMENTS_COLOR_VARIANTS: Record<string, string[]> = {
	'Hat of the eye': ['Hat of the eye (red)', 'Hat of the eye (green)', 'Hat of the eye (blue)'],
	'Robe top of the eye': ['Robe top of the eye (red)', 'Robe top of the eye (green)', 'Robe top of the eye (blue)'],
	'Robe bottoms of the eye': [
		'Robe bottoms of the eye (red)',
		'Robe bottoms of the eye (green)',
		'Robe bottoms of the eye (blue)'
	]
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

function slotFromNames(names: readonly string[], tiers?: number[]): SkillingOutfitSlot {
	return {
		names,
		ids: names.map(name => itemID(name)),
		tiers: tiers ?? names.map((_, index) => index)
	};
}

function optionFromOutfit(
	outfitName: string,
	slots: readonly SkillingOutfitSlot[] | readonly (readonly string[])[],
	opts?: { skillAlias?: boolean; name?: string; aliases?: string[] }
): SkillingOutfitOption {
	const skill = skillForOutfit(outfitName);
	const aliases = opts?.aliases ? [...opts.aliases] : [outfitName.toLowerCase(), slug(outfitName)];
	if (opts?.skillAlias !== false && skill && !aliases.includes(skill)) aliases.push(skill);
	const resolvedSlots: SkillingOutfitSlot[] = slots.map(slot => ('ids' in slot ? slot : slotFromNames(slot)));
	return {
		key: slug(outfitName),
		name: opts?.name ?? (skill ? `${outfitName} (${skill})` : outfitName),
		aliases,
		kind: 'outfit',
		outfitName,
		skill,
		slots: resolvedSlots
	};
}

function gracefulSlot(names: readonly string[], launchName: string): SkillingOutfitSlot {
	const filtered = names.filter(name => !NOT_GRACEFUL_OUTFIT_PIECES.has(name));
	return slotFromNames(
		[...filtered, launchName],
		[...filtered, launchName].map(() => 0)
	);
}

function withRaimentsColorVariants(option: SkillingOutfitOption): SkillingOutfitOption {
	if (option.outfitName !== 'Raiments of the Eye') return option;
	return {
		...option,
		slots: option.slots.map(slot => {
			const extraNames = slot.names.flatMap(name => RAIMENTS_COLOR_VARIANTS[name] ?? []);
			if (extraNames.length === 0) return slot;
			const names = [...slot.names, ...extraNames];
			const baseTier = slot.tiers[0] ?? 0;
			return slotFromNames(
				names,
				names.map(() => baseTier)
			);
		})
	};
}

function extraOutfits(): SkillingOutfitOption[] {
	return [
		optionFromOutfit("Smiths' uniform", [
			['Smiths tunic'],
			['Smiths trousers'],
			['Smiths gloves'],
			['Smiths boots']
		]),
		optionFromOutfit('Graceful', [
			gracefulSlot(gracefulHoods, 'Launch graceful hood'),
			gracefulSlot(gracefulTops, 'Launch graceful top'),
			gracefulSlot(gracefulLegs, 'Launch graceful legs'),
			gracefulSlot(gracefulHands, 'Launch graceful gloves'),
			gracefulSlot(gracefulFeet, 'Launch graceful boots'),
			gracefulSlot(gracefulCapes, 'Launch graceful cape')
		]),
		optionFromOutfit(
			'Hunter',
			[
				slotFromNames(['Larupia hat', 'Graahk headdress', 'Kyatt hat'], [1, 2, 3]),
				slotFromNames(
					[
						'Polar camo top',
						'Wood camo top',
						'Jungle camo top',
						'Desert camo top',
						'Larupia top',
						'Graahk top',
						'Kyatt top'
					],
					[0, 0, 0, 0, 1, 2, 3]
				),
				slotFromNames(
					[
						'Polar camo legs',
						'Wood camo legs',
						'Jungle camo legs',
						'Desert camo legs',
						'Larupia legs',
						'Graahk legs',
						'Kyatt legs'
					],
					[0, 0, 0, 0, 1, 2, 3]
				)
			],
			{ name: 'Hunter', aliases: ['hunter', 'hunter outfit', 'hunter outfits'] }
		),
		optionFromOutfit('Polar camo', [['Polar camo top'], ['Polar camo legs']], { skillAlias: false }),
		optionFromOutfit('Wood camo', [['Wood camo top'], ['Wood camo legs']], { skillAlias: false }),
		optionFromOutfit('Jungle camo', [['Jungle camo top'], ['Jungle camo legs']], { skillAlias: false }),
		optionFromOutfit('Desert camo', [['Desert camo top'], ['Desert camo legs']], { skillAlias: false }),
		optionFromOutfit('Larupia', [['Larupia hat'], ['Larupia top'], ['Larupia legs']], { skillAlias: false }),
		optionFromOutfit('Graahk', [['Graahk headdress'], ['Graahk top'], ['Graahk legs']], { skillAlias: false }),
		optionFromOutfit('Kyatt', [['Kyatt hat'], ['Kyatt top'], ['Kyatt legs']], { skillAlias: false })
	];
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
		...FIRST_AGE_REQUIRED_SACRIFICES.map(group =>
			withRaimentsColorVariants(optionFromOutfit(group.outfit, group.slots))
		)
	];

	for (const outfit of skillXpOutfits) {
		if (options.some(option => option.outfitName === outfit.outfit)) continue;
		const slots = outfit.pieces.map(piece => {
			const names = piece.ids.map(id => Items.itemNameFromId(id)).filter((name): name is string => Boolean(name));
			return slotFromNames(names);
		});
		options.push(optionFromOutfit(outfit.outfit, slots));
	}

	for (const extra of extraOutfits()) {
		if (options.some(option => option.key === extra.key || option.outfitName === extra.outfitName)) continue;
		options.push(extra);
	}

	cachedOptions = options;
	return options;
}

/** Every piece from First Age lists, XP outfits, and the extra skilling outfits. */
export function allSkillingOutfitItemIDs(): number[] {
	if (cachedItemIDs) return cachedItemIDs;
	const ids = new Set<number>();
	for (const option of getSkillingOutfitOptions()) {
		for (const slot of option.slots) {
			for (const id of slot.ids) ids.add(id);
		}
	}
	// Keep sacrifice IDs even if an option is skipped for any reason.
	for (const slot of getFirstAgeSacrificeSlots()) {
		for (const id of slot.ids) ids.add(id);
	}
	for (const piece of firstAgeMaxUpgrades) {
		ids.add(piece.baseId);
		ids.add(piece.maxId);
	}
	cachedItemIDs = [...ids];
	return cachedItemIDs;
}

export function findSkillingOutfitOption(input: string): SkillingOutfitOption | undefined {
	const value = input.trim().toLowerCase();
	if (!value) return undefined;
	const options = getSkillingOutfitOptions();
	return (
		options.find(option => option.key === value) ??
		options.find(
			option =>
				option.name.toLowerCase() === value ||
				option.outfitName.toLowerCase() === value ||
				option.aliases.some(alias => alias.toLowerCase() === value)
		)
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
	const eligible: { id: number; name: string; tier: number }[] = [];
	for (let i = 0; i < slot.ids.length; i++) {
		const id = slot.ids[i];
		const name = slot.names[i] ?? Items.itemNameFromId(id) ?? 'Unknown item';
		const tier = slot.tiers[i] ?? i;
		if (!ownsPiece(bank, equipped, id)) continue;
		if (!meetsSkillRequirements(id, skills)) {
			if (!skippedRequirements.some(skipped => skipped.id === id)) {
				skippedRequirements.push({ id, name });
			}
			continue;
		}
		eligible.push({ id, name, tier });
	}
	if (eligible.length === 0) return null;
	const bestTier = Math.max(...eligible.map(piece => piece.tier));
	const top = eligible.filter(piece => piece.tier === bestTier);
	return top.find(piece => equipped.has(piece.id))?.id ?? top[top.length - 1].id;
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
				/\s+(\((red|green|blue)\)|hat|headband|headdress|helmet|hood|headwear|top|jacket|shirt|tunic|torso|robe|garb|legs|waders|trousers|pants|skirt|legwear|boots|footwear|gloves|handwear|apron|backpack|mask|helm|strawhat|amulet|cape|bracelet|ring|tiara|robe top|robe bottom)$/i,
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

export function gearEquipAutoChoices(value: string): { name: string; value: string }[] {
	const query = value.trim().toLowerCase();
	const stats = Object.values(GearStat)
		.filter(stat => !query || stat.toLowerCase().includes(query) || stat.replaceAll('_', ' ').includes(query))
		.map(stat => ({ name: stat, value: stat }));
	const outfits = skillingOutfitAutocompleteChoices(value);
	const merged = query ? [...outfits, ...stats] : [...stats, ...outfits];
	const seen = new Set<string>();
	const choices: { name: string; value: string }[] = [];
	for (const choice of merged) {
		if (seen.has(choice.value)) continue;
		seen.add(choice.value);
		choices.push(choice);
	}
	return choices.slice(0, 25);
}
