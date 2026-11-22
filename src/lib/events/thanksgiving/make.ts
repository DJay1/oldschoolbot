import { Bank } from 'oldschooljs';

import { BASKETS_PER_OFFER, BUNDLES_PER_OFFER, isThanksgivingActive, THANKSGIVING_MIN_TRIP_MS } from './core.js';
import { ThanksgivingItem } from './items.js';

export const CORNUCOPIA_CREATE_ITEM = 'Bountiful cornucopia';

export const DISCORD_CONTENT_LIMIT = 2000;
export const DISCORD_BUTTON_LABEL_LIMIT = 80;
export const DISCORD_AUTOCOMPLETE_NAME_LIMIT = 100;
export const DISCORD_LENGTH_BUFFER = 150;

function qty(name: string, n: number): string {
	return `${n.toLocaleString()}x ${name}`;
}

export function isBountifulCornucopiaName(name: string | null | undefined): boolean {
	return (name ?? '').trim().toLowerCase() === CORNUCOPIA_CREATE_ITEM.toLowerCase();
}

export function cornucopiaPartsHeld(bank: Bank): { bundles: number; baskets: number } {
	return {
		bundles: bank.amount(ThanksgivingItem.HARVEST_BUNDLE),
		baskets: bank.amount(ThanksgivingItem.WICKER_BASKET)
	};
}

export function cornucopiaMaxMakeable(bundles: number, baskets: number): number {
	if (!Number.isFinite(bundles) || !Number.isFinite(baskets) || bundles < 0 || baskets < 0) return 0;
	return Math.min(Math.floor(bundles / BUNDLES_PER_OFFER), Math.floor(baskets / BASKETS_PER_OFFER));
}

function leftoverAfter(bundles: number, baskets: number, quantity: number) {
	return {
		leftoverBundles: bundles - quantity * BUNDLES_PER_OFFER,
		leftoverBaskets: baskets - quantity * BASKETS_PER_OFFER
	};
}

function missingToMakeOne(bundles: number, baskets: number) {
	return {
		missingBundles: Math.max(0, BUNDLES_PER_OFFER - bundles),
		missingBaskets: Math.max(0, BASKETS_PER_OFFER - baskets)
	};
}

function formatNeedMore(bundles: number, baskets: number): string {
	const { missingBundles, missingBaskets } = missingToMakeOne(bundles, baskets);
	const bits: string[] = [];
	if (missingBundles > 0) bits.push(qty('Harvest bundle', missingBundles));
	if (missingBaskets > 0) bits.push(qty('Wicker basket', missingBaskets));
	if (bits.length === 0) return 'You need 5 Harvest bundles and 1 Wicker basket to make one.';
	return `You need ${bits.join(' and ')} more to make one.`;
}

function formatLeftover(bundles: number, baskets: number): string {
	const bits: string[] = [];
	if (bundles > 0) bits.push(qty('Harvest bundle', bundles));
	if (baskets > 0) bits.push(qty('Wicker basket', baskets));
	return bits.join(' and ');
}

export type CornucopiaMakeOk = {
	ok: true;
	bundles: number;
	baskets: number;
	maxMakeable: number;
	quantity: number;
	makingAll: boolean;
	reducedFromConfirm: boolean;
	leftoverBundles: number;
	leftoverBaskets: number;
	missingBundles: number;
	missingBaskets: number;
	inItems: Bank;
	outItems: Bank;
};

export type CornucopiaMakeErr = {
	ok: false;
	error: string;
	bundles: number;
	baskets: number;
	maxMakeable: number;
};

export type CornucopiaMakePreview = CornucopiaMakeOk | CornucopiaMakeErr;

export function formatCornucopiaCannotMake(
	bundles: number,
	baskets: number,
	maxMakeable: number,
	requested?: number
): string {
	const held = `You have ${qty('Harvest bundle', bundles)} and ${qty('Wicker basket', baskets)}`;
	if (maxMakeable < 1) {
		return `You don't have enough parts to make a Bountiful cornucopia. ${held}. ${formatNeedMore(bundles, baskets)} (recipe: 5 Harvest bundles + 1 Wicker basket).`;
	}
	const asked = requested !== undefined ? `You asked for ${qty('Bountiful cornucopia', requested)}. ` : '';
	return `${asked}You only have enough parts to make ${qty('Bountiful cornucopia', maxMakeable)}. ${held}. Leave quantity blank to make all ${maxMakeable.toLocaleString()}, or pick a smaller number.`;
}

export function formatCornucopiaPartsChanged(bank: Bank): string {
	const { bundles, baskets } = cornucopiaPartsHeld(bank);
	const maxMakeable = cornucopiaMaxMakeable(bundles, baskets);
	return `Your parts changed, so this make was cancelled. You now have ${qty('Harvest bundle', bundles)} and ${qty('Wicker basket', baskets)} (can make ${maxMakeable.toLocaleString()}).`;
}

function makeOk(
	bundles: number,
	baskets: number,
	quantity: number,
	makingAll: boolean,
	reducedFromConfirm = false
): CornucopiaMakeOk {
	const { leftoverBundles, leftoverBaskets } = leftoverAfter(bundles, baskets, quantity);
	const { missingBundles, missingBaskets } = missingToMakeOne(leftoverBundles, leftoverBaskets);
	return {
		ok: true,
		bundles,
		baskets,
		maxMakeable: cornucopiaMaxMakeable(bundles, baskets),
		quantity,
		makingAll,
		reducedFromConfirm,
		leftoverBundles,
		leftoverBaskets,
		missingBundles,
		missingBaskets,
		inItems: new Bank()
			.add(ThanksgivingItem.HARVEST_BUNDLE, quantity * BUNDLES_PER_OFFER)
			.add(ThanksgivingItem.WICKER_BASKET, quantity * BASKETS_PER_OFFER),
		outItems: new Bank().add(ThanksgivingItem.BOUNTIFUL_CORNUCOPIA, quantity)
	};
}

export function previewCornucopiaMake(bank: Bank, requested?: number): CornucopiaMakePreview {
	const { bundles, baskets } = cornucopiaPartsHeld(bank);
	const maxMakeable = cornucopiaMaxMakeable(bundles, baskets);

	if (requested !== undefined) {
		if (!Number.isSafeInteger(requested) || requested < 1) {
			return {
				ok: false,
				error: 'Quantity must be a whole number of at least 1, or leave it blank to make all.',
				bundles,
				baskets,
				maxMakeable
			};
		}
		if (requested > maxMakeable) {
			return {
				ok: false,
				error: formatCornucopiaCannotMake(bundles, baskets, maxMakeable, requested),
				bundles,
				baskets,
				maxMakeable
			};
		}
		return makeOk(bundles, baskets, requested, requested === maxMakeable);
	}

	if (maxMakeable < 1) {
		return {
			ok: false,
			error: formatCornucopiaCannotMake(bundles, baskets, maxMakeable),
			bundles,
			baskets,
			maxMakeable
		};
	}
	return makeOk(bundles, baskets, maxMakeable, true);
}

export function resolveCornucopiaMakeAfterConfirm(
	bank: Bank,
	requested: number | undefined,
	confirmedQuantity: number
): CornucopiaMakePreview {
	if (requested === undefined) {
		const current = previewCornucopiaMake(bank, undefined);
		if (!current.ok) {
			return {
				...current,
				error: formatCornucopiaPartsChanged(bank)
			};
		}
		const quantity = Math.min(confirmedQuantity, current.quantity);
		if (quantity < 1) {
			return {
				ok: false,
				error: formatCornucopiaPartsChanged(bank),
				bundles: current.bundles,
				baskets: current.baskets,
				maxMakeable: current.maxMakeable
			};
		}
		return makeOk(current.bundles, current.baskets, quantity, true, quantity < confirmedQuantity);
	}

	const current = previewCornucopiaMake(bank, requested);
	if (!current.ok) {
		return {
			...current,
			error: formatCornucopiaPartsChanged(bank)
		};
	}
	return current;
}

export function formatCornucopiaConfirmLabel(preview: CornucopiaMakeOk): string {
	const label = preview.makingAll
		? `Make all (${preview.quantity.toLocaleString()})`
		: `Make (${preview.quantity.toLocaleString()})`;
	return label.slice(0, DISCORD_BUTTON_LABEL_LIMIT);
}

export function formatCornucopiaMakeConfirm(preview: CornucopiaMakeOk): { content: string; confirmLabel: string } {
	const leftoverAfterAll = formatLeftover(
		preview.bundles - preview.maxMakeable * BUNDLES_PER_OFFER,
		preview.baskets - preview.maxMakeable * BASKETS_PER_OFFER
	);
	const allBit = leftoverAfterAll
		? `all = ${qty('Bountiful cornucopia', preview.maxMakeable)}, leftover ${leftoverAfterAll}`
		: `all = ${qty('Bountiful cornucopia', preview.maxMakeable)}`;
	const lines = [
		`You have ${qty('Harvest bundle', preview.bundles)} and ${qty('Wicker basket', preview.baskets)} (${allBit}).`,
		`Make ${qty('Bountiful cornucopia', preview.quantity)} using ${qty('Harvest bundle', preview.quantity * BUNDLES_PER_OFFER)} and ${qty('Wicker basket', preview.quantity * BASKETS_PER_OFFER)}?`
	];
	if (!preview.makingAll) {
		const leftover = formatLeftover(preview.leftoverBundles, preview.leftoverBaskets);
		const more = preview.maxMakeable - preview.quantity;
		lines.push(
			leftover
				? `After that you'd have ${leftover} left (enough for ${more.toLocaleString()} more).`
				: `After that you'd have enough for ${more.toLocaleString()} more.`
		);
	}
	return { content: lines.join('\n'), confirmLabel: formatCornucopiaConfirmLabel(preview) };
}

export function formatCornucopiaMakeSuccess(preview: CornucopiaMakeOk, confirmedQuantity: number): string {
	const reduced = preview.reducedFromConfirm
		? ` You had fewer parts than when you confirmed, so ${preview.quantity.toLocaleString()} were made instead of ${confirmedQuantity.toLocaleString()}.`
		: '';
	return `You received ${preview.outItems}.${reduced}`;
}

export function formatThanksgivingPartsLine(bank: Bank): string {
	const { bundles, baskets } = cornucopiaPartsHeld(bank);
	const cornucopias = bank.amount(ThanksgivingItem.BOUNTIFUL_CORNUCOPIA);
	return `**Parts:** ${qty('Harvest bundle', bundles)} · ${qty('Wicker basket', baskets)} · ${qty('Bountiful cornucopia', cornucopias)}`;
}

export function formatCornucopiaCanMakeLine(bank: Bank): string {
	const { bundles, baskets } = cornucopiaPartsHeld(bank);
	const maxMakeable = cornucopiaMaxMakeable(bundles, baskets);
	if (maxMakeable >= 1) {
		const leftover = formatLeftover(
			bundles - maxMakeable * BUNDLES_PER_OFFER,
			baskets - maxMakeable * BASKETS_PER_OFFER
		);
		return leftover
			? `Can make: ${qty('Bountiful cornucopia', maxMakeable)} (leftover ${leftover}).`
			: `Can make: ${qty('Bountiful cornucopia', maxMakeable)}.`;
	}
	return `Can make: 0x Bountiful cornucopia (${formatNeedMore(bundles, baskets)}).`;
}

export function formatCornucopiaOfferEmpty(bank: Bank): string {
	const { bundles, baskets } = cornucopiaPartsHeld(bank);
	const maxMakeable = cornucopiaMaxMakeable(bundles, baskets);
	if (maxMakeable >= 1) {
		return `You don't have any Bountiful cornucopias. You have ${qty('Harvest bundle', bundles)} and ${qty('Wicker basket', baskets)} (can make ${maxMakeable.toLocaleString()}). Leave quantity blank on \`/create item:Bountiful cornucopia\` to make all ${maxMakeable.toLocaleString()}.`;
	}
	return `You don't have any Bountiful cornucopias. You have ${qty('Harvest bundle', bundles)} and ${qty('Wicker basket', baskets)}. ${formatNeedMore(bundles, baskets)} Make one with \`/create item:Bountiful cornucopia\` (5 Harvest bundles + 1 Wicker basket).`;
}

export function formatThanksgivingWindowLine(
	active: boolean,
	start: number | null,
	end: number | null,
	now = Date.now()
): string {
	const base = `**The Straw Hat Harvest** is ${active ? 'running' : 'not running right now'}`;
	if (active && end !== null && now < end) {
		return `${base} (ends <t:${Math.floor(end / 1000)}:R>).`;
	}
	if (!active && start !== null && now < start) {
		return `${base} (starts <t:${Math.floor(start / 1000)}:R>).`;
	}
	return `${base}.`;
}

export function formatCornucopiaCreateAutocompleteName(bank: Bank): string {
	const { bundles, baskets } = cornucopiaPartsHeld(bank);
	const maxMakeable = cornucopiaMaxMakeable(bundles, baskets);
	const name = `${CORNUCOPIA_CREATE_ITEM} (can make ${maxMakeable.toLocaleString()})`;
	return name.slice(0, DISCORD_AUTOCOMPLETE_NAME_LIMIT);
}

export function cornucopiaQuantityChoices(bank: Bank, typed?: number): { name: string; value: number }[] {
	const { bundles, baskets } = cornucopiaPartsHeld(bank);
	const maxMakeable = cornucopiaMaxMakeable(bundles, baskets);
	const choices: { name: string; value: number }[] = [];
	if (typeof typed === 'number' && Number.isSafeInteger(typed) && typed >= 1 && typed !== maxMakeable) {
		choices.push({ name: typed.toLocaleString(), value: typed });
	}
	if (maxMakeable >= 1) {
		choices.push({ name: `All (${maxMakeable.toLocaleString()})`, value: maxMakeable });
	}
	return choices.slice(0, 25);
}

export const THANKS_MAKE_PREFIX = 'THANKS_MAKE:';
export const THANKS_MAKE_OFFER_PREFIX = 'THANKS_MAKE_OFFER:';

const pendingTripStarts = new Map<string, true>();

export function markThanksgivingTripStarted(userId: string, durationMs: number, now = Date.now()): void {
	if (!isThanksgivingActive(now) || durationMs < THANKSGIVING_MIN_TRIP_MS) return;
	pendingTripStarts.set(userId, true);
}

export function takeThanksgivingTripStartLine(bank: Bank, userId: string): string | null {
	if (!pendingTripStarts.delete(userId)) return null;
	return formatThanksgivingShortOnLine(bank);
}

export function clearThanksgivingTripStartMark(userId: string): void {
	pendingTripStarts.delete(userId);
}

export function formatThanksgivingShortOnLine(bank: Bank): string {
	const { bundles, baskets } = cornucopiaPartsHeld(bank);
	const maxMakeable = cornucopiaMaxMakeable(bundles, baskets);
	const leftoverBundles = bundles - maxMakeable * BUNDLES_PER_OFFER;
	const leftoverBaskets = baskets - maxMakeable * BASKETS_PER_OFFER;
	const missingBundles = Math.max(0, BUNDLES_PER_OFFER - leftoverBundles);
	const missingBaskets = Math.max(0, BASKETS_PER_OFFER - leftoverBaskets);
	const needBits: string[] = [];
	if (missingBundles > 0) needBits.push(qty('Harvest bundle', missingBundles));
	if (missingBaskets > 0) needBits.push(qty('Wicker basket', missingBaskets));
	if (maxMakeable >= 1) {
		const usesAll = leftoverBundles === 0 && leftoverBaskets === 0;
		const need = usesAll ? 'that uses all your parts' : `need ${needBits.join(' and ')} more for another`;
		return `You have enough parts for ${qty('Bountiful cornucopia', maxMakeable)}; ${need}.`;
	}
	return `You need ${needBits.join(' and ')} more for your next Bountiful cornucopia.`;
}

export function thanksgivingMakeButtonCustomId(userId: string): string {
	return `${THANKS_MAKE_PREFIX}${userId}`;
}

export function thanksgivingMakeAndOfferButtonCustomId(userId: string): string {
	return `${THANKS_MAKE_OFFER_PREFIX}${userId}`;
}

export function thanksgivingButtonOwnerId(customId: string): string | null {
	if (customId.startsWith(THANKS_MAKE_OFFER_PREFIX)) return customId.slice(THANKS_MAKE_OFFER_PREFIX.length);
	if (customId.startsWith(THANKS_MAKE_PREFIX)) return customId.slice(THANKS_MAKE_PREFIX.length);
	return null;
}

export function isThanksgivingMakeAndOfferButton(customId: string): boolean {
	return customId.startsWith(THANKS_MAKE_OFFER_PREFIX);
}

export function isThanksgivingMakeButton(customId: string): boolean {
	return customId.startsWith(THANKS_MAKE_PREFIX) && !customId.startsWith(THANKS_MAKE_OFFER_PREFIX);
}

export function formatMakeAndOfferConfirm(
	preview: CornucopiaMakeOk,
	alreadyOwned: number
): { content: string; confirmLabel: string } {
	const makeConfirm = formatCornucopiaMakeConfirm(preview);
	const offerQty = preview.quantity + alreadyOwned;
	const already =
		alreadyOwned > 0
			? ` (${qty('Bountiful cornucopia', preview.quantity)} new + ${qty('Bountiful cornucopia', alreadyOwned)} you already have)`
			: '';
	const content = `${makeConfirm.content}\nThen offer all ${qty('Bountiful cornucopia', offerQty)}${already}?`;
	const confirmLabel = `Make & offer all (${preview.quantity.toLocaleString()})`.slice(0, DISCORD_BUTTON_LABEL_LIMIT);
	return { content, confirmLabel };
}

export function appendThanksgivingTripStartLine<T>(userId: string, bank: Bank, response: T): T {
	const line = takeThanksgivingTripStartLine(bank, userId);
	if (!line) return response;
	if (typeof response === 'string') return `${response}\n${line}` as T;
	if (response && typeof response === 'object' && 'content' in (response as object)) {
		const msg = response as { content?: string };
		const content = msg.content ? `${msg.content}\n${line}` : line;
		return { ...(response as object), content } as T;
	}
	return response;
}
