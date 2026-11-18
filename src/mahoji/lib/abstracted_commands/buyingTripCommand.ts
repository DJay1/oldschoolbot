import { Time } from '@oldschoolgg/toolkit';
import { Bank, EItem, Items } from 'oldschooljs';

import {
	cosmicRuneBuyPerHour,
	cosmicRuneDailyLimit,
	formatCosmicRuneBuyLimitMessage,
	formatCosmicRunePurchaseNote,
	isCosmicRuneBuyName
} from '@/lib/data/buyables/skillingSupplyLimits.js';
import type { TripBuyable } from '@/lib/data/buyables/tripBuyables.js';
import { QuestID } from '@/lib/minions/data/quests.js';
import { applyBuyCostSellFloor } from '@/lib/util/buySellFloor.js';
import { calculateShopBuyCost } from '@/lib/util/calculateShopBuyCost.js';
import { dailyBuyLimitMessage, peekDailyBuyRemaining, runWithBuyDailyLimit } from '@/lib/util/runWithBuyDailyLimit.js';
import { MAX_QUANTITY, safePositiveProduct, validateQuantity } from '@/lib/util/validateQuantity.js';

function tripBuyLimitMessage(
	itemDisplayName: string,
	requested: number,
	state: { remaining: number; dailyLimit: number; resetAtSeconds: number | null },
	hasLunarDiplomacy: boolean
): string {
	if (isCosmicRuneBuyName(itemDisplayName)) {
		return formatCosmicRuneBuyLimitMessage({
			requested,
			dailyLimit: state.dailyLimit,
			remaining: state.remaining,
			resetAtSeconds: state.resetAtSeconds,
			hasLunarDiplomacy
		});
	}
	return dailyBuyLimitMessage(itemDisplayName, requested, state);
}

export async function buyingTripCommand(
	user: MUser,
	buyable: TripBuyable,
	quantity: number | null,
	interaction: MInteraction
) {
	const hasLunarDiplomacy = user.user.finished_quest_ids.includes(QuestID.LunarDiplomacy);
	let quantityPerHour = buyable.quantityPerHour!;

	if (buyable.item === EItem.COAL && user.owns('Coal bag')) {
		quantityPerHour *= 1.6;
	}
	if (buyable.item === EItem.COSMIC_RUNE) {
		quantityPerHour = cosmicRuneBuyPerHour(hasLunarDiplomacy);
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

	const dailyLimitOverride = buyable.item === EItem.COSMIC_RUNE ? cosmicRuneDailyLimit(hasLunarDiplomacy) : undefined;
	const dailyState = await peekDailyBuyRemaining(user.id, itemDisplayName, dailyLimitOverride);
	if (dailyState) {
		if (userSpecifiedQuantity) {
			if (quantity > dailyState.remaining) {
				return tripBuyLimitMessage(itemDisplayName, quantity, dailyState, hasLunarDiplomacy);
			}
		} else if (dailyState.remaining <= 0) {
			return tripBuyLimitMessage(itemDisplayName, quantity, dailyState, hasLunarDiplomacy);
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
	return runWithBuyDailyLimit(
		user.id,
		itemDisplayName,
		quantity,
		async ({ commit }) => {
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
			let message = `You purchased ${loot}. This cost ${totalCost.toLocaleString()} GP (avg ${displayAverage.toLocaleString()} ea).`;
			if (buyable.item === EItem.COSMIC_RUNE && dailyState) {
				message += ` ${formatCosmicRunePurchaseNote({
					remaining: Math.max(0, dailyState.remaining - quantity),
					dailyLimit: dailyState.dailyLimit,
					hasLunarDiplomacy
				})}`;
			}
			return message;
		},
		dailyLimitOverride
	);
}
