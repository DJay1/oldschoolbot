import { stringMatches } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import type { DegradeableItem } from '@/lib/degradeableItems.js';
import { degradeableItems } from '@/lib/degradeableItems.js';
import { chargeHornOfPlentyCommand, getHornOfPlentyCharges } from '@/lib/skilling/skills/hunter/hornOfPlenty.js';
import { mahojiParseNumber } from '@/mahoji/mahojiSettings.js';

export async function degradeableItemsCommand(
	interaction: MInteraction,
	user: MUser,
	input: string | undefined,
	quantity: number | undefined
): CommandResponse {
	const item = degradeableItems.find(i => [i.item.name, ...i.aliases].some(n => stringMatches(n, input ?? '')));
	const number = mahojiParseNumber({ input: quantity, min: 1, max: 1_000_000 });

	if (input && ['horn of plenty', 'horn'].some(n => stringMatches(n, input))) {
		return chargeHornOfPlentyCommand(interaction, user, number ?? undefined);
	}

	if (!input || !number || !item || number < 1 || number > 100_000) {
		const hornCharges = await getHornOfPlentyCharges(user.id);
		return `Use \`/minion charge item: [${[...degradeableItems.map(i => i.item.name), 'Horn of plenty'].join('|')}] amount:[1-100,000]\`
${degradeableItems
	.map(i => {
		const charges = user.user[i.settingsKey];
		return `${i.item.name}: ${charges.toLocaleString()} charges`;
	})
	.join('\n')}
Horn of plenty: ${hornCharges.toLocaleString()} charges
For Obligator, Zorya's tome and Archivist's folio, the amount is the number of charges to add.`;
	}

	const plan = planDegradeableCharge(item, user.user[item.settingsKey], number);
	if (typeof plan === 'string') return plan;
	const { cost, amountOfCharges } = plan;

	if (!user.owns(cost)) {
		return `You don't own ${cost}.`;
	}

	const needConvert = item.convertOnCharge && item.unchargedItem;
	if (needConvert && !user.hasEquippedOrInBank(item.item.id) && !user.owns(item.unchargedItem!.id)) {
		return `You don't own a ${item.item.name} or ${item.unchargedItem?.name}.`;
	}

	await interaction.confirmation(
		`Are you sure you want to use **${cost}** to add ${amountOfCharges.toLocaleString()} charges to your ${
			item.item.name
		}?`
	);

	if (needConvert && !user.hasEquippedOrInBank(item.item.id)) {
		if (!user.owns(item.unchargedItem!.id)) {
			return `Your ${item.unchargedItem?.name} disappeared and cannot be charged`;
		}
		await user.transactItems({
			filterLoot: false,
			collectionLog: true,
			itemsToAdd: new Bank().add(item.item.id),
			itemsToRemove: new Bank().add(item.unchargedItem?.id).add(cost)
		});
	} else {
		await user.transactItems({ itemsToRemove: cost });
	}
	const currentCharges = user.user[item.settingsKey];
	const newCharges = currentCharges + amountOfCharges;
	await user.update({
		[item.settingsKey]: newCharges
	});
	await ClientSettings.updateBankSetting('degraded_items_cost', cost);

	return `You added **${cost}** to your ${item.item.name}, it now has ${newCharges} charges.`;
}

/**
 * Works out the cost and charges for /minion charge. For items with `amountIsCharges` the amount is the number of
 * charges wanted, rounded up to whole cost units (and down again if that would pass the item's max). For every other
 * item the amount is the number of cost units, as before.
 */
export function planDegradeableCharge(
	item: DegradeableItem,
	currentCharges: number,
	amount: number
): { cost: Bank; amountOfCharges: number; units: number } | string {
	const per = item.chargeInput.charges;
	let units = item.amountIsCharges ? Math.ceil(amount / per) : amount;
	if (item.maxCharges !== undefined) {
		const room = Math.max(0, item.maxCharges - currentCharges);
		if (item.amountIsCharges && units * per > room) units = Math.floor(room / per);
		if (units < 1 || units * per > room) {
			const canAdd = Math.floor(room / per) * per;
			return `Your ${item.item.name} can hold at most ${item.maxCharges.toLocaleString()} charges. It has ${currentCharges.toLocaleString()}, so you can add up to ${canAdd.toLocaleString()} more.`;
		}
	}
	return { cost: item.chargeInput.cost.clone().multiply(units), amountOfCharges: units * per, units };
}
