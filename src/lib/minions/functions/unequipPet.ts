import { Bank, Items, itemID } from 'oldschooljs';

import { busyBlocksUnequipOrSwap } from '@/lib/minions/functions/petActivityGuards.js';

export async function unequipPet(user: MUser) {
	const equippedPet = user.user.minion_equippedPet;
	if (!equippedPet) return "You don't have a pet equipped.";
	const busyReason = busyBlocksUnequipOrSwap(await user.minionIsBusy(), equippedPet);
	if (busyReason) return busyReason;

	const loot = new Bank().add(equippedPet);

	await user.transactItems({
		itemsToAdd: loot,
		collectionLog: false,
		otherUpdates: {
			minion_equippedPet: null
		}
	});

	if (equippedPet === itemID('Wubufu')) {
		return `🐋 You have been dragging that poor... thing around behind you for how long?!?  Well it's no use to anyone anymore, let's throw it away. *Discards ${new Bank().add('Wubufu')}*`;
	}

	return `${user.minionName} picks up their ${Items.itemNameFromId(equippedPet)} pet and places it back in their bank.`;
}
