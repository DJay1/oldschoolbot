import { patreonUrl } from '@/lib/patreonLink.js';

export const patreonCommand = defineCommand({
	name: 'patreon',
	description: 'The Patreon page for perk tiers.',
	options: [],
	run: async () => {
		return `Perk tiers are on Patreon: ${patreonUrl()}`;
	}
});
