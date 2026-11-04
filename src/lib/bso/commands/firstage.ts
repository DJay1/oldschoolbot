import { firstAgeMaxUpgrades, firstAgeStatus, planActivation } from '@/lib/bso/firstAge/shards.js';

import { Bank } from 'oldschooljs';

import { FirstAgeItem } from '@/lib/customItems/firstAge.js';

export const firstAgeCommand = defineCommand({
	name: 'firstage',
	description: 'Charge a First Age shard, then create First Age (max) pieces.',
	attributes: {
		categoryFlags: ['minion', 'skilling'],
		examples: ['/firstage status', '/firstage activate']
	},
	options: [
		{
			type: 'Subcommand',
			name: 'status',
			description: 'Show sacrifice progress, shards, and how (max) pieces are created.'
		},
		{
			type: 'Subcommand',
			name: 'activate',
			description: 'Spend 1 uncharged shard for a full set of charged shards, if every sacrifice is done.'
		}
	],
	run: async ({ user, options }) => {
		const stats = await user.fetchMStats();
		if (options.activate) {
			const plan = planActivation({
				sacrificed: stats.sacrificedBank,
				unchargedOwned: user.bank.amount(FirstAgeItem.UNCHARGED_SHARD),
				chargedOwned: user.bank.amount(FirstAgeItem.CHARGED_SHARD)
			});
			if (!plan.ok) return plan.message;
			await user.transactItems({
				itemsToRemove: new Bank().add(FirstAgeItem.UNCHARGED_SHARD),
				itemsToAdd: new Bank().add(FirstAgeItem.CHARGED_SHARD, plan.charges),
				collectionLog: true
			});
			return `You consumed 1 Uncharged first age shard and received ${plan.charges} Charged first age shards (one charge for each First Age (max) piece). Use /create with a charged shard and the matching base piece, for example \`/create item:First age tiara (max)\`. Each create uses one charge.`;
		}

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
