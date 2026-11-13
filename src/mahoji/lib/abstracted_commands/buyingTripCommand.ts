import { Time } from '@oldschoolgg/toolkit';
import { Bank, EItem, Items } from 'oldschooljs';

import type { TripBuyable } from '@/lib/data/buyables/tripBuyables.js';
import { applyBuyCostSellFloor } from '@/lib/util/buySellFloor.js';
import { calculateShopBuyCost } from '@/lib/util/calculateShopBuyCost.js';
import { dailyBuyLimitMessage, peekDailyBuyRemaining, runWithBuyDailyLimit } from '@/lib/util/runWithBuyDailyLimit.js';
import { MAX_QUANTITY, safePositiveProduct, validateQuantity } from '@/lib/util/validateQuantity.js';

export async function buyingTripCommand(
	user: MUser,
	buyable: TripBuyable,
	quantity: number | null,
	interaction: MInteraction
) {
	let quantityPerHour = buyable.quantityPerHour!;

	if (buyable.item === EItem.COAL && user.owns('Coal bag')) {
		quantityPerHour *= 1.6;
	}

	const timePerItem = Time.Hour / quantityPerHour;
	const osItem = Items.getOrThrow(buyable.item);
	const itemDisplayName = buyable.displayName ?? osItem.name;
	const itemQuantity = buyable.quantity ?? 1;
	const gpCost = buyable.gpCost ?? 0;
	const userSpecifiedQuantity = quantity !== null && quantity !== undefined;

	if (quantity === null || quantity === undefined) {
		const maxTripLength = await user.calcMaxTripLength('Buy');
		quantity = Math.floor(maxTripLength / timePerItem);
	}
	const parsedQuantity = validateQuantity(quantity, { min: 1, max: MAX_QUANTITY });
	if (!parsedQuantity.ok) return parsedQuantity.error;
	quantity = parsedQuantity.value;

	const dailyState = await peekDailyBuyRemaining(user.id, itemDisplayName);
	if (dailyState) {
		if (userSpecifiedQuantity) {
			if (quantity > dailyState.remaining) {
				return dailyBuyLimitMessage(itemDisplayName, quantity, dailyState);
			}
		} else if (dailyState.remaining <= 0) {
			return dailyBuyLimitMessage(itemDisplayName, quantity, dailyState);
		} else {
			quantity = Math.min(quantity, dailyState.remaining);
		}
	}

	let { totalCost, averageCost } = calculateShopBuyCost({
		gpCost,
		quantity,
		shopQuantity: buyable.shopQuantity,
		changePer: buyable.changePer
	});
	if (!Number.isSafeInteger(totalCost) || totalCost < 0 || !Number.isSafeInteger(averageCost) || averageCost < 0) {
		return 'That quantity is too large.';
	}

	const lootQty = safePositiveProduct(itemQuantity, quantity, Number.MAX_SAFE_INTEGER);
	if (!lootQty.ok) return lootQty.error;

	const loot = new Bank().add(osItem.id, lootQty.value);
	totalCost = applyBuyCostSellFloor(totalCost, loot);
	const displayAverage = Math.floor(totalCost / quantity);
	if (
		!Number.isSafeInteger(totalCost) ||
		totalCost < 0 ||
		!Number.isSafeInteger(displayAverage) ||
		displayAverage < 0
	) {
		return 'That quantity is too large.';
	}

	const cost = new Bank().add('Coins', totalCost);
	return runWithBuyDailyLimit(user.id, itemDisplayName, quantity, async ({ commit }) => {
		if (!user.owns(cost)) {
			return `You need ${cost} to buy ${quantity}x ${itemDisplayName}.`;
		}

		await interaction.confirmation(
			`Buying ${quantity}x ${itemDisplayName} will cost ${totalCost.toLocaleString()} GP (avg ${displayAverage.toLocaleString()} ea). Please confirm.`
		);

		await user.transactItems({
			itemsToRemove: cost,
			itemsToAdd: loot,
			collectionLog: false
		});
		await ClientSettings.updateBankSetting('buy_cost_bank', cost);
		await ClientSettings.updateBankSetting('buy_loot_bank', loot);

		commit();
		return `You purchased ${loot}. This cost ${totalCost.toLocaleString()} GP (avg ${displayAverage.toLocaleString()} ea).`;
	});
}
