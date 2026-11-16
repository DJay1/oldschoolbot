import { stringMatches } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import { TfaItem } from '@/lib/bsc/tfa/tfaItems.js';
import { type DegradeableItem, degradeableItems } from '@/lib/degradeableItems.js';

/** Charged TFA items that can be uncharged for a refund (the folio's charges can't be refunded, as in OSRS). */
export const TFA_UNCHARGEABLE = [TfaItem.OBLIGATOR_CHARGED, TfaItem.ZORYAS_TOME_CHARGED] as const;

/**
 * Works out what uncharging gives back. Only whole charge units are refunded, so for the
 * Obligator (30 charges per shard) any leftover below 30 charges is lost, like OSRS warns about.
 */
export function tfaUnchargeRefund(degItem: DegradeableItem, charges: number) {
	const units = Math.floor(Math.max(0, charges) / degItem.chargeInput.charges);
	const refund = units > 0 ? degItem.chargeInput.cost.clone().multiply(units) : new Bank();
	const lostCharges = Math.max(0, charges) - units * degItem.chargeInput.charges;
	return { refund, lostCharges };
}

export async function tfaUnchargeCommand(interaction: MInteraction, user: MUser, input: string | undefined) {
	const degItem = degradeableItems.find(
		i =>
			(TFA_UNCHARGEABLE as readonly number[]).includes(i.item.id) &&
			[i.item.name, ...i.aliases].some(n => stringMatches(n, input ?? ''))
	);
	if (!degItem || !degItem.unchargedItem) {
		return "You can uncharge these items: Obligator, Zorya's tome.";
	}
	if (await user.minionIsBusy()) return "Your minion is busy, you can't uncharge items right now.";
	await user.sync();
	if (!user.bank.has(degItem.item.id)) {
		return `You need your ${degItem.item.name} in your bank to uncharge it (unequip it first).`;
	}
	const charges = user.user[degItem.settingsKey];
	const { refund, lostCharges } = tfaUnchargeRefund(degItem, charges);

	await interaction.confirmation(
		`Uncharge your ${degItem.item.name} (${charges.toLocaleString()} charges)? You'll get back ${
			refund.length > 0 ? refund : 'nothing'
		} and a ${degItem.unchargedItem.name}.${
			lostCharges > 0 ? ` ${lostCharges} leftover charges can't be refunded and will be lost.` : ''
		}`
	);

	await user.sync();
	if (await user.minionIsBusy()) return "Your minion is busy, you can't uncharge items right now.";
	if (!user.bank.has(degItem.item.id)) return `You no longer have a ${degItem.item.name} in your bank.`;
	if (user.user[degItem.settingsKey] !== charges) {
		return 'Your charges changed while confirming, please try again.';
	}

	// One transaction: the charged item is removed, the uncharged item and refund added, and charges set to 0.
	await user.transactItems({
		itemsToRemove: new Bank().add(degItem.item.id),
		itemsToAdd: new Bank().add(degItem.unchargedItem.id).add(refund),
		otherUpdates: { [degItem.settingsKey]: 0 }
	});

	return `You uncharged your ${degItem.item.name} and received ${new Bank()
		.add(degItem.unchargedItem.id)
		.add(refund)}.`;
}
