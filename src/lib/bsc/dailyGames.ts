export const DAILY_WORDLE_LENGTH = 5;
export const DAILY_WORDLE_GUESSES = 6;
export const DAILY_WORDLE_MS = 2 * 60 * 1000;
export const DAILY_BUTTON_GAME_MS = 15 * 1000;
export const DAILY_BUTTON_TARGETS = 3;
export const DAILY_BUTTON_DECOYS = 5;
export const DAILY_WORDLE_BUTTON_PREFIX = 'dlyw:';
export const DAILY_SPEED_CLICK_BUTTON_PREFIX = 'dlyb:';

/**
 * Curated 5-letter OSRS/BSC names players will actually know.
 * No obscure uniques or slang. Used as both answers and the allowed guess list.
 */
export const DAILY_WORDLE_WORDS = [
	'SHARK',
	'TROUT',
	'HYDRA',
	'KARIL',
	'AHRIM',
	'TORAG',
	'VERAC',
	'CORGO',
	'DEMON',
	'QUEST',
	'CLUES',
	'CLOAK',
	'BOOTS',
	'ARROW',
	'BOLTS',
	'DARTS',
	'KNIFE',
	'SPEAR',
	'HASTA',
	'LANCE',
	'FLAIL',
	'CLAWS',
	'STAFF',
	'RUNES',
	'TEARS',
	'PATCH',
	'POUCH',
	'TIARA',
	'ALTAR',
	'BONES',
	'ASHES',
	'GRACE',
	'MARKS',
	'VENOM',
	'NINJA',
	'SPADE',
	'STEEL',
	'BLOOD',
	'DEATH',
	'WRATH',
	'CHAOS',
	'SMOKE',
	'ABYSS',
	'DRAKE',
	'GLORY',
	'GNOME',
	'DWARF',
	'GIANT',
	'TROLL',
	'CHINS',
	'HERBS',
	'SEEDS',
	'BLADE',
	'HELMS'
] as const;

const WORDLE_WORD_SET = new Set<string>(DAILY_WORDLE_WORDS);

export const DAILY_BUTTON_NAMES = [
	'Shark',
	'Trout',
	'Lobster',
	'Hydra',
	'Zulrah',
	'Vorkath',
	'Kraken',
	'Jad',
	'Nex',
	'Tempoross',
	'Wintertodt',
	'Corgo',
	'Laboon',
	'Gobbles',
	'Skipper',
	'Shelldon',
	'Diango',
	'Magic',
	'Attack',
	'Fishing',
	'Slayer',
	'Agility',
	'Farming',
	'Runecraft',
	'Bones',
	'Shark',
	'Rune scimitar',
	'Abyssal whip',
	'Fire cape',
	'Dragon claws',
	'Twisted bow'
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
	input: string;
	page: 1 | 2;
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

export type HardGameState = WordleState | ButtonGameState;

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
		input: '',
		page: 1,
		status: 'playing'
	};
}

export type WordleAction =
	| { kind: 'letter'; letter: string }
	| { kind: 'clear' }
	| { kind: 'page'; page: 1 | 2 }
	| { kind: 'submit' };

export function parseWordleAction(customId: string): WordleAction | null {
	if (!customId.startsWith(DAILY_WORDLE_BUTTON_PREFIX)) return null;
	const value = customId.slice(5);
	if (value === 'CLR') return { kind: 'clear' };
	if (value === 'GO') return { kind: 'submit' };
	if (value === 'PG1') return { kind: 'page', page: 1 };
	if (value === 'PG2') return { kind: 'page', page: 2 };
	if (/^[A-Z]$/.test(value)) return { kind: 'letter', letter: value };
	return null;
}

export function applyWordleAction(state: WordleState, action: WordleAction): WordleState {
	if (state.status !== 'playing') return state;
	const next: WordleState = { ...state, rows: [...state.rows], notice: undefined };
	if (action.kind === 'page') {
		next.page = action.page;
		return next;
	}
	if (action.kind === 'clear') {
		next.input = '';
		return next;
	}
	if (action.kind === 'letter') {
		if (next.input.length < DAILY_WORDLE_LENGTH) next.input += action.letter;
		return next;
	}
	const guess = normalizeWordleGuess(next.input);
	if (guess.length !== DAILY_WORDLE_LENGTH) {
		next.notice = 'Type all 5 letters, then press Guess.';
		return next;
	}
	if (!isAllowedWordleGuess(guess)) {
		next.notice = 'Not in the list. Try a common OSRS or BSC name.';
		next.input = '';
		return next;
	}
	const marks = scoreWordleGuess(next.answer, guess);
	next.rows.push({ guess, marks });
	next.input = '';
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

export function wordleKeyboardSpec(page: 1 | 2): { id: string; label: string }[][] {
	const letters = page === 1 ? 'ABCDEFGHIJKLMNO' : 'PQRSTUVWXYZ';
	const rows: { id: string; label: string }[][] = [];
	for (let i = 0; i < letters.length; i += 5) {
		rows.push(
			letters
				.slice(i, i + 5)
				.split('')
				.map(letter => ({ id: `dlyw:${letter}`, label: letter }))
		);
	}
	const controls =
		page === 1
			? [
					{ id: 'dlyw:PG2', label: 'N–Z' },
					{ id: 'dlyw:CLR', label: 'Clear' },
					{ id: 'dlyw:GO', label: 'Guess' }
				]
			: [
					{ id: 'dlyw:PG1', label: 'A–O' },
					{ id: 'dlyw:CLR', label: 'Clear' },
					{ id: 'dlyw:GO', label: 'Guess' }
				];
	rows.push(controls);
	return rows;
}

export function formatWordleMessage(state: WordleState, remainingMs: number): string {
	const lines = ['**Hard daily: Wordle**', 'Guess the 5-letter OSRS or BSC name in 6 tries.'];
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
	if (state.status === 'playing') {
		const typed = state.input.padEnd(DAILY_WORDLE_LENGTH, '·');
		lines.push(`Guess: ${typed}`);
	}
	if (state.notice) lines.push(state.notice);
	return lines.join('\n');
}

export function uniqueButtonNames(): string[] {
	return [...new Set(DAILY_BUTTON_NAMES)];
}

export function createButtonGameState(rng: RNGProvider): ButtonGameState {
	const pool = rng.shuffle(uniqueButtonNames());
	const targets = pool.slice(0, DAILY_BUTTON_TARGETS);
	const decoys = pool.slice(DAILY_BUTTON_TARGETS, DAILY_BUTTON_TARGETS + DAILY_BUTTON_DECOYS);
	return {
		type: 'buttons',
		targets,
		choices: rng.shuffle([...targets, ...decoys]),
		progress: 0,
		status: 'playing'
	};
}

export function parseButtonAction(customId: string): number | null {
	if (!customId.startsWith(DAILY_SPEED_CLICK_BUTTON_PREFIX)) return null;
	const index = Number(customId.slice(5));
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
	const lines = ['**Hard daily: Speed click**', `Click these in order: **${path}**`];
	if (state.status === 'playing') {
		lines.push(`Time left: ${formatSeconds(remainingMs)}`);
	}
	if (state.notice) lines.push(state.notice);
	return lines.join('\n');
}

export function createHardGame(rng: RNGProvider): HardGameState {
	return rng.roll(2) ? createWordleState(rng) : createButtonGameState(rng);
}

export function hardGameTimeoutMs(state: HardGameState): number {
	return state.type === 'wordle' ? DAILY_WORDLE_MS : DAILY_BUTTON_GAME_MS;
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
	return `${tokenLines.join('\n')}\n${bonuses.join('')}**Hard daily: Wordle — You got CORGO in 6 tries.**\nThat's correct! I've picked you some random items as a reward...\n\nYou received ${maxLootLine}`;
}
