import { isValidNickname } from '@/lib/util/smallUtils.js';

export const PATRON_TITLE_MAX_LENGTH = 24;
export const PATRON_TITLE_MIN_LENGTH = 2;

const urlPattern = /https?:\/\/\S+|www\.\S+|discord(?:\.gg|app\.com\/invite)\/\S+/gi;
const mentionPattern = /<@!?\d+>|<@&\d+>|<#\d+>/g;
const markdownPattern = /[`*_~|>\\]/;

function stripSurroundingQuotesAndColons(input: string): string {
	let text = input.trim();
	let prev = '';
	while (text !== prev) {
		prev = text;
		text = text.replace(/^[:'"“”‘’]+|[:'"“”‘’]+$/g, '').trim();
	}
	return text;
}

export function parsePatronTitle(
	input: string
): { ok: true; title: string | null } | { ok: false; message: string } {
	if (/[\r\n]/.test(input)) {
		return { ok: false, message: 'Title cannot include line breaks.' };
	}

	const text = stripSurroundingQuotesAndColons(input);
	if (!text) {
		return {
			ok: false,
			message: `Title must be between ${PATRON_TITLE_MIN_LENGTH} and ${PATRON_TITLE_MAX_LENGTH} characters. Use "clear" to remove it.`
		};
	}
	if (/^(clear|none|remove)$/i.test(text)) {
		return { ok: true, title: null };
	}

	if (text.length > PATRON_TITLE_MAX_LENGTH) {
		return {
			ok: false,
			message: `Title must be between ${PATRON_TITLE_MIN_LENGTH} and ${PATRON_TITLE_MAX_LENGTH} characters.`
		};
	}

	if (/(^|\s)@(?:everyone|here)\b/i.test(text) || mentionPattern.test(text)) {
		mentionPattern.lastIndex = 0;
		return { ok: false, message: 'Title cannot include mentions.' };
	}
	mentionPattern.lastIndex = 0;

	urlPattern.lastIndex = 0;
	if (urlPattern.test(text)) {
		urlPattern.lastIndex = 0;
		return { ok: false, message: 'Title cannot include links or invites.' };
	}
	urlPattern.lastIndex = 0;

	if (markdownPattern.test(text)) {
		return { ok: false, message: 'Title cannot include markdown or special formatting characters.' };
	}

	if (!isValidNickname(text)) {
		return {
			ok: false,
			message: `That's not a valid title. Titles must be ${PATRON_TITLE_MIN_LENGTH}-${PATRON_TITLE_MAX_LENGTH} characters, with no emojis, mentions, or special formatting.`
		};
	}

	return { ok: true, title: text };
}
