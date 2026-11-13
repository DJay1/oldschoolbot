export const PATRON_FLAIR_MAX_LENGTH = 80;

const urlPattern = /https?:\/\/\S+|www\.\S+|discord(?:\.gg|app\.com\/invite)\/\S+/gi;
const mentionPattern = /<@!?\d+>|<@&\d+>|<#\d+>/g;

export function sanitizePatronFlair(input: string): { ok: true; flair: string } | { ok: false; message: string } {
	let text = input.replace(/\r?\n|\r|\t/g, ' ').replace(/\s+/g, ' ').trim();
	if (!text) return { ok: false, message: 'Flair cannot be empty. Use "clear" to remove it.' };
	if (/^clear$/i.test(text)) return { ok: true, flair: '' };
	if (/(^|\s)@(?:everyone|here)\b/i.test(text)) {
		return { ok: false, message: 'Flair cannot mention everyone or here.' };
	}
	if (mentionPattern.test(text) || urlPattern.test(text)) {
		return { ok: false, message: 'Flair cannot include mentions, links, or invites.' };
	}
	// Reset lastIndex after /g tests.
	mentionPattern.lastIndex = 0;
	urlPattern.lastIndex = 0;
	text = text.replace(mentionPattern, '').replace(urlPattern, '').trim();
	if (text.length > PATRON_FLAIR_MAX_LENGTH) {
		return { ok: false, message: `Flair must be ${PATRON_FLAIR_MAX_LENGTH} characters or fewer.` };
	}
	if (!text) return { ok: false, message: 'Flair cannot include mentions, links, or invites.' };
	return { ok: true, flair: text };
}

export function formatTripFlairLine(flair: string | null | undefined): string | null {
	if (!flair) return null;
	const cleaned = flair.trim();
	if (!cleaned) return null;
	return `*${cleaned}*`;
}
