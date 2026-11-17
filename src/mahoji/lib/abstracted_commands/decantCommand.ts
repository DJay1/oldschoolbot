import { Bank } from 'oldschooljs';

import decantPotionFromBank, {
	decantAllPotionsFromBank,
	formatDecantReply
} from '@/lib/minions/functions/decantPotionFromBank.js';

export async function decantCommand(user: MUser, itemName: string, dose = 4, quantity?: number) {
	if (![1, 2, 3, 4].includes(dose)) return 'Invalid dose number.';
	if (quantity !== undefined && (!Number.isInteger(quantity) || quantity < 1)) return 'Invalid quantity.';

	const isAll = itemName.trim().toLowerCase() === 'all';
	const res = isAll
		? decantAllPotionsFromBank(user.bank, dose, quantity)
		: decantPotionFromBank(user.bank, itemName, dose, quantity);
	if ('error' in res && res.error !== null) return res.error;

	const results = 'results' in res ? res.results : [res];
	if (results.length === 0) {
		return "You don't have any potions to decant!";
	}

	const { potionsToAdd, potionsToRemove } = res;
	if (!user.owns(potionsToRemove)) {
		return `You don't own ${potionsToRemove}.`;
	}

	await user.transactItems({
		filterLoot: false,
		itemsToRemove: potionsToRemove,
		itemsToAdd: potionsToAdd
	});

	if (user.hasEquipped(['Iron dagger', 'Bronze arrow']) && !user.hasEquippedOrInBank('Clue hunter gloves')) {
		await user.addItemsToBank({ items: new Bank({ 'Clue hunter gloves': 1 }), collectionLog: true });
	}

	return formatDecantReply(results, dose);
}
