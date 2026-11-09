import { PLACEHOLDER_COUNT, PLACEHOLDER_ITEM_IDS } from '@/lib/bso/bankPlaceholders.js';

import { Bank } from 'oldschooljs';

export const buyPlaceholdersCommand = defineCommand({
	name: 'buyplaceholders',
	description: 'Get free bank placeholders to lay out your bank with sort weightings.',
	options: [
		{
			type: 'Integer',
			name: 'quantity',
			description: `How many placeholders you want (max ${PLACEHOLDER_COUNT}).`,
			required: true,
			min_value: 1,
			max_value: PLACEHOLDER_COUNT
		}
	],
	run: async ({ options, user }) => {
		const missing = PLACEHOLDER_ITEM_IDS.filter(id => !user.bank.has(id));
		if (missing.length === 0) {
			return `You already have all ${PLACEHOLDER_COUNT} placeholders.`;
		}

		const toAdd = new Bank();
		for (const id of missing.slice(0, options.quantity)) {
			toAdd.add(id);
		}
		await user.addItemsToBank({ items: toAdd, collectionLog: false });

		const capped =
			toAdd.length < options.quantity
				? ` You only had ${toAdd.length} left to get, you now have all ${PLACEHOLDER_COUNT}.`
				: '';
		return `You received ${toAdd.length}x placeholders: ${toAdd
			.items()
			.map(([item]) => item.name)
			.join(', ')}.${capped}`;
	}
});
