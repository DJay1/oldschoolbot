import { generateXPLevelQuestion } from '@/lib/bso/commands/spawnBoxLampCommand.js';

import { Bank, itemID } from 'oldschooljs';
import { expect, test } from 'vitest';

import { clueFinishLootImage, ZIPPY_FOUND_LOOT_LINE, zippyClueFinishLines } from '@/lib/clues/clueFinishLoot.js';

const casket = itemID('Reward casket (beginner)');
const easy = itemID('Reward casket (easy)');
const box = itemID('Tradeable Mystery Box');

test('Zippy clue lines name the bonus and do not list items', () => {
	const bonusLoot = new Bank().add(easy, 2).add(box, 1);
	const lines = zippyClueFinishLines({ bonusLoot, doubled: true });

	expect(lines).toContain('Zippy has **doubled** your loot.');
	expect(lines).toContain(ZIPPY_FOUND_LOOT_LINE);
	expect(lines).not.toContain('Reward casket');
	expect(lines).not.toContain('Tradeable Mystery Box');
	expect(lines).not.toContain('has found these items');
});

test('Zippy clue lines stay empty when nothing was found or doubled', () => {
	expect(zippyClueFinishLines({ bonusLoot: new Bank(), doubled: false })).toEqual('');
	expect(zippyClueFinishLines({ bonusLoot: new Bank(), doubled: true })).toEqual(
		'\nZippy has **doubled** your loot.'
	);
});

test('the clue loot image is one pile of the original loot, Zippy finds, and later extras', () => {
	const base = new Bank().add(casket, 5);
	expect(clueFinishLootImage({ loot: base, extras: new Bank(), base })?.amount(casket)).toEqual(5);
	expect(clueFinishLootImage({ loot: new Bank(), extras: new Bank(), base })).toBeNull();

	const withZippy = new Bank().add(base).add(easy, 1).add(box, 1);
	const zippyImage = clueFinishLootImage({ loot: withZippy, extras: new Bank(), base });
	expect(zippyImage?.amount(casket)).toEqual(5);
	expect(zippyImage?.amount(easy)).toEqual(1);
	expect(zippyImage?.amount(box)).toEqual(1);

	const doubled = new Bank().add(withZippy);
	doubled.multiply(2);
	const doubledImage = clueFinishLootImage({ loot: doubled, extras: new Bank(), base });
	expect(doubledImage?.amount(casket)).toEqual(10);
	expect(doubledImage?.amount(easy)).toEqual(2);
	expect(doubledImage?.amount(box)).toEqual(2);

	// A later doubler hands back another copy of the pile plus one extra box.
	const tripDouble = new Bank().add(doubled).add(box, 1);
	const combined = clueFinishLootImage({ loot: doubled, extras: tripDouble, base });
	expect(combined?.amount(casket)).toEqual(20);
	expect(combined?.amount(easy)).toEqual(4);
	expect(combined?.amount(box)).toEqual(5);
});

test('spawn lamp and box questions offer four unique level buttons, and the first is correct', () => {
	for (let i = 0; i < 40; i++) {
		const question = generateXPLevelQuestion();
		expect(question.answers).toHaveLength(4);
		expect(new Set(question.answers).size).toEqual(4);
		const level = question.explainAnswer.match(/level (\d+)!/)?.[1];
		expect(question.answers[0]).toEqual(level);
		for (const answer of question.answers) {
			const n = Number(answer);
			expect(Number.isInteger(n)).toEqual(true);
			expect(n).toBeGreaterThanOrEqual(1);
			expect(n).toBeLessThanOrEqual(120);
		}
		expect(question.question).toContain('**');
	}
});
