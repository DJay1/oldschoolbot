import { ComponentType } from '@oldschoolgg/discord';

import { createCanvas } from '@/lib/canvas/canvasUtil.js';
import '@/lib/canvas/OSRSCanvas.js';

export const DAILY_WORDLE_LENGTH = 5;
export const DAILY_WORDLE_GUESSES = 4;
export const DAILY_WORDLE_MS = 90 * 1000;
export const DAILY_BUTTON_GAME_MS = 10 * 1000;
export const DAILY_BUTTON_TARGETS = 5;
export const DAILY_BUTTON_DECOYS = 5;
export const DAILY_TYPING_MS = 20 * 1000;
export const DAILY_TYPING_MIN_CHARS = 11;
export const DAILY_TYPING_MAX_CHARS = 24;
export const DAILY_WORDLE_BUTTON_PREFIX = 'dlyw:';
export const DAILY_SPEED_CLICK_BUTTON_PREFIX = 'dlyb:';
export const DAILY_TYPING_BUTTON_PREFIX = 'dlyt:';
export const DAILY_WORDLE_GUESS_BUTTON_ID = 'dlyw:GO';
export const DAILY_WORDLE_MODAL_ID = 'dlyw:MODAL';
export const DAILY_WORDLE_MODAL_INPUT_ID = 'dlyw:TEXT';
export const DAILY_TYPING_BUTTON_ID = 'dlyt:GO';
export const DAILY_TYPING_MODAL_ID = 'dlyt:MODAL';
export const DAILY_TYPING_MODAL_INPUT_ID = 'dlyt:TEXT';
export const HARD_GAME_TYPES = ['wordle', 'typing'] as const;

/**
 * Distinctly OSRS or BSC 5-letter names. No common English words like SHARK or DEATH.
 * Used as both answers and the allowed guess list.
 */
export const DAILY_WORDLE_WORDS = [
	'AHRIM',
	'KARIL',
	'TORAG',
	'VERAC',
	'HYDRA',
	'ABYSS',
	'HASTA',
	'KERIS',
	'TORVA',
	'ZAROS',
	'SEREN',
	'XERIC',
	'NIEVE',
	'KONAR',
	'ANKOU',
	'JOGRE',
	'MOGRE',
	'KYATT',
	'VORKI',
	'IKKLE',
	'ARTIO',
	'RALOS',
	'AKKHA',
	'ZEBAK',
	'NYLOC',
	'NIHIL',
	'CORGO',
	'CHINS',
	'AKUMU',
	'ARRAV'
] as const;

const WORDLE_WORD_SET = new Set<string>(DAILY_WORDLE_WORDS);

/** Clusters of similar-looking OSRS names. Decoys are taken from the same cluster as a target. */
export const DAILY_BUTTON_CLUSTERS: readonly (readonly string[])[] = [
	['Zulrah', 'Zulrah scale', 'Zulrah fang'],
	['Vorkath', "Vorkath's head", 'Vorki'],
	['Hydra', 'Alchemical Hydra', 'Ikkle hydra'],
	['Kraken', 'Cave kraken', 'Kraken tentacle'],
	['Abyssal whip', 'Abyssal dagger', 'Abyssal bludgeon'],
	['Dragon claws', 'Dragon scimitar', 'Dragon warhammer'],
	['Twisted bow', 'Twisted buckler', 'Twisted bow (i)'],
	['Fire cape', 'Infernal cape', 'Fire max cape'],
	['Rune scimitar', 'Rune sword', 'Rune 2h sword'],
	['Armadyl godsword', 'Armadyl chestplate', 'Armadyl crossbow'],
	['Bandos chestplate', 'Bandos tassets', 'Bandos godsword'],
	['Saradomin brew', 'Saradomin godsword', 'Saradomin sword'],
	['Zamorakian hasta', 'Zamorak godsword', 'Zamorak brew'],
	['Shark', 'Cooked shark', 'Dark crab'],
	['Skipper', 'Shelldon', 'Laboon']
];

/** Medium-length OSRS or BSC item and activity names to type exactly. */
export const DAILY_TYPING_PHRASES = [
	'Abyssal whip',
	'Twisted bow',
	'Dragon warhammer',
	'Scythe of vitur',
	"Tumeken's shadow",
	'Sanguinesti staff',
	'Ghrazi rapier',
	'Avernic defender',
	'Infernal cape',
	'Barrows gloves',
	'Dragon hunter lance',
	'Alchemical hydra',
	'Chambers of Xeric',
	'Theatre of Blood',
	'Tombs of Amascut',
	'Bountiful cornucopia',
	'Tradeable Mystery Box',
	'Abyssal bludgeon',
	'Heavy ballista',
	'Armadyl godsword',
	'Bandos chestplate',
	'Ancestral robe top',
	"Osmumten's fang",
	'Zaryte crossbow',
	'Pegasian boots',
	'Primordial boots'
] as const;

export type WordleMark = 'correct' | 'present' | 'absent';

export interface WordleRow {
	guess: string;
	marks: WordleMark[];
}

export interface WordleState {
	type: 'wordle';
	answer: string;
	rows: WordleRow[];
	status: 'playing' | 'won' | 'lost';
	notice?: string;
}

export interface ButtonGameState {
	type: 'buttons';
	targets: string[];
	choices: string[];
	progress: number;
	status: 'playing' | 'won' | 'lost';
	notice?: string;
}

export interface TypingGameState {
	type: 'typing';
	phrase: string;
	status: 'playing' | 'won' | 'lost';
	notice?: string;
}

export type HardGameState = WordleState | ButtonGameState | TypingGameState;
export type HardGameType = HardGameState['type'];

export function normalizeWordleGuess(raw: string): string {
	return raw.replace(/[^a-zA-Z]/g, '').toUpperCase();
}

export function isAllowedWordleGuess(guess: string): boolean {
	return guess.length === DAILY_WORDLE_LENGTH && WORDLE_WORD_SET.has(guess);
}

export function scoreWordleGuess(answer: string, guess: string): WordleMark[] {
	const ans = answer.split('');
	const letters = guess.split('');
	const marks: WordleMark[] = Array(DAILY_WORDLE_LENGTH).fill('absent');
	const used = Array(DAILY_WORDLE_LENGTH).fill(false);
	for (let i = 0; i < DAILY_WORDLE_LENGTH; i++) {
		if (letters[i] === ans[i]) {
			marks[i] = 'correct';
			used[i] = true;
		}
	}
	for (let i = 0; i < DAILY_WORDLE_LENGTH; i++) {
		if (marks[i] === 'correct') continue;
		const idx = ans.findIndex((ch, j) => !used[j] && ch === letters[i]);
		if (idx !== -1) {
			marks[i] = 'present';
			used[idx] = true;
		}
	}
	return marks;
}

export function wordleTiles(marks: WordleMark[]): string {
	return marks.map(m => (m === 'correct' ? '🟩' : m === 'present' ? '🟨' : '⬛')).join('');
}

export function createWordleState(rng: RNGProvider): WordleState {
	return {
		type: 'wordle',
		answer: rng.pick(DAILY_WORDLE_WORDS as unknown as string[]),
		rows: [],
		status: 'playing'
	};
}

export type WordleAction = { kind: 'submit'; guess: string };

export function parseWordleAction(customId: string): WordleAction | null {
	return customId === DAILY_WORDLE_GUESS_BUTTON_ID || customId === DAILY_WORDLE_MODAL_ID
		? { kind: 'submit', guess: '' }
		: null;
}

export function applyWordleAction(state: WordleState, action: WordleAction): WordleState {
	if (state.status !== 'playing') return state;
	const next: WordleState = { ...state, rows: [...state.rows], notice: undefined };
	const guess = normalizeWordleGuess(action.guess);
	if (guess.length !== DAILY_WORDLE_LENGTH) {
		next.notice = 'Type all 5 letters, then press Guess.';
		return next;
	}
	if (!isAllowedWordleGuess(guess)) {
		next.notice = 'Not in the list. Try a 5-letter OSRS name.';
		return next;
	}
	const marks = scoreWordleGuess(next.answer, guess);
	next.rows.push({ guess, marks });
	if (guess === next.answer) {
		next.status = 'won';
		next.notice = `You got ${next.answer} in ${next.rows.length} ${next.rows.length === 1 ? 'try' : 'tries'}.`;
		return next;
	}
	if (next.rows.length >= DAILY_WORDLE_GUESSES) {
		next.status = 'lost';
		next.notice = `Out of tries. The word was ${next.answer}.`;
		return next;
	}
	return next;
}

export function wordleGuessRows(): { id: string; label: string }[][] {
	return [[{ id: DAILY_WORDLE_GUESS_BUTTON_ID, label: 'Guess' }]];
}

export function formatWordleMessage(state: WordleState, remainingMs: number): string {
	const lines = [
		'**Hard daily: Wordle**',
		`Guess the 5-letter OSRS name in ${DAILY_WORDLE_GUESSES} tries. Press Guess and type your answer.`
	];
	if (state.status === 'playing') {
		lines.push(`Time left: ${formatSeconds(remainingMs)}`);
	}
	const blanks = '⬜'.repeat(DAILY_WORDLE_LENGTH);
	if (state.rows.length === 0 && state.status === 'playing') {
		lines.push(blanks);
	}
	for (const row of state.rows) {
		lines.push(`${wordleTiles(row.marks)}  ${row.guess}`);
	}
	if (state.notice) lines.push(state.notice);
	return lines.join('\n');
}

export function clusterForButtonName(name: string): readonly string[] | undefined {
	return DAILY_BUTTON_CLUSTERS.find(cluster => cluster.includes(name));
}

export function createButtonGameState(rng: RNGProvider): ButtonGameState {
	const clusters = rng.shuffle(DAILY_BUTTON_CLUSTERS.map(cluster => [...cluster]));
	const picked = clusters.slice(0, DAILY_BUTTON_TARGETS);
	const targets: string[] = [];
	const decoys: string[] = [];
	for (const cluster of picked) {
		const names = rng.shuffle(cluster);
		targets.push(names[0]);
		for (const name of names.slice(1)) {
			if (!targets.includes(name) && !decoys.includes(name)) decoys.push(name);
		}
	}
	return {
		type: 'buttons',
		targets,
		choices: rng.shuffle([...targets, ...decoys.slice(0, DAILY_BUTTON_DECOYS)]),
		progress: 0,
		status: 'playing'
	};
}

export function parseButtonAction(customId: string): number | null {
	if (!customId.startsWith(DAILY_SPEED_CLICK_BUTTON_PREFIX)) return null;
	const index = Number(customId.slice(DAILY_SPEED_CLICK_BUTTON_PREFIX.length));
	return Number.isInteger(index) && index >= 0 ? index : null;
}

export function applyButtonAction(state: ButtonGameState, index: number): ButtonGameState {
	if (state.status !== 'playing') return state;
	const next: ButtonGameState = { ...state, notice: undefined };
	const picked = next.choices[index];
	if (!picked) {
		next.status = 'lost';
		next.notice = 'That button is not part of this game.';
		return next;
	}
	if (picked !== next.targets[next.progress]) {
		next.status = 'lost';
		next.notice = 'Wrong button.';
		return next;
	}
	next.progress += 1;
	if (next.progress >= next.targets.length) {
		next.status = 'won';
		next.notice = 'You hit every button in time.';
	}
	return next;
}

export function buttonGameSpec(state: ButtonGameState): { id: string; label: string }[] {
	return state.choices.map((name, index) => ({ id: `dlyb:${index}`, label: name }));
}

export const DISCORD_BUTTONS_PER_ROW = 5;
export const DISCORD_ACTION_ROW_LIMIT = 5;
export const DISCORD_BUTTON_LABEL_LIMIT = 80;

export function chunkIntoRows<T>(items: readonly T[], size = DISCORD_BUTTONS_PER_ROW): T[][] {
	const rows: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		rows.push([...items.slice(i, i + size)]);
	}
	return rows;
}

export function buttonGameRows(state: ButtonGameState): { id: string; label: string }[][] {
	return chunkIntoRows(buttonGameSpec(state));
}

export function discordButtonRowsAreValid(rows: { id: string; label: string }[][]): boolean {
	if (rows.length > DISCORD_ACTION_ROW_LIMIT) return false;
	for (const row of rows) {
		if (row.length === 0 || row.length > DISCORD_BUTTONS_PER_ROW) return false;
		if (row.some(button => button.label.length === 0 || button.label.length > DISCORD_BUTTON_LABEL_LIMIT)) {
			return false;
		}
	}
	return true;
}

export function formatButtonGameMessage(state: ButtonGameState, remainingMs: number): string {
	const path = state.targets.map((name, i) => (i < state.progress ? `${name} ✓` : name)).join(' → ');
	const lines = ['**Medium daily: Speed click**', `Click these in order: **${path}**`];
	if (state.status === 'playing') {
		lines.push(`Time left: ${formatSeconds(remainingMs)}`);
	}
	if (state.notice) lines.push(state.notice);
	return lines.join('\n');
}

export function normalizeTypingGuess(raw: string): string {
	return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function isTypingGuessCorrect(phrase: string, raw: string): boolean {
	return normalizeTypingGuess(raw) === normalizeTypingGuess(phrase);
}

export function createTypingState(rng: RNGProvider): TypingGameState {
	return {
		type: 'typing',
		phrase: rng.pick(DAILY_TYPING_PHRASES as unknown as string[]),
		status: 'playing'
	};
}

export function applyTypingGuess(state: TypingGameState, raw: string): TypingGameState {
	if (state.status !== 'playing') return state;
	if (isTypingGuessCorrect(state.phrase, raw)) {
		return { ...state, status: 'won', notice: 'You typed it in time.' };
	}
	return { ...state, status: 'lost', notice: 'That was not the right name.' };
}

export function typingGameRows(): { id: string; label: string }[][] {
	return [[{ id: DAILY_TYPING_BUTTON_ID, label: 'Type it' }]];
}

export function formatTypingMessage(
	state: TypingGameState,
	remainingMs: number,
	opts: { revealText?: boolean } = {}
): string {
	const lines = [
		'**Hard daily: Typing**',
		opts.revealText
			? `Type this OSRS name exactly: **${state.phrase}**`
			: 'Type the OSRS name shown in the image. Press Type it and enter it exactly.'
	];
	if (state.status === 'playing') {
		lines.push(`Time left: ${formatSeconds(remainingMs)}`);
	}
	if (state.notice) lines.push(state.notice);
	return lines.join('\n');
}

export async function renderTypingPromptImage(phrase: string): Promise<Buffer> {
	const font = '32px RuneScape Bold 12';
	const probe = createCanvas(10, 10);
	const pctx = probe.getContext('2d');
	pctx.font = font;
	const textWidth = pctx.measureText(phrase).width;
	const width = Math.max(Math.ceil(textWidth) + 56, 240);
	const height = 80;
	const canvas = createCanvas(width, height);
	const ctx = canvas.getContext('2d');
	ctx.fillStyle = '#3e3229';
	ctx.fillRect(0, 0, width, height);
	ctx.strokeStyle = '#2a2118';
	ctx.lineWidth = 4;
	ctx.strokeRect(2, 2, width - 4, height - 4);
	ctx.font = font;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = '#000000';
	ctx.fillText(phrase, width / 2 + 2, height / 2 + 2);
	ctx.fillStyle = '#FF981F';
	ctx.fillText(phrase, width / 2, height / 2);
	return Buffer.from(await canvas.png);
}

export function wordleModalSpec() {
	return {
		customId: DAILY_WORDLE_MODAL_ID,
		title: 'Hard daily: Wordle',
		textInput: {
			customId: DAILY_WORDLE_MODAL_INPUT_ID,
			label: '5-letter OSRS name',
			placeholder: 'Type your guess',
			minLength: 5,
			maxLength: 5
		}
	};
}

export function typingModalSpec() {
	return {
		customId: DAILY_TYPING_MODAL_ID,
		title: 'Hard daily: Typing',
		textInput: {
			customId: DAILY_TYPING_MODAL_INPUT_ID,
			label: 'Type the name exactly',
			placeholder: 'Type what you see',
			minLength: 1,
			maxLength: 80
		}
	};
}

export function extractModalText(itx: {
	data?: { components?: readonly { components?: readonly { type: number; value?: string }[] }[] };
}): string {
	for (const row of itx.data?.components ?? []) {
		for (const comp of row.components ?? []) {
			if (comp.type === ComponentType.TextInput && typeof comp.value === 'string') {
				return comp.value;
			}
		}
	}
	return '';
}

export function isDailyWordleGuessButton(customId: string): boolean {
	return customId === DAILY_WORDLE_GUESS_BUTTON_ID;
}

export function isDailyTypingButton(customId: string): boolean {
	return customId === DAILY_TYPING_BUTTON_ID;
}

export function isDailyHardModalId(customId: string): boolean {
	return customId === DAILY_WORDLE_MODAL_ID || customId === DAILY_TYPING_MODAL_ID;
}

export function createHardGame(rng: RNGProvider): HardGameState {
	const type = rng.pick(HARD_GAME_TYPES as unknown as string[]);
	return type === 'wordle' ? createWordleState(rng) : createTypingState(rng);
}

export function hardGameTimeoutMs(state: HardGameState): number {
	if (state.type === 'wordle') return DAILY_WORDLE_MS;
	if (state.type === 'buttons') return DAILY_BUTTON_GAME_MS;
	return DAILY_TYPING_MS;
}

export function formatSeconds(ms: number): string {
	const total = Math.max(0, Math.ceil(ms / 1000));
	const minutes = Math.floor(total / 60);
	const seconds = total % 60;
	if (minutes <= 0) return `${seconds}s`;
	return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

export function hardestDailyRewardPreview(maxLootLine: string): string {
	const tokenLines = [
		'**Double XP token!** Use it with `/use item:Double XP token`.',
		'**Double loot token!** Use it with `/use item:Double loot token`.'
	];
	const bonuses = [
		'💰',
		'🤖',
		'😂',
		'✨ The sparkle fizzled, so Diango stuffed a smaller prize in the bag.',
		'🐧 Skipper negotiated you 50% more coins!',
		'🎉 Launch event: your mystery boxes were tripled!'
	];
	return `${tokenLines.join('\n')}\n${bonuses.join('')}**Hard daily: Wordle — You got CORGO in 4 tries.**\nThat's correct! I've picked you some random items as a reward...\n\nYou received ${maxLootLine}`;
}
