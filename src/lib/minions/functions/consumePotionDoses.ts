import { Time } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import Potions from '@/lib/minions/data/potions.js';
import type { Consumable } from '@/lib/minions/types.js';

export type PotionFamily = { name: string; items: number[] };

export function potionFamilyForItem(itemId: number): PotionFamily | null {
	return Potions.find(p => p.items.includes(itemId)) ?? null;
}

export function doseCountForItem(itemId: number): number | null {
	const family = potionFamilyForItem(itemId);
	if (!family) return null;
	const idx = family.items.indexOf(itemId);
	return idx === -1 ? null : idx + 1;
}

export function totalDosesInBank(bank: Bank, family: PotionFamily): number {
	let total = 0;
	for (let i = 0; i < family.items.length; i++) {
		total += bank.amount(family.items[i]) * (i + 1);
	}
	return total;
}

export function vialsForDoses(family: PotionFamily, doses: number): Bank {
	const bank = new Bank();
	if (doses <= 0) return bank;
	const maxDose = family.items.length;
	const full = Math.floor(doses / maxDose);
	const rem = doses % maxDose;
	if (full > 0) bank.add(family.items[maxDose - 1], full);
	if (rem > 0) bank.add(family.items[rem - 1], 1);
	return bank;
}

export function dosesInConsumableCost(itemCost: Bank): { family: PotionFamily; dosesPerUnit: number } | null {
	const items = itemCost.items();
	if (items.length !== 1) return null;
	const [item, qty] = items[0];
	const family = potionFamilyForItem(item.id);
	const dose = doseCountForItem(item.id);
	if (!family || !dose) return null;
	return { family, dosesPerUnit: dose * qty };
}

export function dosesNeededForConsumable(c: Consumable, quantity: number, duration: number): number | null {
	const info = dosesInConsumableCost(c.itemCost);
	if (!info) return null;
	let units = 0;
	if (c.qtyPerKill) {
		units = c.qtyPerKill * quantity;
	} else if (c.qtyPerMinute) {
		units = (c.qtyPerMinute * duration) / Time.Minute;
	} else {
		return null;
	}
	return Math.ceil(units * info.dosesPerUnit);
}

/**
 * Consume exact `dosesNeeded` from a potion family in `bank`.
 * Uses smaller vials first, then opens a larger vial and returns leftover doses
 * as (3)/(2)/(1). Net doses decrease by exactly dosesNeeded. Returns null if
 * the bank does not have enough doses.
 */
export function consumePotionDoses(
	bank: Bank,
	family: PotionFamily,
	dosesNeeded: number
): { itemsToRemove: Bank; itemsToAdd: Bank } | null {
	if (dosesNeeded <= 0) return { itemsToRemove: new Bank(), itemsToAdd: new Bank() };
	if (totalDosesInBank(bank, family) < dosesNeeded) return null;

	const itemsToRemove = new Bank();
	const itemsToAdd = new Bank();
	let remaining = dosesNeeded;

	for (let dose = 1; dose <= family.items.length; dose++) {
		const itemId = family.items[dose - 1];
		const have = bank.amount(itemId);
		if (have <= 0 || dose > remaining) continue;
		const take = Math.min(have, Math.floor(remaining / dose));
		if (take > 0) {
			itemsToRemove.add(itemId, take);
			remaining -= take * dose;
		}
	}

	if (remaining > 0) {
		for (let dose = remaining + 1; dose <= family.items.length; dose++) {
			const itemId = family.items[dose - 1];
			const available = bank.amount(itemId) - itemsToRemove.amount(itemId);
			if (available <= 0) continue;
			itemsToRemove.add(itemId, 1);
			const leftover = dose - remaining;
			if (leftover > 0) {
				itemsToAdd.add(family.items[leftover - 1], 1);
			}
			remaining = 0;
			break;
		}
	}

	if (remaining > 0) return null;
	return { itemsToRemove, itemsToAdd };
}

export function netDoseChange(
	bank: Bank,
	family: PotionFamily,
	plan: { itemsToRemove: Bank; itemsToAdd: Bank }
): number {
	const next = bank.clone().remove(plan.itemsToRemove).add(plan.itemsToAdd);
	return totalDosesInBank(next, family) - totalDosesInBank(bank, family);
}

export function pickDoseConsumable({
	options,
	bank,
	quantity,
	duration
}: {
	options: Consumable[];
	bank: Bank;
	quantity: number;
	duration: number;
}): { consumable: Consumable; family: PotionFamily; dosesNeeded: number } | null {
	const doseOptions = options.filter(c => c.consumeByDose);
	if (doseOptions.length === 0) return null;

	for (const consumable of doseOptions) {
		const info = dosesInConsumableCost(consumable.itemCost);
		const dosesNeeded = dosesNeededForConsumable(consumable, quantity, duration);
		if (!info || dosesNeeded === null) continue;
		if (totalDosesInBank(bank, info.family) >= dosesNeeded) {
			return { consumable, family: info.family, dosesNeeded };
		}
	}

	const fallback = doseOptions[0];
	const info = dosesInConsumableCost(fallback.itemCost);
	const dosesNeeded = dosesNeededForConsumable(fallback, quantity, duration);
	if (!info || dosesNeeded === null) return null;
	return { consumable: fallback, family: info.family, dosesNeeded };
}
