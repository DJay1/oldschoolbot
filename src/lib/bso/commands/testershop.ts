import { Time } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import { premiumPatronTime } from '@/lib/premiumPatronTime.js';
import { requirePositiveQuantity, safePositiveProduct } from '@/lib/util/validateQuantity.js';

const shop = [
	{
		name: 'Tester gift box',
		cost: 30
	},
	{
		name: '1 Month T1',
		cost: 300
	},
	{
		name: 'Double loot token',
		cost: 80
	}
] as const;

export const testerShopCommand = defineCommand({
	name: 'testershop',
	description: 'Buy things using your testing points.',
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
	],
	run: async ({ options, user }) => {
		const robochimpUser = await user.fetchRobochimpUser();
		const item = shop.find(i => i.name === options.name);
		if (!item) return 'Invalid item.';
		const parsedQuantity = requirePositiveQuantity(options.quantity, { max: 100 });
		if (!parsedQuantity.ok) return parsedQuantity.error;
		const quantity = parsedQuantity.value;
		const parsedCost = safePositiveProduct(item.cost, quantity);
		if (!parsedCost.ok) return parsedCost.error;
		const cost = parsedCost.value;
		if (robochimpUser.testing_points_balance < cost) {
			return `You don't have enough points to buy ${quantity}x ${item.name}.`;
		}
		const charged = await roboChimpClient.user.updateMany({
			where: {
				id: BigInt(user.id),
				testing_points_balance: { gte: cost }
			},
			data: {
				testing_points_balance: {
					decrement: cost
				}
			}
		});
		if (charged.count !== 1) {
			return `You don't have enough points to buy ${quantity}x ${item.name}.`;
		}

		Logging.logDebug(`Tester shop: ${user.id} bought ${quantity}x ${item.name} for ${cost} points.`);
		try {
			return await grantTesterShopItem(user, item.name, quantity);
		} catch (error) {
			await roboChimpClient.user.update({
				where: { id: BigInt(user.id) },
				data: { testing_points_balance: { increment: cost } }
			});
			throw error;
		}
	}
});

async function grantTesterShopItem(user: MUser, name: (typeof shop)[number]['name'], quantity: number) {
	switch (name) {
		case 'Tester gift box': {
			const loot = new Bank().add('Tester gift box', quantity);
			await user.addItemsToBank({ items: loot, collectionLog: true });
			return `You bought ${loot}!`;
		}
		case '1 Month T1': {
			return premiumPatronTime(Time.Day * 31, 3, user, null);
		}
		case 'Double loot token': {
			const loot = new Bank().add('Double loot token', quantity);
			await user.addItemsToBank({ items: loot, collectionLog: true });
			return `You bought ${loot}!`;
		}
	}
}
