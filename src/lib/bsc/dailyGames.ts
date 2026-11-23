import type { REST } from '@discordjs/rest';
import { ComponentType, InteractionResponseType, Routes } from '@oldschoolgg/discord';
import { Items, itemID } from 'oldschooljs';

import { createCanvas } from '@/lib/canvas/canvasUtil.js';
import { OSRSCanvas } from '@/lib/canvas/OSRSCanvas.js';

export const DAILY_WORDLE_LENGTH = 5;
export const DAILY_WORDLE_GUESSES = 5;
export const DAILY_WORDLE_MS = 90 * 1000;
export const DAILY_BUTTON_GAME_MS = 20 * 1000;
export const DAILY_TIMEOUT_NOTICE = 'Time ran out.';
export const DAILY_BUTTON_TARGETS = 5;
export const DAILY_BUTTON_DECOYS = 5;
export const DAILY_TYPING_MS = 30 * 1000;
export const DAILY_TYPING_MIN_CHARS = 8;
export const DAILY_TYPING_MAX_CHARS = 32;
export const DAILY_TYPING_ICON_SCALE = 5;
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

/** Well-known, visually distinctive OSRS items with local bank sprites. */
export type DailyTypingItem = {
	name: string;
	id: number;
	aliases: readonly string[];
};

export const DAILY_TYPING_ITEMS: readonly DailyTypingItem[] = [
	{ name: 'Abyssal whip', id: itemID('Abyssal whip'), aliases: ['whip', 'abby whip'] },
	{ name: 'Twisted bow', id: itemID('Twisted bow'), aliases: ['tbow', 't bow'] },
	{ name: 'Dragon warhammer', id: itemID('Dragon warhammer'), aliases: ['dwh'] },
	{ name: 'Scythe of vitur', id: itemID('Scythe of vitur'), aliases: ['scythe'] },
	{ name: "Tumeken's shadow", id: itemID("Tumeken's shadow"), aliases: ['shadow', 'tumeken shadow'] },
	{ name: 'Sanguinesti staff', id: itemID('Sanguinesti staff'), aliases: ['sang', 'sang staff'] },
	{ name: 'Ghrazi rapier', id: itemID('Ghrazi rapier'), aliases: ['rapier', 'ghrazi'] },
	{ name: 'Avernic defender', id: itemID('Avernic defender'), aliases: ['avernic'] },
	{ name: 'Infernal cape', id: itemID('Infernal cape'), aliases: [] },
	{ name: 'Barrows gloves', id: itemID('Barrows gloves'), aliases: ['barrows glove'] },
	{ name: 'Dragon hunter lance', id: itemID('Dragon hunter lance'), aliases: ['dhl'] },
	{ name: 'Abyssal bludgeon', id: itemID('Abyssal bludgeon'), aliases: ['bludgeon'] },
	{ name: 'Heavy ballista', id: itemID('Heavy ballista'), aliases: ['ballista'] },
	{ name: 'Armadyl godsword', id: itemID('Armadyl godsword'), aliases: ['ags'] },
	{ name: 'Bandos chestplate', id: itemID('Bandos chestplate'), aliases: ['bcp'] },
	{ name: 'Ancestral robe top', id: itemID('Ancestral robe top'), aliases: ['ancestral top', 'anc top'] },
	{ name: "Osmumten's fang", id: itemID("Osmumten's fang"), aliases: ['fang', 'osmumten fang'] },
	{ name: 'Zaryte crossbow', id: itemID('Zaryte crossbow'), aliases: ['zcb'] },
	{ name: 'Pegasian boots', id: itemID('Pegasian boots'), aliases: ['pegs', 'pegasians'] },
	{ name: 'Primordial boots', id: itemID('Primordial boots'), aliases: ['prims', 'primordials'] },
	{ name: 'Dragon claws', id: itemID('Dragon claws'), aliases: ['claws', 'dclaws', 'd claws'] },
	{ name: 'Toxic blowpipe', id: itemID('Toxic blowpipe'), aliases: ['blowpipe', 'tbp', 'bp'] },
	{ name: 'Elder maul', id: itemID('Elder maul'), aliases: [] },
	{ name: 'Elysian spirit shield', id: itemID('Elysian spirit shield'), aliases: ['ely', 'elysian'] },
	{ name: 'Voidwaker', id: itemID('Voidwaker'), aliases: [] },
	{ name: 'Bow of faerdhinen', id: itemID('Bow of faerdhinen'), aliases: ['bofa', 'bowfa'] },
	{ name: 'Dragon hunter crossbow', id: itemID('Dragon hunter crossbow'), aliases: ['dhcb'] },
	{ name: 'Armadyl crossbow', id: itemID('Armadyl crossbow'), aliases: ['acb'] },
	{ name: 'Bandos tassets', id: itemID('Bandos tassets'), aliases: ['tassets'] },
	{ name: 'Dragonfire shield', id: itemID('Dragonfire shield'), aliases: ['dfs'] },
	{ name: 'Serpentine helm', id: itemID('Serpentine helm'), aliases: ['serp helm'] },
	{ name: 'Granite maul', id: itemID('Granite maul'), aliases: ['gmaul', 'g maul'] },
	{ name: 'Abyssal tentacle', id: itemID('Abyssal tentacle'), aliases: ['tentacle'] },
	{ name: 'Kodai wand', id: itemID('Kodai wand'), aliases: ['kodai'] },
	{ name: "Dinh's bulwark", id: itemID("Dinh's bulwark"), aliases: ['dinhs', 'bulwark'] },
	{ name: 'Fire cape', id: itemID('Fire cape'), aliases: [] },
	{ name: 'Lightbearer', id: itemID('Lightbearer'), aliases: [] },
	{ name: 'Torva full helm', id: itemID('Torva full helm'), aliases: ['torva helm'] },
	{ name: 'Amulet of torture', id: itemID('Amulet of torture'), aliases: ['torture'] },
	{ name: 'Necklace of anguish', id: itemID('Necklace of anguish'), aliases: ['anguish'] },
	{ name: "Inquisitor's mace", id: itemID("Inquisitor's mace"), aliases: ['inq mace', 'inquisitor mace'] },
	{ name: 'Nightmare staff', id: itemID('Nightmare staff'), aliases: [] },
	{ name: 'Crystal halberd', id: itemID('Crystal halberd'), aliases: ['crystal hally'] },
	{ name: 'Soulreaper axe', id: itemID('Soulreaper axe'), aliases: ['soulreaper'] }
];

export const DAILY_TYPING_PHRASES = DAILY_TYPING_ITEMS.map(item => item.name);

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
	itemID?: number;
	status: 'playing' | 'won' | 'lost';
	notice?: string;
}

export type HardGameState = WordleState | ButtonGameState | TypingGameState;
export type HardGameType = HardGameState['type'];

export function normalizeWordleGuess(raw: string): string {
	return raw.replace(/[^a-zA-Z]/g, '').toUpperCase();
}

export function isAllowedWordleGuess(guess: string): boolean {
	return normalizeWordleGuess(guess).length === DAILY_WORDLE_LENGTH;
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
		next.notice = 'Type exactly 5 letters.';
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
		`Guess the 5-letter OSRS name in ${DAILY_WORDLE_GUESSES} tries. Any 5-letter word counts as a guess.`
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
	return raw
		.trim()
		.replace(/['\u2019]/g, '')
		.replace(/\s+/g, ' ')
		.toLowerCase();
}

export function typingItemByName(name: string): DailyTypingItem | undefined {
	const key = normalizeTypingGuess(name);
	return DAILY_TYPING_ITEMS.find(item => normalizeTypingGuess(item.name) === key);
}

export function typingAcceptedAnswers(phrase: string): string[] {
	const item = typingItemByName(phrase);
	const names = item ? [item.name, ...item.aliases] : [phrase];
	return names.map(normalizeTypingGuess);
}

export function isTypingGuessCorrect(phrase: string, raw: string): boolean {
	return typingAcceptedAnswers(phrase).includes(normalizeTypingGuess(raw));
}

export function resolveTypingItem(picked: DailyTypingItem | string): DailyTypingItem {
	if (typeof picked !== 'string') return picked;
	return (
		DAILY_TYPING_ITEMS.find(item => item.name === picked) ?? {
			name: picked,
			id: Items.getItem(picked)?.id ?? 0,
			aliases: []
		}
	);
}

export function createTypingState(rng: RNGProvider): TypingGameState {
	const item = resolveTypingItem(rng.pick(DAILY_TYPING_ITEMS as unknown as DailyTypingItem[]));
	return {
		type: 'typing',
		phrase: item.name,
		itemID: item.id || Items.getItem(item.name)?.id,
		status: 'playing'
	};
}

export function applyTypingGuess(state: TypingGameState, raw: string): TypingGameState {
	if (state.status !== 'playing') return state;
	if (isTypingGuessCorrect(state.phrase, raw)) {
		return { ...state, status: 'won', notice: 'You named it in time.' };
	}
	return { ...state, status: 'lost', notice: `That was not the right name. It was ${state.phrase}.` };
}

export function typingItemId(state: string | TypingGameState): number | undefined {
	if (typeof state !== 'string' && state.itemID) return state.itemID;
	const name = typeof state === 'string' ? state : state.phrase;
	return typingItemByName(name)?.id ?? Items.getItem(name)?.id;
}

export function typingGameRows(): { id: string; label: string }[][] {
	return [[{ id: DAILY_TYPING_BUTTON_ID, label: 'Type it' }]];
}

export function formatTypingMessage(state: TypingGameState, remainingMs: number): string {
	const lines = ['**Hard daily: Typing**', 'Name the OSRS item shown. Press Type it and enter the name.'];
	if (state.status === 'playing') {
		lines.push(`Time left: ${formatSeconds(remainingMs)}`);
	}
	if (state.notice) lines.push(state.notice);
	return lines.join('\n');
}

export async function loadDailyTypingIcon(itemId: number) {
	const icon = await OSRSCanvas.getItemImage({ itemID: itemId, networkTimeoutMs: 0 });
	if (OSRSCanvas.isGeneratedPlaceholderIcon(icon)) {
		throw new Error('Missing daily typing item icon');
	}
	if (icon.width < 8 || icon.height < 8) {
		throw new Error('Invalid daily typing item icon');
	}
	return icon;
}

export async function renderTypingPromptImage(phraseOrState: string | TypingGameState): Promise<Buffer> {
	const itemId = typingItemId(phraseOrState);
	if (!itemId) throw new Error('Unknown daily typing item');
	const icon = await loadDailyTypingIcon(itemId);
	const scale = DAILY_TYPING_ICON_SCALE;
	const pad = 36;
	const width = Math.max(icon.width * scale + pad * 2, 200);
	const height = Math.max(icon.height * scale + pad * 2, 200);
	const canvas = createCanvas(width, height);
	const ctx = canvas.getContext('2d');
	ctx.fillStyle = '#3e3229';
	ctx.fillRect(0, 0, width, height);
	ctx.strokeStyle = '#2a2118';
	ctx.lineWidth = 4;
	ctx.strokeRect(2, 2, width - 4, height - 4);
	ctx.imageSmoothingEnabled = false;
	const destW = icon.width * scale;
	const destH = icon.height * scale;
	ctx.drawImage(icon, Math.floor((width - destW) / 2), Math.floor((height - destH) / 2), destW, destH);
	return Buffer.from(await canvas.png);
}

export function wordleModalSpec() {
	return {
		customId: DAILY_WORDLE_MODAL_ID,
		title: 'Hard daily: Wordle',
		textInput: {
			customId: DAILY_WORDLE_MODAL_INPUT_ID,
			label: '5-letter word',
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
			label: 'Item name',
			placeholder: 'Item name',
			minLength: 1,
			maxLength: 80
		}
	};
}

export function extractModalText(itx: { data?: { components?: readonly unknown[] } }): string {
	for (const row of itx.data?.components ?? []) {
		if (!row || typeof row !== 'object') continue;
		const nested =
			'components' in row && Array.isArray((row as { components?: unknown }).components)
				? (row as { components: unknown[] }).components
				: [row];
		for (const comp of nested) {
			if (!comp || typeof comp !== 'object') continue;
			const typed = comp as { type?: number; value?: string };
			if (typed.type === ComponentType.TextInput && typeof typed.value === 'string') {
				return typed.value;
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

export const DISCORD_MODAL_TITLE_LIMIT = 45;
export const DISCORD_CUSTOM_ID_LIMIT = 100;
export const DISCORD_TEXT_INPUT_LABEL_LIMIT = 45;
export const DISCORD_TEXT_INPUT_STYLE_SHORT = 1;

export type DailyModalSpec = {
	customId: string;
	title: string;
	textInput: {
		customId: string;
		label: string;
		placeholder?: string;
		minLength?: number;
		maxLength?: number;
	};
};

export function dailyModalPayload(modal: DailyModalSpec) {
	return {
		custom_id: modal.customId,
		title: modal.title.slice(0, DISCORD_MODAL_TITLE_LIMIT),
		components: [
			{
				type: ComponentType.ActionRow,
				components: [
					{
						type: ComponentType.TextInput,
						custom_id: modal.textInput.customId,
						style: DISCORD_TEXT_INPUT_STYLE_SHORT,
						label: modal.textInput.label.slice(0, DISCORD_TEXT_INPUT_LABEL_LIMIT),
						required: true,
						placeholder: modal.textInput.placeholder?.slice(0, 100),
						min_length: modal.textInput.minLength,
						max_length: modal.textInput.maxLength
					}
				]
			}
		]
	};
}

export function dailyModalIsValid(modal: DailyModalSpec): boolean {
	if (modal.customId.length < 1 || modal.customId.length > DISCORD_CUSTOM_ID_LIMIT) return false;
	if (modal.title.length < 1 || modal.title.length > DISCORD_MODAL_TITLE_LIMIT) return false;
	if (modal.textInput.customId.length < 1 || modal.textInput.customId.length > DISCORD_CUSTOM_ID_LIMIT) return false;
	if (modal.textInput.label.length < 1 || modal.textInput.label.length > DISCORD_TEXT_INPUT_LABEL_LIMIT) return false;
	if (modal.textInput.placeholder && modal.textInput.placeholder.length > 100) return false;
	return true;
}

/** Open a Hard daily modal without relying on Interaction.showModal (that method may be missing from a stale package build). */
export async function showDailyGameModal(
	rest: Pick<REST, 'post'>,
	interaction: { id: string; rawInteraction: { token: string } },
	modal: DailyModalSpec
): Promise<void> {
	if (!dailyModalIsValid(modal)) {
		throw new Error('Invalid daily modal');
	}
	await rest.post(Routes.interactionCallback(interaction.id, interaction.rawInteraction.token), {
		auth: false,
		body: {
			type: InteractionResponseType.Modal,
			data: dailyModalPayload(modal)
		}
	});
}

export function isUnstartedTimedDaily(game: HardGameState): boolean {
	if (game.status !== 'playing') return false;
	if (game.type === 'wordle') return game.rows.length === 0;
	if (game.type === 'buttons') return game.progress === 0;
	return true;
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
	return `${tokenLines.join('\n')}\n${bonuses.join('')}**Hard daily: Wordle — You got CORGO in 5 tries.**\nThat's correct! I've picked you some random items as a reward...\n\nYou received ${maxLootLine}`;
}
