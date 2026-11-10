export const PATRON_TITLES = [
	'Good Boy',
	'Corgo Commander',
	'Treat Hoarder',
	'Zoomies Champion',
	'Fetch Master',
	'Bark Lord',
	'Pupper of the Realm',
	'Floof Knight',
	'Biscuit Baron',
	'Leash Breaker'
] as const;

export type PatronTitle = (typeof PATRON_TITLES)[number];

export function parsePatronTitle(input: string): PatronTitle | 'clear' | null {
	const key = input.trim().toLowerCase().replace(/[\s_-]+/g, '');
	if (!key) return null;
	if (key === 'clear' || key === 'none' || key === 'remove') return 'clear';
	return PATRON_TITLES.find(title => title.toLowerCase().replace(/[\s_-]+/g, '') === key) ?? null;
}

export function formatPatronTitleList(): string {
	return PATRON_TITLES.map(title => `"${title}"`).join(', ');
}
