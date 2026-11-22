import { transactMaterialsFromUser } from '@/lib/bso/skills/invention/inventions.js';
import type { MaterialBank } from '@/lib/bso/skills/invention/MaterialBank.js';

import { isFunction, reduceNumByPercent } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import type { Createable } from '@/lib/data/createables.js';
import { MAX_QUANTITY } from '@/lib/util/validateQuantity.js';

export type CreateAction = 'create' | 'revert' | 'fix' | 'unpack';

export function createActionOf(name: string): CreateAction {
	for (const act of ['revert', 'fix', 'unpack'] as const) {
		if (name.toLowerCase().startsWith(act)) return act;
	}
	return 'create';
}

/** One-time or uniqueness recipes stay at 1 when quantity is omitted. */
export function createQuantityStaysOne(item: Createable): boolean {
	return Boolean(item.cantHaveItems);
}

export function unitCreateRecipe(user: MUser, item: Createable) {
	const outItems = new Bank(isFunction(item.outputItems) ? item.outputItems(user) : item.outputItems);
	const inItems = isFunction(item.inputItems) ? item.inputItems(user) : new Bank(item.inputItems);
	const gpCost = item.GPCost ?? 0;
	const materialCost = item.materialCost ? item.materialCost.clone() : null;
	if (materialCost?.has('wooden') && item.name === 'Potion of light' && user.skillsAsXP.firemaking >= 500_000_000) {
		materialCost.bank.wooden = Math.ceil(reduceNumByPercent(materialCost.bank.wooden!, 20));
	}
	return { inItems, outItems, gpCost, materialCost };
}

function maxFromMaterials(owned: MaterialBank, unit: MaterialBank): number {
	let max = MAX_QUANTITY;
	for (const [type, quantity] of Object.entries(unit.bank)) {
		if (typeof quantity !== 'number' || quantity <= 0) continue;
		max = Math.min(max, Math.floor(owned.amount(type as keyof typeof unit.bank) / quantity));
	}
	return max;
}

/**
 * How many of this createable the user can make right now.
 *
 * - `cantHaveItems` recipes stay at 1 (or 0 if they already have the unique item).
 * - `maxCanOwn` caps at how many more they're allowed to have.
 * - Bank items, GP (`GPCost` and coins in the recipe), and invention materials all limit the count.
 * - If the recipe has no spendable inputs, returns 1 so we don't invent a huge bulk create.
 */
export function maxCreatableQuantity(user: MUser, item: Createable): number {
	if (item.cantHaveItems) {
		const allItemsOwnedBank = user.allItemsOwned;
		for (const [itemID, qty] of Object.entries(item.cantHaveItems)) {
			if (allItemsOwnedBank.amount(Number(itemID)) >= qty) return 0;
		}
		return 1;
	}

	let max = MAX_QUANTITY;
	let limited = false;

	if (item.maxCanOwn) {
		const owned = user.allItemsOwned.amount(item.name);
		if (owned >= item.maxCanOwn) return 0;
		max = Math.min(max, item.maxCanOwn - owned);
		limited = true;
	}

	const unit = unitCreateRecipe(user, item);
	for (const [it, qty] of unit.inItems.items()) {
		if (qty <= 0) continue;
		const have = it.name === 'Coins' ? user.GP : user.bank.amount(it.id);
		max = Math.min(max, Math.floor(have / qty));
		limited = true;
	}
	if (unit.gpCost > 0) {
		max = Math.min(max, Math.floor(user.GP / unit.gpCost));
		limited = true;
	}
	if (unit.materialCost) {
		max = Math.min(max, maxFromMaterials(user.materialsOwned(), unit.materialCost));
		limited = true;
	}

	if (!limited) return 1;
	if (!Number.isFinite(max) || max < 1) return 0;
	return Math.min(Math.floor(max), MAX_QUANTITY);
}

export function scaledCreateRecipe(user: MUser, item: Createable, quantity: number) {
	const unit = unitCreateRecipe(user, item);
	const inItems = unit.inItems.clone().multiply(quantity);
	const outItems = unit.outItems.clone().multiply(quantity);
	const gpCost = unit.gpCost > 0 ? unit.gpCost * quantity : 0;
	if (gpCost > 0) inItems.add('Coins', gpCost);
	const materialCost = unit.materialCost ? unit.materialCost.clone().multiply(quantity) : null;
	return { inItems, outItems, gpCost, materialCost };
}

export function createAllConfirmLabel(makingAll: boolean, quantity: number): string {
	const label = makingAll ? `Make all (${quantity.toLocaleString()})` : `Make (${quantity.toLocaleString()})`;
	return label.slice(0, 80);
}

export async function removeCreateMaterials(user: MUser, materialCost: MaterialBank | null) {
	if (!materialCost) return;
	await transactMaterialsFromUser({ user, remove: materialCost });
}
