import { MathRNG } from 'node-rng';
import { describe, expect, test } from 'vitest';

import { bonusRolls, formatModifier, rollModifier, unlockedModifierKinds } from '../../src/lib/slayer/mortimer.js';
import { mortimerTaskSpecs, mortimerTasks } from '../../src/lib/slayer/tasks/mortimerTasks.js';

const fixedRng = (percent: boolean) =>
	({ percentChance: () => percent, randInt: (min: number) => min, pick: <T>(arr: T[]) => arr[0] }) as never;

describe('Mortimer', () => {
	test('every task has a spec and counts its own monster', () => {
		expect(mortimerTasks).toHaveLength(mortimerTaskSpecs.length);
		for (const task of mortimerTasks) {
			expect(task.monsters).toContain(task.monster.id);
			expect(mortimerTaskSpecs.some(spec => spec.monsterId === task.monster.id)).toBe(true);
		}
	});

	test('modifiers unlock with completed Mortimer tasks', () => {
		const withClue = mortimerTaskSpecs.find(spec => spec.modifiers.clue !== null)!;
		const withoutClue = mortimerTaskSpecs.find(spec => spec.modifiers.clue === null)!;
		expect(unlockedModifierKinds(0, withClue)).toEqual(['points', 'quantity']);
		expect(unlockedModifierKinds(15, withClue)).toEqual(['points', 'quantity', 'clue']);
		expect(unlockedModifierKinds(25, withClue)).toEqual(['points', 'quantity', 'clue', 'superior']);
		expect(unlockedModifierKinds(40, withClue)).toEqual(['points', 'quantity', 'clue', 'superior', 'xp']);
		expect(unlockedModifierKinds(40, withoutClue)).toEqual(['points', 'quantity', 'superior', 'xp']);
	});

	test('rolled modifiers stay inside the task range', () => {
		for (const spec of mortimerTaskSpecs) {
			for (let i = 0; i < 50; i++) {
				const modifier = rollModifier(MathRNG, spec, 100);
				const range = spec.modifiers[modifier.kind]!;
				expect(modifier.value).toBeGreaterThanOrEqual(range[0]);
				expect(modifier.value).toBeLessThanOrEqual(range[1]);
				if (modifier.kind !== 'points') expect(Math.abs(modifier.value % 5)).toBe(0);
			}
		}
	});

	test('bonus rolls give whole extras for each 100% and roll the rest', () => {
		expect(bonusRolls(fixedRng(false), 3, 250)).toBe(6);
		expect(bonusRolls(fixedRng(true), 3, 250)).toBe(9);
		expect(bonusRolls(fixedRng(true), 4, 50)).toBe(4);
		expect(bonusRolls(fixedRng(false), 4, 50)).toBe(0);
	});

	test('modifiers read clearly', () => {
		expect(formatModifier({ kind: 'points', value: 25 })).toBe('+25 Slayer points');
		expect(formatModifier({ kind: 'quantity', value: -15 })).toBe('-15% kills');
		expect(formatModifier({ kind: 'xp', value: 40 })).toBe('+40% Slayer XP');
	});
});
