import '../../src/lib/util/clientSettings.js';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Items } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import {
	applyButtonAction,
	applyTypingGuess,
	applyWordleAction,
	buttonGameRows,
	buttonGameSpec,
	clusterForButtonName,
	createButtonGameState,
	createHardGame,
	createTypingState,
	createWordleState,
	DAILY_BUTTON_DECOYS,
	DAILY_BUTTON_GAME_MS,
	DAILY_BUTTON_TARGETS,
	DAILY_TYPING_MAX_CHARS,
	DAILY_TYPING_MIN_CHARS,
	DAILY_TYPING_MS,
	DAILY_TYPING_PHRASES,
	DAILY_WORDLE_GUESSES,
	DAILY_WORDLE_LENGTH,
	DAILY_WORDLE_MS,
	DAILY_WORDLE_WORDS,
	dailyModalIsValid,
	dailyModalPayload,
	discordButtonRowsAreValid,
	formatButtonGameMessage,
	formatTypingMessage,
	formatWordleMessage,
	HARD_GAME_TYPES,
	hardestDailyRewardPreview,
	hardGameTimeoutMs,
	isAllowedWordleGuess,
	isTypingGuessCorrect,
	isUnstartedTimedDaily,
	normalizeTypingGuess,
	normalizeWordleGuess,
	parseButtonAction,
	renderTypingPromptImage,
	scoreWordleGuess,
	showDailyGameModal,
	typingGameRows,
	typingModalSpec,
	wordleGuessRows,
	wordleModalSpec,
	wordleTiles
} from '@/lib/bsc/dailyGames.js';
import type { DailyPendingRow } from '@/lib/bsc/dailyPending.js';
import {
	isDailyHardGameButtonId,
	isDailyPendingExpired,
	remainingMs,
	shouldExemptDailyGameButtonFromGlobalRatelimit
} from '@/lib/bsc/dailyPending.js';
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
import {
	DAILY_EASY_TRIVIA,
	DAILY_MEDIUM_TRIVIA,
	isDailyTriviaAnswerCorrect,
	pickDailyTrivia
} from '@/lib/bsc/dailyTrivia.js';
import { DAILY_BONUS_COINS, DAILY_GUARANTEED_COINS } from '@/lib/simulation/dailyTable.js';

const DISCORD_CONTENT_LIMIT = 2000;
const DISCORD_LENGTH_MARGIN = 150;
const DISCORD_BUTTON_LABEL_LIMIT = 80;
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
		expect(dailyRatesFor({ difficulty: 'medium', success: true, game: 'buttons' })).toEqual(
			DAILY_TIER.medium.success
		);
		expect(dailyRatesFor({ difficulty: 'medium', success: false, game: 'buttons' })).toEqual(
			DAILY_TIER.easy.correct
		);
		expect(dailyRatesFor({ difficulty: 'hard', success: true, game: 'wordle' })).toEqual(DAILY_TIER.hard.success);
		expect(dailyRatesFor({ difficulty: 'hard', success: false, game: 'typing' })).toEqual(DAILY_TIER.hard.fail);
		expect(DAILY_TIER.medium.success.coinMultiplier).toBe(2);
		expect(DAILY_TIER.medium.fail).toEqual(DAILY_TIER.easy.correct);
		expect(DAILY_TIER.hard.success.coinMultiplier).toBeGreaterThan(DAILY_TIER.medium.success.coinMultiplier);
		expect(DAILY_TIER.medium.success.coinMultiplier).toBeGreaterThan(DAILY_TIER.easy.correct.coinMultiplier);
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
	const commonEnglish = [
		'SHARK',
		'TROUT',
		'DEMON',
		'QUEST',
		'CLOAK',
		'BOOTS',
		'ARROW',
		'DEATH',
		'BLOOD',
		'STEEL',
		'CHAOS',
		'SMOKE',
		'GIANT',
		'TROLL',
		'SEEDS',
		'BLADE',
		'TEARS',
		'PATCH',
		'BONES',
		'STAFF',
		'KNIFE',
		'SPEAR'
	];

	test('the word list is 5-letter OSRS or BSC names, not common English', () => {
		expect(DAILY_WORDLE_WORDS).toContain('CORGO');
		expect(DAILY_WORDLE_WORDS).toContain('HYDRA');
		expect(DAILY_WORDLE_WORDS).toContain('AHRIM');
		expect(DAILY_WORDLE_GUESSES).toBe(4);
		expect(DAILY_WORDLE_MS).toBe(90_000);
		for (const word of commonEnglish) {
			expect(DAILY_WORDLE_WORDS).not.toContain(word);
		}
		for (const word of DAILY_WORDLE_WORDS) {
			expect(word).toBe(word.toUpperCase());
			expect(word).toHaveLength(DAILY_WORDLE_LENGTH);
			expect(/^[A-Z]+$/.test(word)).toBe(true);
		}
	});

	test('scoring handles greens, yellows, and double letters', () => {
		expect(wordleTiles(scoreWordleGuess('CORGO', 'CORGO'))).toBe('🟩🟩🟩🟩🟩');
		expect(scoreWordleGuess('HYDRA', 'HYDRA')).toEqual(Array(5).fill('correct'));
		expect(scoreWordleGuess('AHRIM', 'AKKHA')[0]).toBe('correct');
		expect(scoreWordleGuess('AHRIM', 'AKKHA')[4]).toBe('absent');
		const marks = scoreWordleGuess('TORAG', 'AHRIM');
		expect(marks.some(mark => mark !== 'absent')).toBe(true);
	});

	test('typed guesses are required, and invalid or short guesses do not consume a try', () => {
		let state = createWordleState(mockRng([], ['CORGO']));
		state = applyWordleAction(state, { kind: 'submit', guess: 'A' });
		expect(state.rows).toHaveLength(0);
		expect(state.notice).toContain('5 letters');
		state = applyWordleAction(state, { kind: 'submit', guess: 'MAGIC' });
		expect(isAllowedWordleGuess('MAGIC')).toBe(false);
		expect(state.rows).toHaveLength(0);
		expect(state.notice).toContain('Not in the list');
	});

	test('a correct typed guess wins, and four misses lose without changing the answer', () => {
		let state = createWordleState(mockRng([], ['CORGO']));
		expect(state.answer).toBe('CORGO');
		state = applyWordleAction(state, { kind: 'submit', guess: 'corgo' });
		expect(state.status).toBe('won');
		expect(state.rows).toHaveLength(1);

		let lost = createWordleState(mockRng([], ['HYDRA']));
		for (let i = 0; i < DAILY_WORDLE_GUESSES; i++) {
			lost = applyWordleAction(lost, { kind: 'submit', guess: 'CORGO' });
		}
		expect(lost.status).toBe('lost');
		expect(lost.rows).toHaveLength(DAILY_WORDLE_GUESSES);
		expect(lost.answer).toBe('HYDRA');
		const after = applyWordleAction(lost, { kind: 'submit', guess: 'HYDRA' });
		expect(after.rows).toHaveLength(DAILY_WORDLE_GUESSES);
	});

	test('Wordle uses a single Guess button and stays within Discord limits', () => {
		const rows = wordleGuessRows();
		expect(discordButtonRowsAreValid(rows)).toBe(true);
		expect(rows).toEqual([[{ id: 'dlyw:GO', label: 'Guess' }]]);
		expect(hardGameTimeoutMs(createWordleState(mockRng([], ['CORGO'])))).toBe(DAILY_WORDLE_MS);
		const text = formatWordleMessage(createWordleState(mockRng([], ['CORGO'])), DAILY_WORDLE_MS);
		expect(text).toContain('4 tries');
		expect(text).toContain('type your answer');
		expect(text).not.toContain('6 tries');
	});
});

describe('speed-click game', () => {
	test('Medium speed click is 5 names in 10 seconds, and a decoy click fails', () => {
		const state = createButtonGameState(mockRng());
		expect(state.targets).toHaveLength(DAILY_BUTTON_TARGETS);
		expect(state.choices).toHaveLength(DAILY_BUTTON_TARGETS + DAILY_BUTTON_DECOYS);
		expect(DAILY_BUTTON_GAME_MS).toBe(10_000);
		for (const decoy of state.choices.filter(name => !state.targets.includes(name))) {
			const cluster = clusterForButtonName(decoy);
			expect(cluster).toBeTruthy();
			expect(state.targets.some(target => cluster?.includes(target))).toBe(true);
		}
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

	test('buttons are split into Discord rows of at most 5 and parse back to an index', () => {
		const state = createButtonGameState(mockRng());
		const rows = buttonGameRows(state);
		expect(discordButtonRowsAreValid(rows)).toBe(true);
		expect(rows.every(row => row.length <= DISCORD_BUTTONS_PER_ROW)).toBe(true);
		expect(rows.flat()).toHaveLength(DAILY_BUTTON_TARGETS + DAILY_BUTTON_DECOYS);
		for (const button of buttonGameSpec(state)) {
			expect(button.label.length).toBeLessThanOrEqual(DISCORD_BUTTON_LABEL_LIMIT);
			expect(parseButtonAction(button.id)).toBeGreaterThanOrEqual(0);
		}
		const message = formatButtonGameMessage(state, DAILY_BUTTON_GAME_MS);
		expect(message).toContain('Medium daily: Speed click');
		expect(message).not.toContain('Hard daily: Speed click');
	});
});

describe('typing challenge', () => {
	test('the phrase list is medium-length OSRS or BSC names', () => {
		expect(DAILY_TYPING_MS).toBe(20_000);
		expect(DAILY_TYPING_PHRASES).toContain('Abyssal whip');
		expect(DAILY_TYPING_PHRASES).toContain('Bountiful cornucopia');
		for (const phrase of DAILY_TYPING_PHRASES) {
			expect(phrase.length).toBeGreaterThanOrEqual(DAILY_TYPING_MIN_CHARS);
			expect(phrase.length).toBeLessThanOrEqual(DAILY_TYPING_MAX_CHARS);
		}
	});

	test('the typed answer is case-insensitive and trimmed, and a typo fails', () => {
		const state = createTypingState(mockRng([], ['Abyssal whip']));
		expect(state.phrase).toBe('Abyssal whip');
		expect(isTypingGuessCorrect(state.phrase, '  ABYSSAL   WHIP  ')).toBe(true);
		expect(normalizeTypingGuess('  ABYSSAL   WHIP  ')).toBe('abyssal whip');
		expect(applyTypingGuess(state, 'abyssal whip').status).toBe('won');
		expect(applyTypingGuess(state, 'Abyssal dagger').status).toBe('lost');
		expect(hardGameTimeoutMs(state)).toBe(DAILY_TYPING_MS);
	});

	test('the Type it button is valid, and the prompt image does not include copyable text', async () => {
		const rows = typingGameRows();
		expect(discordButtonRowsAreValid(rows)).toBe(true);
		expect(rows).toEqual([[{ id: 'dlyt:GO', label: 'Type it' }]]);
		const hidden = formatTypingMessage(createTypingState(mockRng([], ['Abyssal whip'])), DAILY_TYPING_MS);
		expect(hidden).toContain('shown in the image');
		expect(hidden).not.toContain('Abyssal whip');
		expect(hidden.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - DISCORD_LENGTH_MARGIN);
		const image = await renderTypingPromptImage('Abyssal whip');
		expect(image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
		expect(image.toString('utf8')).not.toContain('Abyssal whip');
	});
});

describe('daily messages', () => {
	test('player-facing reward and game text stay under the Discord limit and never ping', () => {
		const outcome: DailyOutcome = {
			difficulty: 'hard',
			success: true,
			game: 'wordle',
			detail: 'You got CORGO in 4 tries.'
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

		const wordle = applyWordleAction(createWordleState(mockRng([], ['CORGO'])), {
			kind: 'submit',
			guess: 'HYDRA'
		});
		const wordleText = formatWordleMessage(wordle, DAILY_WORDLE_MS);
		expect(wordleText.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - DISCORD_LENGTH_MARGIN);
		expect(messageHasUserPing(wordleText)).toBe(false);

		const buttons = createButtonGameState(mockRng());
		const buttonText = formatButtonGameMessage(buttons, DAILY_BUTTON_GAME_MS);
		expect(buttonText.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - DISCORD_LENGTH_MARGIN);
		expect(messageHasUserPing(buttonText)).toBe(false);

		const typingText = formatTypingMessage(createTypingState(mockRng()), DAILY_TYPING_MS);
		expect(typingText.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - DISCORD_LENGTH_MARGIN);
		expect(messageHasUserPing(typingText)).toBe(false);
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

	test('createHardGame picks Wordle or typing, never speed click', () => {
		expect([...HARD_GAME_TYPES]).toEqual(['wordle', 'typing']);
		const wordle = createHardGame(mockRng([], ['wordle', 'CORGO']));
		const typing = createHardGame(mockRng([], ['typing', 'Abyssal whip']));
		expect(wordle.type).toBe('wordle');
		expect(typing.type).toBe('typing');
		expect(createHardGame(mockRng([], ['buttons', 'wordle', 'CORGO'])).type).not.toBe('buttons');
		expect(normalizeWordleGuess(' corgo! ')).toBe('CORGO');
	});
});

describe('daily trivia difficulty', () => {
	test('Easy and Medium use OSRS questions, not the test-bot 1+1 shortcuts', () => {
		expect(DAILY_EASY_TRIVIA.some(q => q.question.includes('1+1') || q.question.includes('2+2'))).toBe(false);
		expect(DAILY_MEDIUM_TRIVIA.some(q => q.question.includes('1+1') || q.question.includes('2+2'))).toBe(false);
		expect(DAILY_EASY_TRIVIA.some(q => q.question.includes('Fight Caves'))).toBe(true);
		expect(DAILY_MEDIUM_TRIVIA.some(q => q.question.includes('Abyssal demons'))).toBe(true);
		const easy = pickDailyTrivia(mockRng(), 'easy', 1);
		expect(easy[0].question).not.toBe('What is 1+1?');
		expect(isDailyTriviaAnswerCorrect(easy[0], easy[0].answers[0])).toBe(true);
	});

	test('every question has short multiple-choice answers and one correct choice', () => {
		for (const question of [...DAILY_EASY_TRIVIA, ...DAILY_MEDIUM_TRIVIA]) {
			expect(question.choices.length).toBeGreaterThanOrEqual(2);
			expect(question.choices.some(choice => question.answers.includes(choice))).toBe(true);
			expect(question.question.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - DISCORD_LENGTH_MARGIN);
			for (const choice of question.choices) {
				expect(choice.length).toBeLessThanOrEqual(DISCORD_BUTTON_LABEL_LIMIT);
			}
		}
	});
});

describe('reward copy', () => {
	test('hard fail does not use trivia incorrect text, and bonuses sit on their own line', () => {
		const content = buildDailyRewardContent({
			bonuses: ['Skipper negotiated you 50% more coins!'],
			outcome: { difficulty: 'hard', success: false, game: 'typing', detail: 'You ran out of time.' },
			loot: { toString: () => '6.8m Coins, 1x Tradeable Mystery Box' } as never,
			tokenLines: []
		});
		expect(content).not.toContain("That's incorrect");
		expect(content).not.toContain('Even though you got it wrong');
		expect(content.includes('Skipper negotiated you 50% more coins!\n**Hard daily')).toBe(true);
		expect(content).toContain('You ran out of time.');
		expect(content).toContain('smaller reward');
		expect(messageHasUserPing(content)).toBe(false);
		expect(content.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - DISCORD_LENGTH_MARGIN);
	});

	test('medium fail pays the Easy-level reward text', () => {
		const content = buildDailyRewardContent({
			bonuses: [],
			outcome: { difficulty: 'medium', success: false, game: 'buttons', detail: 'Wrong button.' },
			loot: { toString: () => '6.8m Coins' } as never,
			tokenLines: []
		});
		expect(content).toContain('Medium daily: Speed click failed');
		expect(content).toContain('Easy-level reward');
		expect(content).not.toContain("That's incorrect");
	});
});

describe('daily button ratelimit exemption', () => {
	const now = 1_700_000_000_000;
	const owner = 'owner-1';

	function pending(overrides: Partial<DailyPendingRow> = {}): DailyPendingRow {
		return {
			userId: owner,
			claimedAt: now - 1000,
			difficulty: 'hard',
			game: overrides.game ?? createWordleState(mockRng()),
			expiresAt: now + 15_000,
			paid: false,
			...overrides
		};
	}

	test('owner clicks on an active Wordle, typing, or Medium speed-click game are exempt', () => {
		const wordle = pending({ game: createWordleState(mockRng()) });
		const typing = pending({ game: createTypingState(mockRng()) });
		const buttons = pending({ difficulty: 'medium', game: createButtonGameState(mockRng()) });
		expect(
			shouldExemptDailyGameButtonFromGlobalRatelimit({
				customId: 'dlyw:GO',
				userId: owner,
				pending: wordle,
				now
			})
		).toBe(true);
		expect(
			shouldExemptDailyGameButtonFromGlobalRatelimit({
				customId: 'dlyt:GO',
				userId: owner,
				pending: typing,
				now
			})
		).toBe(true);
		expect(
			shouldExemptDailyGameButtonFromGlobalRatelimit({
				customId: 'dlyb:0',
				userId: owner,
				pending: buttons,
				now
			})
		).toBe(true);
	});

	test('does not exempt other buttons, other users, or a game that is no longer active', () => {
		const active = pending();
		const cases = [
			{ customId: 'REPEATTRIP', userId: owner, pending: active, now },
			{ customId: 'dlyw:GO', userId: 'someone-else', pending: active, now },
			{ customId: 'dlyw:GO', userId: owner, pending: null, now },
			{ customId: 'dlyw:GO', userId: owner, pending: pending({ paid: true }), now },
			{ customId: 'dlyw:GO', userId: owner, pending: pending({ expiresAt: now }), now },
			{
				customId: 'dlyw:GO',
				userId: owner,
				pending: pending({ game: { ...createWordleState(mockRng()), status: 'lost' as const } }),
				now
			},
			{ customId: 'dlyb:0', userId: owner, pending: active, now },
			{ customId: 'dlyt:GO', userId: owner, pending: active, now }
		];
		for (const opts of cases) {
			expect(shouldExemptDailyGameButtonFromGlobalRatelimit(opts)).toBe(false);
		}
		expect(isDailyHardGameButtonId('REPEATTRIP')).toBe(false);
		expect(isDailyHardGameButtonId('dlyt:GO')).toBe(true);
	});

	test('the global button handler skips the ratelimit only through this exemption', () => {
		const src = readFileSync(resolve('src/lib/util/globalInteractions.ts'), 'utf8');
		const exempt = src.indexOf('if (await shouldExemptUserDailyGameButton(interaction.userId, id)) return;');
		const handle = src.indexOf(
			'const response = await globalButtonInteractionHandler({ interaction, id, rng: cryptoRng })'
		);
		expect(exempt).toBeGreaterThan(-1);
		expect(handle).toBeGreaterThan(exempt);
	});
});

describe('hard daily modals', () => {
	test('Wordle and typing modal specs stay within Discord limits', () => {
		for (const modal of [wordleModalSpec(), typingModalSpec()]) {
			expect(dailyModalIsValid(modal)).toBe(true);
			const payload = dailyModalPayload(modal);
			expect(payload.custom_id.length).toBeLessThanOrEqual(100);
			expect(payload.title.length).toBeLessThanOrEqual(45);
			expect(payload.components).toHaveLength(1);
			expect(payload.components[0].components).toHaveLength(1);
			const input = payload.components[0].components[0];
			expect(input.custom_id.length).toBeLessThanOrEqual(100);
			expect(input.label.length).toBeLessThanOrEqual(45);
		}
	});

	test('showDailyGameModal posts a modal callback and does not use interaction.showModal', async () => {
		const posted: unknown[] = [];
		const rest = {
			post: async (route: string, options: unknown) => {
				posted.push({ route, options });
			}
		};
		const interaction = { id: 'itx-1', rawInteraction: { token: 'tok-1' }, showModal: undefined };
		await showDailyGameModal(rest, interaction, wordleModalSpec());
		expect(posted).toHaveLength(1);
		const body = (posted[0] as { options: { body: { type: number; data: { title: string } } } }).options.body;
		expect(body.type).toBe(9);
		expect(body.data.title).toBe('Hard daily: Wordle');
		expect(interaction.showModal).toBeUndefined();
		const src = readFileSync(resolve('src/mahoji/lib/abstracted_commands/dailyCommand.ts'), 'utf8');
		expect(src).toContain('showDailyGameModal(');
		expect(src).not.toContain('button.showModal');
	});

	test('a modal that never opens on a fresh Hard game is treated as unstarted so it can be refunded', () => {
		const wordle = createWordleState(mockRng([], ['CORGO']));
		expect(isUnstartedTimedDaily(wordle)).toBe(true);
		expect(isUnstartedTimedDaily(applyWordleAction(wordle, { kind: 'submit', guess: 'HYDRA' }))).toBe(false);
		expect(isUnstartedTimedDaily(createTypingState(mockRng()))).toBe(true);
		expect(isUnstartedTimedDaily(applyTypingGuess(createTypingState(mockRng()), 'nope'))).toBe(false);
	});
});
