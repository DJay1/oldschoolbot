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
		outfit: "Farmer's",
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
		outfit: "Carpenter's",
		where: 'skilling',
		fullPercent: 2.5,
		pieces: standardPieces(["Carpenter's helmet", "Carpenter's shirt", "Carpenter's trousers", "Carpenter's boots"])
	},
	{
		skill: 'fletching',
		outfit: "Fletcher's",
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
		outfit: "Inventors'",
		where: 'anywhere',
		fullPercent: 4,
		pieces: flatPieces(inventorOutfit, 0.5)
	},
	{
		skill: 'divination',
		outfit: "Diviner's",
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

const FIRST_AGE_BONUS_PATTERN = /You received (\d+(?:\.\d+)?)% bonus XP for First age outfit items\./g;
const LAUNCH_XP_BONUS_PATTERN = /You received \d+% bonus XP from the Launch event\./g;
const OUTFIT_PERCENT_PATTERN = /\*\*([^*]+?) bonus:\*\* (\d+(?:\.\d+)?)% \(([^)]+) XP\) from (your .+? outfit)\./g;
const OUTFIT_FLAT_PATTERN = /\*\*([^*]+?) bonus:\*\* ([^(\n]+?) XP from (your .+? outfit)\./g;
const BONUS_CLAUSE_PATTERN =
	/You received \d+(?:\.\d+)?% bonus XP for First age outfit items\.|\*\*[^*]+ bonus:\*\*.*?outfit\./g;

interface TextSpan {
	start: number;
	end: number;
}

interface OutfitHit extends TextSpan {
	outfit: string;
	percent: number | null;
	xp: number;
	fromMaxSet: boolean;
}

function parseLocaleInt(value: string): number {
	const digits = value.replace(/\D/g, '');
	return digits.length > 0 ? Number(digits) : Number.NaN;
}

function viaForOutfit(outfit: string, fromMaxSet: boolean): string {
	return fromMaxSet ? `your First Age (max) set, same as the ${outfit} outfit` : `your ${outfit} outfit`;
}

function rangesOverlap(spans: readonly TextSpan[]): boolean {
	const sorted = [...spans].sort((a, b) => a.start - b.start);
	for (let i = 1; i < sorted.length; i++) {
		if (sorted[i].start < sorted[i - 1].end) return true;
	}
	return false;
}

/** Drop a repeated sentence, including the gap that separated it from the previous text. */
function removalSpan(message: string, start: number, end: number): TextSpan {
	const lineStart = message.lastIndexOf('\n', start - 1) + 1;
	const newlineAt = message.indexOf('\n', end);
	const lineContentEnd = newlineAt === -1 ? message.length : newlineAt;
	const aloneOnLine =
		message.slice(lineStart, start).trim() === '' && message.slice(end, lineContentEnd).trim() === '';
	if (aloneOnLine) {
		if (lineStart > 0) return { start: lineStart - 1, end: lineContentEnd };
		if (newlineAt !== -1) return { start: 0, end: newlineAt + 1 };
		return { start: 0, end: message.length };
	}
	if (start > 0 && message[start - 1] === ' ') return { start: start - 1, end };
	return { start, end };
}

function applyEdits(message: string, edits: { start: number; end: number; text: string }[]): string {
	const sorted = [...edits].sort((a, b) => a.start - b.start);
	if (rangesOverlap(sorted)) return message;
	let cursor = 0;
	let out = '';
	for (const edit of sorted) {
		out += message.slice(cursor, edit.start);
		out += edit.text;
		cursor = edit.end;
	}
	return out + message.slice(cursor);
}

/**
 * One line per distinct First Age sentence and skilling-outfit bonus.
 * Repeated lines from several addXP calls keep the first wording and sum the XP.
 * A single line is left untouched. Amounts granted to the player do not change.
 */
export function consolidateSkillXpBonusLines(message: string): string {
	if (!message) return message;

	const edits: { start: number; end: number; text: string }[] = [];
	const launchHits: TextSpan[] = [];
	for (const match of message.matchAll(LAUNCH_XP_BONUS_PATTERN)) {
		const index = match.index;
		if (index === undefined) continue;
		launchHits.push({ start: index, end: index + match[0].length });
	}
	for (const span of launchHits.slice(1)) {
		edits.push({ ...removalSpan(message, span.start, span.end), text: '' });
	}
	const firstAgeGroups = new Map<string, TextSpan[]>();
	for (const match of message.matchAll(FIRST_AGE_BONUS_PATTERN)) {
		const index = match.index;
		if (index === undefined) continue;
		const spans = firstAgeGroups.get(match[1]) ?? [];
		spans.push({ start: index, end: index + match[0].length });
		firstAgeGroups.set(match[1], spans);
	}
	for (const spans of firstAgeGroups.values()) {
		for (const span of spans.slice(1)) {
			const removal = removalSpan(message, span.start, span.end);
			edits.push({ ...removal, text: '' });
		}
	}

	const percentHits: OutfitHit[] = [];
	for (const match of message.matchAll(OUTFIT_PERCENT_PATTERN)) {
		const index = match.index;
		if (index === undefined) continue;
		const outfit = match[1];
		const percent = Number(match[2]);
		const xp = parseLocaleInt(match[3]);
		const fromMaxSet = match[4] === viaForOutfit(outfit, true);
		const fromOutfit = match[4] === viaForOutfit(outfit, false);
		if (!fromMaxSet && !fromOutfit) continue;
		if (!Number.isFinite(percent) || !Number.isFinite(xp)) continue;
		percentHits.push({ start: index, end: index + match[0].length, outfit, percent, xp, fromMaxSet });
	}

	const flatHits: OutfitHit[] = [];
	for (const match of message.matchAll(OUTFIT_FLAT_PATTERN)) {
		const index = match.index;
		if (index === undefined) continue;
		const span = { start: index, end: index + match[0].length };
		if (percentHits.some(hit => hit.start < span.end && span.start < hit.end)) continue;
		const outfit = match[1];
		const xp = parseLocaleInt(match[2]);
		const fromMaxSet = match[3] === viaForOutfit(outfit, true);
		const fromOutfit = match[3] === viaForOutfit(outfit, false);
		if (!fromMaxSet && !fromOutfit) continue;
		if (!Number.isFinite(xp)) continue;
		flatHits.push({ ...span, outfit, percent: null, xp, fromMaxSet });
	}

	const outfitGroups = new Map<string, OutfitHit[]>();
	for (const hit of [...percentHits, ...flatHits]) {
		const key = `${hit.outfit}\0${hit.percent ?? 'flat'}\0${hit.fromMaxSet}`;
		const group = outfitGroups.get(key) ?? [];
		group.push(hit);
		outfitGroups.set(key, group);
	}
	for (const group of outfitGroups.values()) {
		if (group.length < 2) continue;
		group.sort((a, b) => a.start - b.start);
		const [first, ...rest] = group;
		const xp = group.reduce((sum, hit) => sum + hit.xp, 0);
		edits.push({
			start: first.start,
			end: first.end,
			text: namedOutfitXpLine({
				outfit: first.outfit,
				percent: first.percent,
				xp,
				fromMaxSet: first.fromMaxSet
			})
		});
		for (const hit of rest) {
			const removal = removalSpan(message, hit.start, hit.end);
			edits.push({ ...removal, text: '' });
		}
	}

	if (edits.length === 0) return message;
	return applyEdits(message, edits);
}

/** First Age and outfit sentences from an addXP result, for trips that build their own XP line. */
export function skillXpBonusClauses(message: string): string {
	const withoutLevelUps = message
		.split('\n')
		.filter(line => !line.includes('**Congratulations'))
		.join(' ');
	const matches = consolidateSkillXpBonusLines(withoutLevelUps).match(BONUS_CLAUSE_PATTERN);
	return matches ? matches.join(' ') : '';
}
