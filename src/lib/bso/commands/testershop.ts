import { time } from '@oldschoolgg/discord';
import { formatDuration, Time } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import {
	getDeveloperPoints,
	recentDeveloperPointsLog,
	refundDeveloperPoints,
	removeDeveloperPoints
} from '@/lib/bsc/developerPoints.js';
import { getBscPatronOverride, updateBscPatronOverride } from '@/lib/bsc/patronStore.js';
import { bscPatronTierByLevel } from '@/lib/bsc/patronTiers.js';
import {
	getTesterPoints,
	recentTesterPointsLog,
	refundTesterPoints,
	removeTesterPoints
} from '@/lib/bsc/testerPoints.js';
import {
	applyTesterMilestones,
	formatTesterUnlockProgress,
	getTesterGiftBoxesOpened,
	planShopSpend,
	readTesterProgress
} from '@/lib/bsc/testerRewards.js';
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

type ShopSpend = { testerSpend: number; developerSpend: number; testerBalance: number; developerBalance: number };

async function chargeShopPoints(userId: string, cost: number, reason: string): Promise<ShopSpend | null> {
	const [tester, developer] = await Promise.all([getTesterPoints(userId), getDeveloperPoints(userId)]);
	const plan = planShopSpend(tester.balance, developer.balance, cost);
	if (!plan.ok) return null;

	let testerBalance = tester.balance;
	let developerBalance = developer.balance;

	if (plan.testerSpend > 0) {
		const charged = await removeTesterPoints(userId, plan.testerSpend, reason, null);
		if (!charged) return null;
		testerBalance = charged.balance;
	}
	if (plan.developerSpend > 0) {
		const charged = await removeDeveloperPoints(userId, plan.developerSpend, reason, null);
		if (!charged) {
			if (plan.testerSpend > 0) {
				await refundTesterPoints(userId, plan.testerSpend, `Refund: ${reason} (developer points failed)`);
			}
			return null;
		}
		developerBalance = charged.balance;
	}

	return {
		testerSpend: plan.testerSpend,
		developerSpend: plan.developerSpend,
		testerBalance,
		developerBalance
	};
}

async function refundShopSpend(userId: string, spend: ShopSpend, reason: string) {
	if (spend.testerSpend > 0) await refundTesterPoints(userId, spend.testerSpend, reason);
	if (spend.developerSpend > 0) await refundDeveloperPoints(userId, spend.developerSpend, reason);
}

function remainingPointsMessage(spend: ShopSpend): string {
	if (spend.developerSpend > 0 && spend.testerSpend > 0) {
		return `You have ${spend.testerBalance} tester points and ${spend.developerBalance} developer points left.`;
	}
	if (spend.developerSpend > 0) {
		return `You have ${spend.developerBalance} developer points left.`;
	}
	return `You have ${spend.testerBalance} tester points left.`;
}

export const testerShopCommand = defineCommand({
	name: 'testershop',
	description: 'Spend your tester or developer points.',
	options: [
		{
			type: 'Subcommand',
			name: 'buy',
			description: 'Buy something with your tester or developer points.',
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
			description: 'See your points, unlocks, and recent awards.',
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

		const charged = await chargeShopPoints(user.id, cost, `Bought ${quantity}x ${item.name}`);
		if (!charged) {
			const [tester, developer] = await Promise.all([getTesterPoints(user.id), getDeveloperPoints(user.id)]);
			return `You need ${cost} points to buy ${quantity}x ${item.name}. You have ${tester.balance} tester points and ${developer.balance} developer points.`;
		}

		Logging.logDebug(
			`Tester shop: ${user.id} bought ${quantity}x ${item.name} for ${cost} points (${charged.testerSpend} tester, ${charged.developerSpend} developer).`
		);
		try {
			const result = await grantTesterShopItem(user, item.name, quantity, rng);
			return `${result} ${remainingPointsMessage(charged)}`;
		} catch (error) {
			await refundShopSpend(user.id, charged, `Refund: ${quantity}x ${item.name} failed`);
			throw error;
		}
	}
});

function clipReason(reason: string, max = 80) {
	return reason.length <= max ? reason : `${reason.slice(0, max - 1)}…`;
}

async function testerPointsBalanceMessage(user: MUser) {
	const [{ balance, earnedTotal }, dev, testerLog, devLog, boxesOpened] = await Promise.all([
		getTesterPoints(user.id),
		getDeveloperPoints(user.id),
		recentTesterPointsLog(user.id),
		recentDeveloperPointsLog(user.id),
		getTesterGiftBoxesOpened(user)
	]);

	const unlocked = await applyTesterMilestones(user, boxesOpened, earnedTotal);
	const progress = readTesterProgress(user, boxesOpened, earnedTotal);

	const lines = [
		`You have **${balance}** tester points (${earnedTotal} earned in total) and **${dev.balance}** developer points.`,
		'',
		formatTesterUnlockProgress(progress)
	];
	if (unlocked.length > 0) {
		lines.push('', ...unlocked);
	}

	const log = [
		...testerLog.map(entry => ({ ...entry, source: 'tester' as const })),
		...devLog.map(entry => ({ ...entry, source: 'developer' as const }))
	]
		.sort((a, b) => b.createdAt - a.createdAt)
		.slice(0, 5);

	if (log.length > 0) {
		lines.push('', '**Recent:**');
		for (const entry of log) {
			const sign = entry.amount > 0 ? '+' : '';
			const kind = entry.source === 'developer' ? 'dev' : 'tester';
			lines.push(
				`${sign}${entry.amount} ${kind} - ${clipReason(entry.reason)} (${time(Math.floor(entry.createdAt / 1000), 'R')})`
			);
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
