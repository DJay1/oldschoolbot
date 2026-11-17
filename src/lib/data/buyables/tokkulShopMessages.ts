import { formatDuration, Time } from '@oldschoolgg/toolkit';

import {
	type TokkulShopBuyer,
	type TokkulShopItem,
	tokkulGemBuyTime,
	tokkulShopBuyDuration,
	tokkulShopMaxBuyable,
	tokkulShopStockFor
} from '@/lib/data/buyables/tokkulBuyables.js';

/** Player-facing explanations for /tokkulshop: why something can't be bought, or is slower, and how to fix it. */

const JAD_BUYER = (buyer: TokkulShopBuyer): TokkulShopBuyer => ({ ...buyer, hasKilledJad: true });
const secs = (ms: number) => `${Number((ms / Time.Second).toFixed(2))}s`;
const fmt = (n: number) => n.toLocaleString();

/** How fast the shop supplies this item for the buyer, e.g. "1.5s each" or "2 per minute". */
function rateText(item: TokkulShopItem, buyer: TokkulShopBuyer): string | null {
	const gem = tokkulGemBuyTime(item, buyer);
	if (gem !== null) return `${secs(gem)} each`;
	const stock = tokkulShopStockFor(item, buyer);
	return stock ? `${fmt(stock)} per minute` : null;
}

/** Why this player can't buy the item at all, or null if they can. */
export function tokkulShopBlockedMessage(item: TokkulShopItem, buyer: TokkulShopBuyer): string | null {
	if (!item.tokkulCost || !item.diaryTokkulCost) {
		return `The TzHaar shops don't sell ${item.name}. You can only sell it to them.`;
	}
	if (tokkulShopStockFor(item, buyer)) return null;
	const afterJad = rateText(item, JAD_BUYER(buyer));
	if (!buyer.hasKilledJad && afterJad) {
		const stockNote =
			buyer.isIronman && item.rinIMShopStock && tokkulGemBuyTime(item, buyer) === null ? ' (ironman stock)' : '';
		return `You can't buy ${item.name} yet. Only TzHaar-Hur-Rin's Ore and Gem Store in Mor Ul Rek sells it, and you need to defeat TzTok-Jad to get in. Kill TzTok-Jad once with \`/activities fight_caves\`, then you can buy ${item.name} at ${afterJad}${stockNote}.`;
	}
	return `The TzHaar shops don't stock ${item.name}.`;
}

/** Note for a buy that works but would be faster after a TzTok-Jad kill, or null. */
export function tokkulShopJadNote(item: TokkulShopItem, buyer: TokkulShopBuyer, quantity: number): string | null {
	if (buyer.hasKilledJad) return null;
	const now = tokkulShopBuyDuration(item, buyer, quantity);
	const withJad = tokkulShopBuyDuration(item, JAD_BUYER(buyer), quantity);
	if (now === null || withJad === null || withJad >= now) return null;
	const rateNow = rateText(item, buyer);
	const rateJad = rateText(item, JAD_BUYER(buyer));
	const what =
		tokkulGemBuyTime(item, buyer) !== null ? `each ${item.name} takes` : `the shop restocks ${item.name} at`;
	return `No TzTok-Jad kill yet, so ${what} ${rateNow}. After a Jad kill it's ${rateJad}, so this trip would take ${formatDuration(withJad)} instead of ${formatDuration(now)}.`;
}

/** Karamja diary price note for a buy or sell, or null if there's no difference. */
export function tokkulShopDiaryNote(
	item: TokkulShopItem,
	action: 'buy' | 'sell',
	hasKaramjaDiary: boolean
): string | null {
	if (action === 'buy') {
		if (!item.tokkulCost || !item.diaryTokkulCost || item.diaryTokkulCost >= item.tokkulCost) return null;
		return hasKaramjaDiary
			? `Karamja diary discount: ${fmt(item.diaryTokkulCost)} Tokkul each instead of ${fmt(item.tokkulCost)}.`
			: `Finish the Karamja easy diary to pay ${fmt(item.diaryTokkulCost)} Tokkul each instead of ${fmt(item.tokkulCost)}.`;
	}
	if (!item.diaryTokkulReturn || item.diaryTokkulReturn <= item.tokkulReturn) return null;
	return hasKaramjaDiary
		? `Karamja diary bonus: ${fmt(item.diaryTokkulReturn)} Tokkul each instead of ${fmt(item.tokkulReturn)}.`
		: `Finish the Karamja easy diary to get ${fmt(item.diaryTokkulReturn)} Tokkul each instead of ${fmt(item.tokkulReturn)}.`;
}

/** Explains a trip that's over the max trip length: how long it would take, why, and the most that fits. */
export function tokkulShopTooLongMessage(opts: {
	item: TokkulShopItem;
	buyer: TokkulShopBuyer;
	action: 'buy' | 'sell';
	quantity: number;
	duration: number;
	maxTripLength: number;
	maxCanTransact: number;
}): string {
	const { item, buyer, action, quantity, duration, maxTripLength, maxCanTransact } = opts;
	const verb = action === 'buy' ? 'Buying' : 'Selling';
	let out = `That's too many for one trip. ${verb} ${fmt(quantity)}x ${item.name} would take ${formatDuration(duration)}, but your max trip length is ${formatDuration(maxTripLength)}.`;
	if (action === 'buy') {
		const gem = tokkulGemBuyTime(item, buyer);
		const stock = tokkulShopStockFor(item, buyer);
		out +=
			gem !== null
				? ` Each ${item.name} takes ${secs(gem)} to buy.`
				: ` The shop only restocks ${fmt(stock ?? 0)} ${item.name} per minute.`;
	} else {
		out += ' Selling takes 0.02s per item.';
	}
	out += ` The most you can ${action} in one trip is ${fmt(maxCanTransact)}.`;
	if (action === 'buy' && !buyer.hasKilledJad) {
		const withJad = tokkulShopMaxBuyable(item, JAD_BUYER(buyer), maxTripLength);
		if (withJad > maxCanTransact) out += ` After a TzTok-Jad kill you could buy up to ${fmt(withJad)} per trip.`;
	}
	return out;
}
