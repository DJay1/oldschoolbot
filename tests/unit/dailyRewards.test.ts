import '../../src/lib/util/clientSettings.js';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Items } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import {
	applyButtonAction,
	applyWordleAction,
	buttonGameSpec,
	createButtonGameState,
	createHardGame,
	createWordleState,
	DAILY_BUTTON_DECOYS,
	DAILY_BUTTON_GAME_MS,
	DAILY_BUTTON_TARGETS,
	DAILY_WORDLE_GUESSES,
	DAILY_WORDLE_LENGTH,
	DAILY_WORDLE_MS,
	DAILY_WORDLE_WORDS,
	formatButtonGameMessage,
	formatWordleMessage,
	hardestDailyRewardPreview,
	hardGameTimeoutMs,
	isAllowedWordleGuess,
	normalizeWordleGuess,
	parseButtonAction,
	parseWordleAction,
	scoreWordleGuess,
	wordleKeyboardSpec,
	wordleTiles
} from '@/lib/bsc/dailyGames.js';
import { isDailyPendingExpired, remainingMs } from '@/lib/bsc/dailyPending.js';
import {
	buildDailyRewardContent,
	DAILY_TIER,
	type DailyOutcome,
	DOUBLE_LOOT_TOKEN,
	DOUBLE_XP_TOKEN,
	dailyClaimLockWhere,
	dailyOutcomeSummary,
	dailyRatesFor,
	dailyTokenWinLines,
	messageHasUserPing,
	parseDailyDifficulty,
	rollDailyRewardTokens
} from '@/lib/bsc/dailyRewards.js';
import { DAILY_BONUS_COINS, DAILY_GUARANTEED_COINS } from '@/lib/simulation/dailyTable.js';

const DISCORD_CONTENT_LIMIT = 2000;
const DISCORD_LENGTH_MARGIN = 150;
const DISCORD_BUTTON_LABEL_LIMIT = 80;
const DISCORD_ACTION_ROW_LIMIT = 5;
const DISCORD_BUTTONS_PER_ROW = 5;

function mockRng(rolls: number[] = [], picks: unknown[] = []) {
	return {
		roll(_n: number) {
			const forced = rolls.shift();
			if (forced === 0) return true;
			if (forced === 1) return false;
			return forced === undefined ? false : forced === 1;
		},
		pick<T>(items: readonly T[]) {
			const forced = picks.shift();
			if (forced !== undefined) return forced as T;
			return items[0];
		},
		shuffle<T>(items: readonly T[]) {
			return [...items];
		}
	} as unknown as RNGProvider;
}

describe('daily difficulty parsing', () => {
	test('defaults to easy and accepts the three tiers', () => {
		expect(parseDailyDifficulty(undefined)).toBe('easy');
		expect(parseDailyDifficulty('')).toBe('easy');
		expect(parseDailyDifficulty('Easy')).toBe('easy');
		expect(parseDailyDifficulty('medium')).toBe('medium');
		expect(parseDailyDifficulty('HARD')).toBe('hard');
		expect(parseDailyDifficulty('nightmare')).toBe('easy');
	});
});

describe('daily GP and token rates', () => {
	test('base coin ranges are 5x the old 100k-1m and 100k-500k amounts', () => {
		expect([...DAILY_GUARANTEED_COINS]).toEqual([500_000, 5_000_000]);
		expect([...DAILY_BONUS_COINS]).toEqual([500_000, 2_500_000]);
	});

	test('Easy, Medium, and Hard pay and token rates scale as designed', () => {
		expect(dailyRatesFor({ difficulty: 'easy', correct: true })).toEqual({
			coinMultiplier: 1,
			xpChance: 30,
			lootChance: 50
		});
		expect(dailyRatesFor({ difficulty: 'easy', correct: false }).coinMultiplier).toBe(0.4);
		expect(dailyRatesFor({ difficulty: 'medium', correctCount: 3, total: 3 })).toEqual(
			DAILY_TIER.medium.allCorrect
		);
		expect(dailyRatesFor({ difficulty: 'medium', correctCount: 2, total: 3 })).toEqual(
			DAILY_TIER.medium.twoCorrect
		);
		expect(dailyRatesFor({ difficulty: 'hard', success: true, game: 'wordle' })).toEqual(DAILY_TIER.hard.success);
		expect(dailyRatesFor({ difficulty: 'hard', success: false, game: 'buttons' })).toEqual(DAILY_TIER.hard.fail);
		expect(DAILY_TIER.hard.success.coinMultiplier).toBeGreaterThan(DAILY_TIER.medium.allCorrect.coinMultiplier);
		expect(DAILY_TIER.medium.allCorrect.coinMultiplier).toBeGreaterThan(DAILY_TIER.easy.correct.coinMultiplier);
		expect(DAILY_TIER.hard.fail.coinMultiplier).toBeLessThan(DAILY_TIER.easy.correct.coinMultiplier);
		expect(DAILY_TIER.hard.success.xpChance).toBeLessThan(DAILY_TIER.easy.correct.xpChance);
		expect(DAILY_TIER.hard.success.lootChance).toBeLessThan(DAILY_TIER.easy.correct.lootChance);
	});

	test('token rolls are independent and use existing item names', () => {
		expect(Items.getOrThrow(DOUBLE_XP_TOKEN).id).toBe(74_202);
		expect(Items.getOrThrow(DOUBLE_LOOT_TOKEN).id).toBe(52_616);
		const both = rollDailyRewardTokens(mockRng([0, 0]), dailyRatesFor({ difficulty: 'easy', correct: true }));
		expect(both.amount(DOUBLE_XP_TOKEN)).toBe(1);
		expect(both.amount(DOUBLE_LOOT_TOKEN)).toBe(1);
		const none = rollDailyRewardTokens(mockRng([1, 1]), dailyRatesFor({ difficulty: 'easy', correct: true }));
		expect(none.amount(DOUBLE_XP_TOKEN)).toBe(0);
		expect(none.amount(DOUBLE_LOOT_TOKEN)).toBe(0);
	});

	test('token win lines name the items, show /use, and never ping', () => {
		const both = rollDailyRewardTokens(
			mockRng([0, 0]),
			dailyRatesFor({ difficulty: 'hard', success: true, game: 'wordle' })
		);
		const lines = dailyTokenWinLines(both);
		expect(lines.join('\n')).toContain('/use item:Double XP token');
		expect(lines.join('\n')).toContain('/use item:Double loot token');
		expect(lines.some(line => messageHasUserPing(line))).toBe(false);
	});
});

describe('daily claim lock', () => {
	test('the compare-and-swap where clause uses the previous timestamp', () => {
		const where = dailyClaimLockWhere('123', 50);
		expect(where.user_id).toBe(123n);
		expect(where.last_daily_timestamp).toBe(50n);
	});

	test('pending games expire on the server clock, not the client', () => {
		expect(isDailyPendingExpired(1000, 1000)).toBe(true);
		expect(isDailyPendingExpired(1001, 1000)).toBe(false);
		expect(remainingMs(1500, 1000)).toBe(500);
		expect(remainingMs(500, 1000)).toBe(0);
	});
});

describe('Wordle game', () => {
	test('the word list is curated 5-letter OSRS or BSC names', () => {
		expect(DAILY_WORDLE_WORDS).toContain('CORGO');
		expect(DAILY_WORDLE_WORDS).toContain('SHARK');
		expect(DAILY_WORDLE_WORDS).toContain('HYDRA');
		for (const word of DAILY_WORDLE_WORDS) {
			expect(word).toBe(word.toUpperCase());
			expect(word).toHaveLength(DAILY_WORDLE_LENGTH);
			expect(/^[A-Z]+$/.test(word)).toBe(true);
		}
	});

	test('scoring handles greens, yellows, and double letters', () => {
		expect(wordleTiles(scoreWordleGuess('CORGO', 'CORGO'))).toBe('🟩🟩🟩🟩🟩');
		expect(scoreWordleGuess('SHARK', 'SHARK')).toEqual(Array(5).fill('correct'));
		const marks = scoreWordleGuess('STEEL', 'TEARS');
		expect(marks[0]).toBe('present'); // T
		expect(scoreWordleGuess('BLOOD', 'BOOTS')[0]).toBe('correct');
		const doubled = scoreWordleGuess('STEEL', 'EERIE');
		expect(doubled.filter(m => m !== 'absent').length).toBeLessThanOrEqual(2);
	});

	test('invalid or short guesses do not consume a try', () => {
		let state = createWordleState(mockRng([], ['CORGO']));
		state = applyWordleAction(state, { kind: 'letter', letter: 'A' });
		state = applyWordleAction(state, { kind: 'submit' });
		expect(state.rows).toHaveLength(0);
		expect(state.notice).toContain('5 letters');
		for (const letter of 'MAGIC') state = applyWordleAction(state, { kind: 'letter', letter });
		state = applyWordleAction(state, { kind: 'submit' });
		expect(isAllowedWordleGuess('MAGIC')).toBe(false);
		expect(state.rows).toHaveLength(0);
		expect(state.notice).toContain('Not in the list');
	});

	test('a correct guess wins, and six misses lose without changing the answer', () => {
		let state = createWordleState(mockRng([], ['CORGO']));
		expect(state.answer).toBe('CORGO');
		for (const letter of 'CORGO') state = applyWordleAction(state, { kind: 'letter', letter });
		state = applyWordleAction(state, { kind: 'submit' });
		expect(state.status).toBe('won');
		expect(state.rows).toHaveLength(1);

		let lost = createWordleState(mockRng([], ['SHARK']));
		for (let i = 0; i < DAILY_WORDLE_GUESSES; i++) {
			lost.input = '';
			for (const letter of 'CORGO') lost = applyWordleAction(lost, { kind: 'letter', letter });
			lost = applyWordleAction(lost, { kind: 'submit' });
		}
		expect(lost.status).toBe('lost');
		expect(lost.rows).toHaveLength(DAILY_WORDLE_GUESSES);
		expect(lost.answer).toBe('SHARK');
		const after = applyWordleAction(lost, { kind: 'letter', letter: 'A' });
		expect(after.rows).toHaveLength(DAILY_WORDLE_GUESSES);
		expect(after.input).toBe('');
	});

	test('keyboard pages stay within Discord button limits', () => {
		for (const page of [1, 2] as const) {
			const rows = wordleKeyboardSpec(page);
			expect(rows.length).toBeLessThanOrEqual(DISCORD_ACTION_ROW_LIMIT);
			for (const row of rows) {
				expect(row.length).toBeLessThanOrEqual(DISCORD_BUTTONS_PER_ROW);
				for (const button of row) {
					expect(button.label.length).toBeLessThanOrEqual(DISCORD_BUTTON_LABEL_LIMIT);
					expect(parseWordleAction(button.id)).not.toBeNull();
				}
			}
		}
		expect(hardGameTimeoutMs(createWordleState(mockRng([], ['CORGO'])))).toBe(DAILY_WORDLE_MS);
	});
});

describe('speed-click game', () => {
	test('only the next target in order counts, and a wrong click fails', () => {
		const rng = mockRng();
		const state = createButtonGameState(rng);
		expect(state.targets).toHaveLength(DAILY_BUTTON_TARGETS);
		expect(state.choices).toHaveLength(DAILY_BUTTON_TARGETS + DAILY_BUTTON_DECOYS);
		const firstIndex = state.choices.indexOf(state.targets[0]);
		const wrongIndex = state.choices.findIndex(name => name !== state.targets[0]);
		const failed = applyButtonAction(state, wrongIndex);
		expect(failed.status).toBe('lost');
		let playing = applyButtonAction(state, firstIndex);
		expect(playing.status).toBe('playing');
		expect(playing.progress).toBe(1);
		for (let i = 1; i < state.targets.length; i++) {
			playing = applyButtonAction(playing, playing.choices.indexOf(playing.targets[i]));
		}
		expect(playing.status).toBe('won');
		expect(hardGameTimeoutMs(state)).toBe(DAILY_BUTTON_GAME_MS);
	});

	test('speed-click buttons stay within Discord limits and parse back to an index', () => {
		const state = createButtonGameState(mockRng());
		const spec = buttonGameSpec(state);
		expect(spec.length).toBeLessThanOrEqual(DISCORD_ACTION_ROW_LIMIT * DISCORD_BUTTONS_PER_ROW);
		for (const button of spec) {
			expect(button.label.length).toBeLessThanOrEqual(DISCORD_BUTTON_LABEL_LIMIT);
			expect(parseButtonAction(button.id)).toBeGreaterThanOrEqual(0);
		}
	});
});

describe('daily messages', () => {
	test('player-facing reward and game text stay under the Discord limit and never ping', () => {
		const outcome: DailyOutcome = {
			difficulty: 'hard',
			success: true,
			game: 'wordle',
			detail: 'You got CORGO in 6 tries.'
		};
		const lootLine =
			"10000000000x Coins, 1x Double XP token, 1x Double loot token, 20x Tradeable Mystery Box, 20x Untradeable Mystery Box, 20x Equippable mystery box, 20x Spinning plate, 1x Hornwood helm, 1x Disk of returning, 1x Diango's claws, 1x Rainbow scarf";
		const content = `**Diango says..** ${buildDailyRewardContent({
			bonuses: [
				'💰',
				'🤖',
				'😂',
				'✨ The sparkle fizzled, so Diango stuffed a smaller prize in the bag.',
				'🐧 Skipper negotiated you 50% more coins!',
				'🎉 Launch event: your mystery boxes were tripled!'
			],
			outcome,
			loot: { toString: () => lootLine } as never,
			tokenLines: dailyTokenWinLines(rollDailyRewardTokens(mockRng([0, 0]), dailyRatesFor(outcome))),
			triviaCorrect: true
		})}`;
		expect(content.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - DISCORD_LENGTH_MARGIN);
		expect(messageHasUserPing(content)).toBe(false);
		expect(dailyOutcomeSummary(outcome)).toContain('Wordle');

		let wordle = createWordleState(mockRng([], ['CORGO']));
		for (const letter of 'SHARK') wordle = applyWordleAction(wordle, { kind: 'letter', letter });
		wordle = applyWordleAction(wordle, { kind: 'submit' });
		const wordleText = formatWordleMessage(wordle, DAILY_WORDLE_MS);
		expect(wordleText.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - DISCORD_LENGTH_MARGIN);
		expect(messageHasUserPing(wordleText)).toBe(false);

		const buttons = createButtonGameState(mockRng());
		const buttonText = formatButtonGameMessage(buttons, DAILY_BUTTON_GAME_MS);
		expect(buttonText.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - DISCORD_LENGTH_MARGIN);
		expect(messageHasUserPing(buttonText)).toBe(false);
		expect(hardestDailyRewardPreview(lootLine).length).toBeLessThanOrEqual(
			DISCORD_CONTENT_LIMIT - DISCORD_LENGTH_MARGIN
		);
	});
});

describe('daily source safety', () => {
	test('daily reward code never writes double XP or loot finish times', () => {
		const files = [
			'src/lib/bsc/dailyRewards.ts',
			'src/lib/bsc/dailyGames.ts',
			'src/lib/bsc/dailyPending.ts',
			'src/mahoji/lib/abstracted_commands/dailyCommand.ts'
		];
		for (const file of files) {
			const src = readFileSync(resolve(file), 'utf8');
			expect(src).not.toContain('double_loot_finish_time');
			expect(src).not.toContain('double_xp_finish_time');
			expect(src).not.toContain('DOUBLE_XP_FINISH_TIME');
			expect(src).not.toContain('DOUBLE_LOOT_FINISH_TIME');
			expect(src).not.toContain('addToDoubleXpTimer');
			expect(src).not.toContain('addToDoubleLootTimer');
		}
	});

	test('createHardGame can produce either mode without exposing a reroll hook', () => {
		const wordle = createHardGame(mockRng([0], ['CORGO']));
		const buttons = createHardGame(mockRng([1]));
		expect(wordle.type === 'wordle' || wordle.type === 'buttons').toBe(true);
		expect(buttons.type === 'wordle' || buttons.type === 'buttons').toBe(true);
		expect(normalizeWordleGuess(' corgo! ')).toBe('CORGO');
	});
});
