import { BlacksmithOutfit } from '@/lib/bso/bsoConstants.js';
import { divinersOutfit } from '@/lib/bso/collection-log/main.js';
import { inventorOutfit } from '@/lib/bso/collection-log/minigames.js';

import { itemID } from 'oldschooljs';

import type { SkillNameType } from '@/lib/skilling/types.js';
import { namedOutfitXpLine } from './shards.js';

/**
 * XP outfits applied from addXP. Piece percents match the activity that used to add them.
 * A full set of pieces uses `fullPercent` (the piece sum plus the set bonus, where there is one).
 * The full First Age (max) set counts as that full outfit. The higher of the two is used.
 *
 * Outfits that do not grant XP stay where they are: Smiths' uniform (speed), rogue (loot),
 * zealot (offering chance), raiments (rune quantity), graceful (a hunter success chance),
 * and the master farmer outfit (extra patches).
 */
interface SkillOutfitPiece {
	ids: number[];
	percent: number;
}

interface SkillOutfitDefinition {
	skill: SkillNameType;
	outfit: string;
	where: 'anywhere' | 'skilling';
	fullPercent: number;
	pieces: SkillOutfitPiece[];
}

const piece = (name: string, percent: number): SkillOutfitPiece => ({ ids: [itemID(name)], percent });

const standardPieces = (names: readonly string[]): SkillOutfitPiece[] => [
	piece(names[0], 0.4),
	piece(names[1], 0.8),
	piece(names[2], 0.6),
	piece(names[3], 0.2)
];

const flatPieces = (ids: readonly number[], percent: number): SkillOutfitPiece[] =>
	ids.map(id => ({ ids: [id], percent }));

export const skillXpOutfits: readonly SkillOutfitDefinition[] = [
	{
		skill: 'woodcutting',
		outfit: 'Lumberjack',
		where: 'anywhere',
		fullPercent: 2.5,
		pieces: standardPieces(['Lumberjack hat', 'Lumberjack top', 'Lumberjack legs', 'Lumberjack boots'])
	},
	{
		skill: 'mining',
		outfit: 'Prospector',
		where: 'anywhere',
		fullPercent: 2.5,
		pieces: standardPieces(['Prospector helmet', 'Prospector jacket', 'Prospector legs', 'Prospector boots'])
	},
	{
		skill: 'fishing',
		outfit: 'Angler',
		where: 'skilling',
		fullPercent: 2.5,
		pieces: standardPieces(['Angler hat', 'Angler top', 'Angler waders', 'Angler boots'])
	},
	{
		skill: 'firemaking',
		outfit: 'Pyromancer',
		where: 'anywhere',
		fullPercent: 2.5,
		pieces: standardPieces(['Pyromancer hood', 'Pyromancer garb', 'Pyromancer robe', 'Pyromancer boots'])
	},
	{
		skill: 'farming',
		outfit: 'Farmer',
		where: 'anywhere',
		fullPercent: 2.5,
		pieces: [
			piece("Farmer's strawhat", 0.4),
			{ ids: [itemID("Farmer's jacket"), itemID("Farmer's shirt")], percent: 0.8 },
			piece("Farmer's boro trousers", 0.6),
			piece("Farmer's boots", 0.2)
		]
	},
	{
		skill: 'construction',
		outfit: 'Carpenter',
		where: 'skilling',
		fullPercent: 2.5,
		pieces: standardPieces(["Carpenter's helmet", "Carpenter's shirt", "Carpenter's trousers", "Carpenter's boots"])
	},
	{
		skill: 'fletching',
		outfit: 'Fletcher',
		where: 'anywhere',
		fullPercent: 3,
		pieces: [
			piece("Fletcher's hat", 0.5),
			piece("Fletcher's top", 0.5),
			piece("Fletcher's legs", 0.5),
			piece("Fletcher's boots", 0.5),
			piece("Fletcher's gloves", 0.5)
		]
	},
	{
		skill: 'invention',
		outfit: 'Inventor',
		where: 'anywhere',
		fullPercent: 4,
		pieces: flatPieces(inventorOutfit, 0.5)
	},
	{
		skill: 'divination',
		outfit: 'Diviner',
		where: 'anywhere',
		fullPercent: 4,
		pieces: flatPieces(divinersOutfit, 0.5)
	},
	{
		skill: 'runecraft',
		outfit: 'Master runecrafter',
		where: 'anywhere',
		fullPercent: 10,
		pieces: flatPieces(
			[
				itemID('Master runecrafter hat'),
				itemID('Master runecrafter robe'),
				itemID('Master runecrafter skirt'),
				itemID('Master runecrafter boots')
			],
			0
		)
	},
	{
		skill: 'smithing',
		outfit: 'Blacksmith',
		where: 'anywhere',
		fullPercent: 10,
		pieces: flatPieces(BlacksmithOutfit, 0)
	}
];

export interface SkillOutfitSource {
	hasEquippedOrInBank(item: number | string, type?: 'every' | 'one'): boolean;
	gear: {
		skilling: {
			hasEquipped(item: number | string | (string | number)[], every?: boolean): boolean;
		};
	};
}

export interface SkillOutfitXp {
	outfit: string;
	percent: number;
	bonusXp: number;
	fromMaxSet: boolean;
	line: string;
}

function round1(value: number) {
	return Math.round(value * 10) / 10;
}

function ownsPiece(source: SkillOutfitSource, pieceIds: number[], where: SkillOutfitDefinition['where']) {
	if (where === 'skilling') return pieceIds.some(id => source.gear.skilling.hasEquipped(id));
	return pieceIds.some(id => source.hasEquippedOrInBank(id));
}

/**
 * Outfit XP for one skill, before the global XP multiplier and the First Age percent.
 * Returns null when nothing is worn. The full max set and a real outfit do not stack.
 */
export function resolveSkillOutfitXp(input: {
	source: SkillOutfitSource;
	skill: SkillNameType;
	baseXp: number;
	wearingFullMaxSet: boolean;
}): SkillOutfitXp | null {
	const outfits = skillXpOutfits.filter(outfit => outfit.skill === input.skill);
	let best: SkillOutfitXp | null = null;
	for (const outfit of outfits) {
		let owned = 0;
		let pieceSum = 0;
		for (const slot of outfit.pieces) {
			if (!ownsPiece(input.source, slot.ids, outfit.where)) continue;
			owned++;
			pieceSum += slot.percent;
		}
		const fromPieces = round1(owned === outfit.pieces.length ? outfit.fullPercent : pieceSum);
		const percent = input.wearingFullMaxSet ? Math.max(fromPieces, outfit.fullPercent) : fromPieces;
		if (percent <= 0 || input.baseXp <= 0) continue;
		const bonusXp = Math.floor((input.baseXp * percent) / 100);
		if (bonusXp <= 0) continue;
		const fromMaxSet = input.wearingFullMaxSet && fromPieces < percent;
		const line = namedOutfitXpLine({
			outfit: outfit.outfit,
			percent,
			xp: bonusXp,
			fromMaxSet
		});
		if (!best || percent > best.percent) {
			best = { outfit: outfit.outfit, percent, bonusXp, fromMaxSet, line };
		}
	}
	return best;
}

/** First Age and outfit sentences from an addXP result, for trips that build their own XP line. */
export function skillXpBonusClauses(message: string): string {
	const withoutLevelUps = message
		.split('\n')
		.filter(line => !line.includes('**Congratulations'))
		.join(' ');
	const matches = withoutLevelUps.match(
		/You received \d+(?:\.\d+)?% bonus XP for First age outfit items\.|\*\*[^*]+ bonus:\*\*.*?outfit\./g
	);
	return matches ? matches.join(' ') : '';
}
