import { firstAgeMaxUpgrades, firstAgeStatus } from '@/lib/bso/firstAge/shards.js';

import { FirstAgeItem } from '@/lib/customItems/firstAge.js';

export const firstAgeCommand = defineCommand({
	name: 'firstage',
	description: 'Show First Age sacrifice progress and how (max) pieces are created.',
	attributes: {
		categoryFlags: ['minion', 'skilling'],
		examples: ['/firstage']
	},
	options: [],
	run: async ({ user }) => {
		const stats = await user.fetchMStats();
		const ownedMaxNames = firstAgeMaxUpgrades
			.filter(piece => user.bank.has(piece.maxId) || user.hasEquipped(piece.maxId))
			.map(piece => piece.maxName);
		return firstAgeStatus({
			sacrificed: stats.sacrificedBank,
			uncharged: user.bank.amount(FirstAgeItem.UNCHARGED_SHARD),
			charged: user.bank.amount(FirstAgeItem.CHARGED_SHARD),
			ownedMaxNames
		});
	}
});
