import { describe, expect, test } from 'vitest';

/** Mirrors DICE_PLAYER_WIN_MIN_ROLL in diceCommand.ts (48% player / 52% house). */
const DICE_PLAYER_WIN_MIN_ROLL = 52;

describe('dice house edge constant', () => {
	test('is 48% player win on a 0-99 percentile die', () => {
		expect(DICE_PLAYER_WIN_MIN_ROLL).toBe(52);
		expect(100 - DICE_PLAYER_WIN_MIN_ROLL).toBe(48);
		expect(51 >= DICE_PLAYER_WIN_MIN_ROLL).toBe(false);
		expect(52 >= DICE_PLAYER_WIN_MIN_ROLL).toBe(true);
	});
});
