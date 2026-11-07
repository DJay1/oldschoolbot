import { FIRST_AGE_REQUIRED_SACRIFICES, namedOutfitXpLine } from '@/lib/bso/firstAge/shards.js';
import {
	consolidateSkillXpBonusLines,
	resolveSkillOutfitXp,
	skillXpBonusClauses,
	skillXpOutfits
} from '@/lib/bso/firstAge/skillOutfits.js';

import { Items } from 'oldschooljs';
import { expect, test } from 'vitest';

import { makeGearBank } from '../utils.js';

function outfitLine(outfit: string, percent: number | null, xp: number, fromMaxSet = true): string {
	return namedOutfitXpLine({ outfit, percent, xp, fromMaxSet });
}

function possessiveLabel(name: string): string | null {
	const match = name.match(/^(.+?'s|.+s')(?=\s)/);
	return match?.[1] ?? null;
}

test('repeated First Age and outfit lines in one trip become one line per bonus, with XP summed', () => {
	const farmer = (xp: number) => outfitLine("Farmer's", 2.5, xp);
	const message = [
		':minion: Your minion finished auto farming your patches.',
		'**XP gained:** Farming 51,479 XP (165k/Hr).',
		'You received 10% bonus XP for First age outfit items.',
		farmer(3),
		farmer(36),
		farmer(125),
		farmer(33),
		farmer(29),
		'**Boosts:** 100% for Plopper.',
		'**Messages:** Caught 1x Baby impling jar.'
	].join('\n');

	const consolidated = consolidateSkillXpBonusLines(message);
	expect(consolidated).toEqual(
		[
			':minion: Your minion finished auto farming your patches.',
			'**XP gained:** Farming 51,479 XP (165k/Hr).',
			'You received 10% bonus XP for First age outfit items.',
			farmer(3 + 36 + 125 + 33 + 29),
			'**Boosts:** 100% for Plopper.',
			'**Messages:** Caught 1x Baby impling jar.'
		].join('\n')
	);
	expect(consolidated.match(/First age outfit items/g)).toHaveLength(1);
	expect(consolidated.match(/\*\*Farmer's bonus:\*\*/g)).toHaveLength(1);
	expect(consolidateSkillXpBonusLines(consolidated)).toEqual(consolidated);
});

test('the same outfit is summed when addXP results are inline, and other outfits stay separate', () => {
	const first =
		'You received 1,000 <:farming:1> XP. You received 10% bonus XP for First age outfit items. ' +
		`${outfitLine("Farmer's", 2.5, 25)} (100k/Hr)`;
	const second =
		'You received 500 <:farming:1> XP. You received 10% bonus XP for First age outfit items. ' +
		`${outfitLine("Farmer's", 2.5, 12)} (50k/Hr)`;
	const woodcutting =
		'You received 800 <:woodcutting:1> XP. You received 10% bonus XP for First age outfit items. ' +
		`${outfitLine('Lumberjack', 2.5, 20)}`;

	expect(consolidateSkillXpBonusLines(`${first}\n${second}\n${woodcutting}`)).toEqual(
		[
			'You received 1,000 <:farming:1> XP. You received 10% bonus XP for First age outfit items. ' +
				`${outfitLine("Farmer's", 2.5, 37)} (100k/Hr)`,
			'You received 500 <:farming:1> XP. (50k/Hr)',
			`You received 800 <:woodcutting:1> XP. ${outfitLine('Lumberjack', 2.5, 20)}`
		].join('\n')
	);
});

test('a single bonus line, the 5b cap text, and unrelated boost lines stay as written', () => {
	const once = `You received 12,000 <:fishing:1> XP. You received 10% bonus XP for First age outfit items. ${outfitLine('Angler', 2.5, 250)} (1.5m/Hr)\n**Congratulations! Your Fishing level is now 50** 🎉`;
	expect(consolidateSkillXpBonusLines(once)).toEqual(once);

	const capped = [
		`You received no XP because you have 5b FarmingXP already Tracked 1,234<:farming:1>XP. (100k/Hr) You received 10% bonus XP for First age outfit items. ${outfitLine("Farmer's", 2.5, 30)}`,
		`🚫 50 farming XP You received 10% bonus XP for First age outfit items. ${outfitLine("Farmer's", 2.5, 1)}`
	].join('\n');
	expect(consolidateSkillXpBonusLines(capped)).toEqual(
		[
			`You received no XP because you have 5b FarmingXP already Tracked 1,234<:farming:1>XP. (100k/Hr) You received 10% bonus XP for First age outfit items. ${outfitLine("Farmer's", 2.5, 31)}`,
			'🚫 50 farming XP'
		].join('\n')
	);

	const masterCape =
		'You received 8% bonus XP for having a Farming master cape. You received 8% bonus XP for having a Farming master cape.';
	expect(consolidateSkillXpBonusLines(masterCape)).toEqual(masterCape);

	const differentPercents = `${outfitLine("Farmer's", 0.4, 4, false)} ${outfitLine("Farmer's", 2.5, 25, false)}`;
	expect(consolidateSkillXpBonusLines(differentPercents)).toEqual(differentPercents);

	const differentSources = `${outfitLine('Angler', 2.5, 100, false)} ${outfitLine('Angler', 2.5, 50, true)}`;
	expect(consolidateSkillXpBonusLines(differentSources)).toEqual(differentSources);
});

test('flat outfit lines sum, and skillXpBonusClauses returns each bonus once', () => {
	const flat = (xp: number) => outfitLine("Fletcher's", null, xp, false);
	expect(consolidateSkillXpBonusLines(`${flat(1000)} ${flat(250)}`)).toEqual(flat(1250));

	expect(
		skillXpBonusClauses(
			[
				`You received 100 <:fishing:1> XP. You received 10% bonus XP for First age outfit items. ${outfitLine('Angler', 2.5, 2)} (1k/Hr)`,
				'**Congratulations! Your Fishing level is now 50** 🎉',
				`You received 200 <:fishing:1> XP. You received 10% bonus XP for First age outfit items. ${outfitLine('Angler', 2.5, 5)} (2k/Hr)`
			].join('\n')
		)
	).toEqual(`You received 10% bonus XP for First age outfit items. ${outfitLine('Angler', 2.5, 7)}`);
});

test('outfit labels match the piece names', () => {
	for (const outfit of skillXpOutfits) {
		const names = outfit.pieces.flatMap(piece =>
			piece.ids.flatMap(id => {
				const name = Items.itemNameFromId(id);
				return name ? [name] : [];
			})
		);
		const possessives = [...new Set(names.map(possessiveLabel).filter((label): label is string => label !== null))];
		if (possessives.length === 1) {
			expect(outfit.outfit, names.join(', ')).toEqual(possessives[0]);
			continue;
		}
		for (const name of names) {
			expect(name.startsWith(outfit.outfit), `${outfit.outfit} vs ${name}`).toEqual(true);
		}
	}

	for (const group of FIRST_AGE_REQUIRED_SACRIFICES) {
		const names = group.slots.flat();
		const possessives = [...new Set(names.map(possessiveLabel).filter((label): label is string => label !== null))];
		if (possessives.length === 1) {
			expect(group.outfit, names.join(', ')).toEqual(possessives[0]);
		}
	}

	expect(FIRST_AGE_REQUIRED_SACRIFICES.map(group => group.outfit)).toContain("Zealot's");
	expect(FIRST_AGE_REQUIRED_SACRIFICES.map(group => group.outfit)).toContain('Raiments of the Eye');
	expect(FIRST_AGE_REQUIRED_SACRIFICES.map(group => group.outfit)).toContain('Master farmer');
	expect(FIRST_AGE_REQUIRED_SACRIFICES.map(group => group.outfit)).toContain('Blacksmith');

	const source = makeGearBank();
	expect(resolveSkillOutfitXp({ source, skill: 'fletching', baseXp: 10_000, wearingFullMaxSet: true })?.line).toEqual(
		outfitLine("Fletcher's", 3, 300)
	);
	expect(resolveSkillOutfitXp({ source, skill: 'farming', baseXp: 10_000, wearingFullMaxSet: true })?.line).toEqual(
		outfitLine("Farmer's", 2.5, 250)
	);
	expect(
		resolveSkillOutfitXp({ source, skill: 'construction', baseXp: 10_000, wearingFullMaxSet: true })?.line
	).toEqual(outfitLine("Carpenter's", 2.5, 250));
	expect(resolveSkillOutfitXp({ source, skill: 'invention', baseXp: 10_000, wearingFullMaxSet: true })?.line).toEqual(
		outfitLine("Inventors'", 4, 400)
	);
	expect(
		resolveSkillOutfitXp({ source, skill: 'divination', baseXp: 10_000, wearingFullMaxSet: true })?.line
	).toEqual(outfitLine("Diviner's", 4, 400));
	expect(resolveSkillOutfitXp({ source, skill: 'runecraft', baseXp: 10_000, wearingFullMaxSet: true })?.line).toEqual(
		outfitLine('Master runecrafter', 10, 1000)
	);
	expect(resolveSkillOutfitXp({ source, skill: 'smithing', baseXp: 10_000, wearingFullMaxSet: true })?.line).toEqual(
		outfitLine('Blacksmith', 10, 1000)
	);
});
