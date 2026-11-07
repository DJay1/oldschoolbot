/** Public Patreon page. PATREON_URL overrides this. No tracking parameters. */
export const DEFAULT_PATREON_URL = 'https://patreon.com/bscbot';

/**
 * The link shown to players. Defaults to the Bark School Corgo page.
 * Set PATREON_URL to point a different instance somewhere else.
 */
export function patreonUrl(): string {
	const raw = process.env.PATREON_URL?.trim();
	if (!raw) return DEFAULT_PATREON_URL;
	try {
		const url = new URL(raw);
		if (url.protocol !== 'https:' && url.protocol !== 'http:') return DEFAULT_PATREON_URL;
		return url.toString();
	} catch {
		return DEFAULT_PATREON_URL;
	}
}

/** Append the configured Patreon page to a perk sentence. */
export function withPatreonLink(sentence: string): string {
	const trimmed = sentence.trimEnd();
	return `${trimmed} ${patreonUrl()}`;
}
