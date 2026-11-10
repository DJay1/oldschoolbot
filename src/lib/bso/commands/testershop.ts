import { time } from '@oldschoolgg/discord';
import { formatDuration, Time } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import { getBscPatronOverride, updateBscPatronOverride } from '@/lib/bsc/patronStore.js';
import { bscPatronTierByLevel } from '@/lib/bsc/patronTiers.js';
import {
	getTesterPoints,
	recentTesterPointsLog,
	refundTesterPoints,
	removeTesterPoints
} from '@/lib/bsc/testerPoints.js';
import { LaunchItem } from '@/lib/events/launch/items.js';
import { getUsersPerkTier } from '@/lib/perkTiers.js';
import { requirePositiveQuantity, safePositiveProduct } from '@/lib/util/validateQuantity.js';

const MYSTERY_BOX_BUNDLE_SIZE = 50;

const BUNDLE_MYSTERY_BOXES = [
	'Tradeable Mystery Box',
	'Untradeable Mystery Box',
	'Equippable mystery box',
	'Clothing Mystery Box',
	'Holiday Mystery Box',
	'Pet Mystery Box'
] as const;

const TESTER_REWARD_LEVEL = 3;

const shop = [
	{ name: 'Tester gift box', cost: 15 },
	{ name: '1 Week Top Dog', cost: 100 },
	{ name: '1 Month Top Dog', cost: 350 },
	{ name: 'Double loot token', cost: 50 },
	{ name: 'Double XP token', cost: 50 },
	{ name: 'Mystery Box Bundle', cost: 125 }
] as const;

type ShopItemName = (typeof shop)[number]['name'];

export const testerShopCommand = defineCommand({
	name: 'testershop',
	description: 'Spend your tester points.',
	options: [
		{
			type: 'Subcommand',
			name: 'buy',
			description: 'Buy something with your tester points.',
			options: [
				{
					type: 'String',
					name: 'name',
					description: 'The item to buy.',
					required: true,
					choices: shop.map(i => ({
						name: `${i.name} (${i.cost} points)`,
						value: i.name
					}))
				},
				{
					type: 'Integer',
					name: 'quantity',
					description: 'The quantity (defaults to 1).',
					required: false,
					min_value: 1,
					max_value: 100
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'balance',
			description: 'See your tester points and recent awards.',
			options: []
		}
	],
	run: async ({ options, user, rng }) => {
		if (options.balance) {
			return testerPointsBalanceMessage(user);
		}
		if (!options.buy) return 'Invalid subcommand.';

		const item = shop.find(i => i.name === options.buy?.name);
		if (!item) return 'Invalid item.';
		const parsedQuantity = requirePositiveQuantity(options.buy.quantity, { max: 100 });
		if (!parsedQuantity.ok) return parsedQuantity.error;
		const quantity = parsedQuantity.value;
		const parsedCost = safePositiveProduct(item.cost, quantity);
		if (!parsedCost.ok) return parsedCost.error;
		const cost = parsedCost.value;

		const charged = await removeTesterPoints(user.id, cost, `Bought ${quantity}x ${item.name}`, null);
		if (!charged) {
			const { balance } = await getTesterPoints(user.id);
			return `You need ${cost} tester points to buy ${quantity}x ${item.name}, you have ${balance}.`;
		}

		Logging.logDebug(`Tester shop: ${user.id} bought ${quantity}x ${item.name} for ${cost} points.`);
		try {
			const result = await grantTesterShopItem(user, item.name, quantity, rng);
			return `${result} You have ${charged.balance} tester points left.`;
		} catch (error) {
			await refundTesterPoints(user.id, cost, `Refund: ${quantity}x ${item.name} failed`);
			throw error;
		}
	}
});

async function testerPointsBalanceMessage(user: MUser) {
	const [{ balance, earnedTotal }, log] = await Promise.all([
		getTesterPoints(user.id),
		recentTesterPointsLog(user.id)
	]);
	const lines = [`You have **${balance}** tester points (${earnedTotal} earned in total).`];
	if (log.length > 0) {
		lines.push('', '**Recent:**');
		for (const entry of log) {
			const sign = entry.amount > 0 ? '+' : '';
			lines.push(`${sign}${entry.amount} - ${entry.reason} (${time(Math.floor(entry.createdAt / 1000), 'R')})`);
		}
	}
	return lines.join('\n');
}

async function grantTesterRewardTier(user: MUser, durationMs: number) {
	const tier = bscPatronTierByLevel(TESTER_REWARD_LEVEL)!;
	const now = Date.now();
	const current = await getBscPatronOverride(user.id);
	const stillActive =
		current?.rewardTier === TESTER_REWARD_LEVEL && current.rewardUntil !== null && current.rewardUntil > now;
	const until = (stillActive ? current.rewardUntil! : now) + durationMs;
	await updateBscPatronOverride(user.id, { rewardTier: TESTER_REWARD_LEVEL, rewardUntil: until });
	await getUsersPerkTier({ user, forceNoCache: true });
	return `You now have ${tier.name} until ${time(Math.floor(until / 1000), 'f')} (${formatDuration(until - now)}).`;
}

function rollMysteryBoxBundle(quantity: number, rng: RNGProvider) {
	const loot = new Bank();
	for (let i = 0; i < MYSTERY_BOX_BUNDLE_SIZE * quantity; i++) {
		loot.add(rng.pick([...BUNDLE_MYSTERY_BOXES]));
	}
	return loot;
}

async function giveItems(user: MUser, loot: Bank) {
	await user.addItemsToBank({ items: loot, collectionLog: true });
	return `You bought ${loot}!`;
}

async function grantTesterShopItem(user: MUser, name: ShopItemName, quantity: number, rng: RNGProvider) {
	switch (name) {
		case 'Tester gift box':
			return giveItems(user, new Bank().add('Tester gift box', quantity));
		case '1 Week Top Dog':
			return grantTesterRewardTier(user, Time.Week * quantity);
		case '1 Month Top Dog':
			return grantTesterRewardTier(user, Time.Day * 31 * quantity);
		case 'Double loot token':
			return giveItems(user, new Bank().add('Double loot token', quantity));
		case 'Double XP token':
			return giveItems(user, new Bank().add(LaunchItem.DOUBLE_XP_TOKEN, quantity));
		case 'Mystery Box Bundle':
			return giveItems(user, rollMysteryBoxBundle(quantity, rng));
	}
}
