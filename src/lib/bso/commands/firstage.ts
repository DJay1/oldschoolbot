import {
	affinityStatus,
	firstAgeAffinities,
	firstAgeMaxUpgrades,
	isWearingFirstAge,
	planAbsorb,
	planSeal,
	planUnlock,
	planUpgrade
} from '@/lib/bso/firstAge/affinities.js';

import { Bank } from 'oldschooljs';

import { FirstAgeItem } from '@/lib/customItems/firstAge.js';

const affinityChoices = firstAgeAffinities.map(affinity => ({
	name: affinity.name,
	value: affinity.id
}));

const pieceChoices = firstAgeMaxUpgrades.map(piece => ({
	name: piece.maxName,
	value: piece.key
}));

export const firstAgeCommand = defineCommand({
	name: 'firstage',
	description: 'Absorb skilling outfits into First Age affinities, then upgrade First Age pieces.',
	attributes: {
		categoryFlags: ['minion', 'skilling'],
		examples: ['/firstage status', '/firstage absorb outfit:Lumberjack', '/firstage upgrade piece:Tiara']
	},
	options: [
		{
			type: 'Subcommand',
			name: 'status',
			description: 'Show your affinities, shards, and max-piece path.'
		},
		{
			type: 'Subcommand',
			name: 'absorb',
			description: 'Trade a full skilling outfit from your bank for affinity shards.',
			options: [
				{
					type: 'String',
					name: 'outfit',
					description: 'The outfit to absorb.',
					required: true,
					choices: affinityChoices
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'unlock',
			description: 'Spend shards to unlock an affinity. It is stored on your account.',
			options: [
				{
					type: 'String',
					name: 'affinity',
					description: 'The affinity to unlock.',
					required: true,
					choices: affinityChoices
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'seal',
			description: 'Create First age max seals after every affinity is unlocked.',
			options: [
				{
					type: 'Integer',
					name: 'quantity',
					description: 'How many seals to create (default 1).',
					required: false,
					min_value: 1,
					max_value: 100
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'upgrade',
			description: 'Spend one max seal and a base First Age piece to create the tradeable (max) piece.',
			options: [
				{
					type: 'String',
					name: 'piece',
					description: 'The First Age piece to upgrade.',
					required: true,
					choices: pieceChoices
				}
			]
		}
	],
	run: async ({ user, options }) => {
		const unlocked = user.user.first_age_affinities ?? [];

		if (options.absorb) {
			const plan = planAbsorb(user.bank, options.absorb.outfit);
			if ('error' in plan) return plan.error;
			const shards = new Bank().add(FirstAgeItem.AFFINITY_SHARD, plan.affinity.shardValue);
			await user.transactItems({ itemsToRemove: plan.remove, itemsToAdd: shards, collectionLog: true });
			return `You absorbed a full ${plan.affinity.name} outfit for ${plan.affinity.shardValue} First age affinity shards. Unlock it with \`/firstage unlock affinity:${plan.affinity.name}\`.`;
		}

		if (options.unlock) {
			const plan = planUnlock(user.bank, unlocked, options.unlock.affinity);
			if ('error' in plan) return plan.error;
			await user.transactItems({
				itemsToRemove: new Bank().add(FirstAgeItem.AFFINITY_SHARD, plan.affinity.unlockCost)
			});
			await user.addItemsToCollectionLog({
				itemsToAdd: new Bank().add(plan.affinity.tokenId),
				otherUpdates: { first_age_affinities: [...unlocked, plan.affinity.tokenId] }
			});
			return `You unlocked the ${plan.affinity.name} affinity (${plan.affinity.bonus}). It counts as that outfit while you are wearing any First Age piece, and it does not stack with the outfit itself.`;
		}

		if (options.seal) {
			const quantity = options.seal.quantity ?? 1;
			const plan = planSeal(user.bank, unlocked, quantity);
			if ('error' in plan) return plan.error;
			await user.transactItems({
				itemsToRemove: new Bank().add(FirstAgeItem.AFFINITY_SHARD, plan.cost),
				itemsToAdd: new Bank().add(FirstAgeItem.MAX_SEAL, plan.quantity),
				collectionLog: true
			});
			return `You created ${plan.quantity}x First age max seal for ${plan.cost} shards. Use \`/firstage upgrade\` to turn a base piece into a tradeable (max) piece. Each upgrade consumes one seal.`;
		}

		if (options.upgrade) {
			const plan = planUpgrade(user.bank, options.upgrade.piece);
			if ('error' in plan) return plan.error;
			const { upgrade } = plan;
			await user.transactItems({
				itemsToRemove: new Bank().add(FirstAgeItem.MAX_SEAL).add(upgrade.baseId),
				itemsToAdd: new Bank().add(upgrade.maxId),
				collectionLog: true
			});
			return `You used a First age max seal on ${upgrade.baseName} and received a tradeable ${upgrade.maxName}. It keeps the First Age XP boost, and your unlocked affinities still apply while it is worn.`;
		}

		const ownedMaxNames = firstAgeMaxUpgrades
			.filter(piece => user.bank.has(piece.maxId) || user.hasEquipped(piece.maxId))
			.map(piece => piece.maxName);
		return affinityStatus({
			unlocked,
			shards: user.bank.amount(FirstAgeItem.AFFINITY_SHARD),
			seals: user.bank.amount(FirstAgeItem.MAX_SEAL),
			wearingFirstAge: isWearingFirstAge(user.gearBank),
			ownedMaxNames
		});
	}
});
