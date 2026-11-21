import { reduceNumByPercent, Time } from '@oldschoolgg/toolkit';
import { Bank, EItem, itemID } from 'oldschooljs';

import { getSimilarItems } from '@/lib/data/similarItems.js';
import {
	consumePotionDoses,
	dosesInConsumableCost,
	type PotionFamily,
	pickDoseConsumable,
	totalDosesInBank,
	vialsForDoses
} from '@/lib/minions/functions/consumePotionDoses.js';
import type { Consumable } from '@/lib/minions/types.js';
import { FloatBank } from '@/lib/structures/Bank.js';
import type { GearBank } from '@/lib/structures/GearBank.js';

// TODO: should use a FloatBank instead of a Bank
const calculateTripConsumableCost = (c: Consumable, quantity: number, duration: number) => {
	const consumableCost = c.itemCost.clone();
	if (c.qtyPerKill) {
		consumableCost.multiply(Math.ceil(c.qtyPerKill * quantity));
	} else if (c.qtyPerMinute) {
		consumableCost.multiply(Math.ceil((c.qtyPerMinute * duration) / Time.Minute));
	}
	return consumableCost;
};

export function getItemCostFromConsumables({
	consumableCosts,
	gearBank,
	timeToFinish,
	maxTripLength,
	inputQuantity,
	slayerKillsRemaining
}: {
	timeToFinish: number;
	consumableCosts: Consumable[];
	gearBank: GearBank;
	maxTripLength: number;
	inputQuantity: number | undefined;
	slayerKillsRemaining: number | null;
}) {
	const quantity = inputQuantity ?? Math.floor(maxTripLength / timeToFinish);
	const duration = timeToFinish * quantity;
	const floatCostsPerKill = new FloatBank();
	const boosts: { message: string; boostPercent: number }[] = [];
	const dosePlans: { family: PotionFamily; dosesPerKill: number }[] = [];

	for (const cc of consumableCosts) {
		const flatConsumables = [cc, ...(cc.alternativeConsumables ?? [])];
		if (flatConsumables.some(c => c.consumeByDose)) {
			const picked = pickDoseConsumable({
				options: flatConsumables,
				bank: gearBank.bank,
				quantity,
				duration
			});
			if (cc.optional && !picked) {
				continue;
			}
			const chosen =
				picked ??
				pickDoseConsumable({
					options: flatConsumables.filter(c => !c.optional),
					bank: new Bank(),
					quantity,
					duration
				});
			if (!chosen) continue;

			const info = dosesInConsumableCost(chosen.consumable.itemCost);
			if (!info) continue;
			const itemMultiple = chosen.consumable.qtyPerKill ?? chosen.consumable.qtyPerMinute ?? null;
			if (!itemMultiple) continue;
			const unitsPerKill = chosen.consumable.qtyPerMinute
				? (timeToFinish / Time.Minute) * itemMultiple
				: itemMultiple;
			dosePlans.push({ family: info.family, dosesPerKill: unitsPerKill * info.dosesPerUnit });
			if (chosen.consumable.boostPercent) {
				timeToFinish = reduceNumByPercent(timeToFinish, chosen.consumable.boostPercent);
				boosts.push({
					message: `${chosen.consumable.boostPercent}% for ${chosen.consumable.itemCost
						.items()
						.map(i => i[0].name)
						.join(', ')}`,
					boostPercent: chosen.consumable.boostPercent
				});
			}
			continue;
		}

		const consumable =
			flatConsumables.find(c => gearBank.bank.has(calculateTripConsumableCost(c, quantity, duration))) ?? cc;
		if (consumable.optional && !gearBank.bank.has(calculateTripConsumableCost(cc, quantity, duration))) {
			continue;
		}

		let itemMultiple = consumable.qtyPerKill ?? consumable.qtyPerMinute ?? null;
		if (itemMultiple) {
			if (consumable.isRuneCost) {
				// Free casts for kodai + sotd
				if (gearBank.hasEquipped('Kodai wand')) {
					itemMultiple = Math.ceil(0.85 * itemMultiple);
				} else if (gearBank.hasEquipped('Staff of the dead')) {
					itemMultiple = Math.ceil((6 / 7) * itemMultiple);
				}
			}

			const multiply = consumable.qtyPerMinute ? (timeToFinish / Time.Minute) * itemMultiple : itemMultiple;

			for (const [item, qty] of consumable.itemCost.items()) {
				floatCostsPerKill.add(item.id, qty * multiply);
			}
			if (consumable.boostPercent) {
				timeToFinish = reduceNumByPercent(timeToFinish, consumable.boostPercent);
				boosts.push({
					message: `${consumable.boostPercent}% for ${consumable.itemCost
						.items()
						.map(i => i[0].name)
						.join(', ')}`,
					boostPercent: consumable.boostPercent
				});
			}
		}
	}

	const hasInfiniteWaterRunes = gearBank.hasEquipped(getSimilarItems(itemID('Staff of water')), false);

	if (hasInfiniteWaterRunes) {
		floatCostsPerKill.remove(EItem.WATER_RUNE, floatCostsPerKill.amount(EItem.WATER_RUNE));
	}

	const maxBasedOnTime = Math.floor(maxTripLength / timeToFinish);
	const itemFits =
		consumableCosts.length === 0
			? Number.POSITIVE_INFINITY
			: floatCostsPerKill.length() === 0
				? Number.POSITIVE_INFINITY
				: Math.floor(floatCostsPerKill.fits(gearBank.bank));
	const doseFits = dosePlans.reduce((max, plan) => {
		if (plan.dosesPerKill <= 0) return max;
		return Math.min(max, Math.floor(totalDosesInBank(gearBank.bank, plan.family) / plan.dosesPerKill));
	}, Number.POSITIVE_INFINITY);
	const maxCanKillWithItemCost = Math.min(itemFits, doseFits);
	const maxAllowed = Math.min(maxBasedOnTime, maxCanKillWithItemCost);
	let finalQuantity = Math.max(1, inputQuantity ? Math.min(inputQuantity, maxAllowed) : maxAllowed) ?? maxAllowed;
	if (slayerKillsRemaining && finalQuantity > slayerKillsRemaining) {
		finalQuantity = slayerKillsRemaining;
	}
	const itemCost = floatCostsPerKill.multiply(finalQuantity).toItemBankRoundedUp();
	const itemRefund = new Bank();
	const finalDuration = timeToFinish * finalQuantity;

	for (const cc of consumableCosts) {
		const flatConsumables = [cc, ...(cc.alternativeConsumables ?? [])];
		if (!flatConsumables.some(c => c.consumeByDose)) continue;
		const picked = pickDoseConsumable({
			options: flatConsumables,
			bank: gearBank.bank,
			quantity: finalQuantity,
			duration: finalDuration
		});
		if (cc.optional && !picked) continue;
		const chosen =
			picked ??
			pickDoseConsumable({
				options: flatConsumables.filter(c => !c.optional),
				bank: new Bank(),
				quantity: finalQuantity,
				duration: finalDuration
			});
		if (!chosen) continue;
		const plan = consumePotionDoses(gearBank.bank, chosen.family, chosen.dosesNeeded);
		if (plan) {
			itemCost.add(plan.itemsToRemove);
			itemRefund.add(plan.itemsToAdd);
		} else {
			itemCost.add(vialsForDoses(chosen.family, chosen.dosesNeeded));
		}
	}

	if (consumableCosts.length === 0) {
		return {
			finalQuantity,
			timeToFinish
		};
	}

	return {
		itemCost,
		itemRefund: itemRefund.length > 0 ? itemRefund : undefined,
		finalQuantity,
		boosts,
		timeToFinish
	};
}
