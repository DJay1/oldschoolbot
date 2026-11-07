import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Application emojis are uploaded to the bot itself (not a server), so Discord
 * renders them in every guild. IDs live in assets/emojis/application-emoji-ids.json,
 * which `pnpm emojis:sync` writes. Until an emoji is synced, callers get the
 * manifest's unicode/text fallback and never the raw `:name:` form.
 */

export interface ApplicationEmojiEntry {
	name: string;
	uploadName: string;
	aliases: readonly string[];
	fallback: string;
	animated: boolean;
	source: string | null;
	image: string | null;
	status: 'wiki' | 'missing';
	wiki: 'osrs' | 'rs3' | null;
	notes: string | null;
	usedIn: readonly string[];
}

export interface ApplicationEmojiManifest {
	license: string;
	emojis: readonly ApplicationEmojiEntry[];
}

export type ButtonEmoji = { id: string } | { name: string };

const UNKNOWN_FALLBACK = '▫️';
const EMOJI_NAME = /^[A-Za-z0-9_]{2,32}$/;
const SNOWFLAKE = /^\d{17,20}$/;
const CUSTOM_EMOJI = /<a?:([A-Za-z0-9_]{2,32}):\d{17,20}>/g;

const moduleDir = dirname(fileURLToPath(import.meta.url));

interface EmojiCache {
	exact: Map<string, ApplicationEmojiEntry>;
	ids: Record<string, string>;
}

let cache: EmojiCache | null = null;

function resolveRepoFile(relativePath: string): string | null {
	const candidates = [
		join(process.cwd(), relativePath),
		join(moduleDir, '../../..', relativePath),
		join(moduleDir, '../../../..', relativePath)
	];
	for (const candidate of candidates) {
		if (existsSync(candidate)) return candidate;
	}
	return null;
}

function readJson(relativePath: string): unknown {
	const path = resolveRepoFile(relativePath);
	if (!path) return null;
	try {
		return JSON.parse(readFileSync(path, 'utf8')) as unknown;
	} catch {
		return null;
	}
}

function isEntry(value: unknown): value is ApplicationEmojiEntry {
	if (!value || typeof value !== 'object') return false;
	const entry = value as ApplicationEmojiEntry;
	return (
		typeof entry.name === 'string' &&
		typeof entry.uploadName === 'string' &&
		typeof entry.fallback === 'string' &&
		Array.isArray(entry.aliases)
	);
}

function loadCache(): EmojiCache {
	if (cache) return cache;
	const exact = new Map<string, ApplicationEmojiEntry>();
	const raw = readJson('assets/emojis/manifest.json');
	const emojis =
		raw && typeof raw === 'object' && Array.isArray((raw as ApplicationEmojiManifest).emojis)
			? (raw as ApplicationEmojiManifest).emojis
			: [];
	for (const entry of emojis) {
		if (!isEntry(entry)) continue;
		exact.set(entry.name, entry);
		for (const alias of entry.aliases) {
			if (typeof alias === 'string') exact.set(alias, entry);
		}
	}
	const ids: Record<string, string> = {};
	const idsRaw = readJson('assets/emojis/application-emoji-ids.json');
	if (idsRaw && typeof idsRaw === 'object') {
		for (const [key, value] of Object.entries(idsRaw)) {
			if (typeof value === 'string' && SNOWFLAKE.test(value)) ids[key] = value;
		}
	}
	cache = { exact, ids };
	return cache;
}

/** Test hook. The running bot loads the manifest once per process. */
export function resetApplicationEmojiCache(): void {
	cache = null;
}

export function lookupApplicationEmoji(name: string): ApplicationEmojiEntry | null {
	return loadCache().exact.get(name) ?? null;
}

export function applicationEmojiId(name: string): string | null {
	const entry = lookupApplicationEmoji(name);
	if (!entry) return null;
	const id = loadCache().ids[entry.uploadName];
	return id && SNOWFLAKE.test(id) ? id : null;
}

function safeFallback(entry: ApplicationEmojiEntry | null): string {
	const fallback = entry?.fallback;
	return fallback && fallback.length > 0 ? fallback : UNKNOWN_FALLBACK;
}

export function customEmoji(name: string): string {
	const entry = lookupApplicationEmoji(name);
	if (!entry) return UNKNOWN_FALLBACK;
	const id = loadCache().ids[entry.uploadName];
	if (!id || !SNOWFLAKE.test(id) || !EMOJI_NAME.test(entry.uploadName)) return safeFallback(entry);
	const prefix = entry.animated ? '<a:' : '<:';
	return `${prefix}${entry.uploadName}:${id}>`;
}

/**
 * Rewrite known `<:name:oldId>` markup to the current application emoji, or to
 * its fallback. Names that are not in the manifest are left untouched so a
 * patron-chosen emoji from another server is not destroyed.
 */
export function resolveEmojiText(text: string): string {
	return text.replace(CUSTOM_EMOJI, (full, name: string) => {
		if (!lookupApplicationEmoji(name)) return full;
		return customEmoji(name);
	});
}

function isButtonSafe(fallback: string): boolean {
	if (!fallback) return false;
	// Button emoji names must be a single unicode emoji, not a short text label.
	if (/[A-Za-z0-9]/.test(fallback)) return false;
	return true;
}

export function buttonEmoji(name: string): ButtonEmoji {
	const id = applicationEmojiId(name);
	if (id) return { id };
	const fallback = safeFallback(lookupApplicationEmoji(name));
	return { name: isButtonSafe(fallback) ? fallback : UNKNOWN_FALLBACK };
}

/**
 * Value for the Create Reaction route: `name:id` for an application emoji,
 * or a unicode emoji when it has not been synced yet.
 */
export function reactionEmoji(name: string): string {
	const entry = lookupApplicationEmoji(name);
	const id = entry ? loadCache().ids[entry.uploadName] : undefined;
	if (entry && id && SNOWFLAKE.test(id) && EMOJI_NAME.test(entry.uploadName)) {
		return `${entry.uploadName}:${id}`;
	}
	const fallback = safeFallback(entry);
	return isButtonSafe(fallback) ? fallback : UNKNOWN_FALLBACK;
}
