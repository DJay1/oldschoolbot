import { Bank } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { clearSeasonalEventOverrides, setSeasonalEventOverride } from '@/lib/events/registry.js';
import {
	formatGobbleStreakStatusLine,
	formatHarvestBlessingStatusLine,
	formatLaboonFishingRateLine,
	formatThanksgivingBaseRatesLine,
	formatThanksgivingTripPartsRateLine,
	GOBBLE_STREAK_OFFERS,
	GOBBLES_PITY_OFFERS,
	THANKSGIVING_MIN_TRIP_MS
} from '@/lib/events/thanksgiving/core.js';
import { harvestFeastStatusLine } from '@/lib/events/thanksgiving/feast.js';
import { ThanksgivingItem } from '@/lib/events/thanksgiving/items.js';
import {
	appendThanksgivingTripStartLine,
	CORNUCOPIA_CREATE_ITEM,
	cornucopiaMaxMakeable,
	cornucopiaQuantityChoices,
	DISCORD_AUTOCOMPLETE_NAME_LIMIT,
	DISCORD_BUTTON_LABEL_LIMIT,
	DISCORD_CONTENT_LIMIT,
	DISCORD_LENGTH_BUFFER,
	formatCornucopiaCanMakeLine,
	formatCornucopiaCreateAutocompleteName,
	formatCornucopiaMakeConfirm,
	formatCornucopiaMakeSuccess,
	formatCornucopiaOfferEmpty,
	formatMakeAndOfferConfirm,
	formatThanksgivingPartsLine,
	formatThanksgivingShortOnLine,
	formatThanksgivingWindowLine,
	isBountifulCornucopiaName,
	isThanksgivingMakeAndOfferButton,
	isThanksgivingMakeButton,
	markThanksgivingTripStarted,
	previewCornucopiaMake,
	resolveCornucopiaMakeAfterConfirm,
	takeThanksgivingTripStartLine,
	thanksgivingButtonOwnerId,
	thanksgivingMakeAndOfferButtonCustomId,
	thanksgivingMakeButtonCustomId
} from '@/lib/events/thanksgiving/make.js';
import { createAllConfirmLabel, createQuantityStaysOne } from '@/lib/util/maxCreatableQuantity.js';

const DISCORD_CONTENT_SOFT_LIMIT = DISCORD_CONTENT_LIMIT - DISCORD_LENGTH_BUFFER;

function parts(bundles: number, baskets: number, cornucopias = 0) {
	return new Bank()
		.add(ThanksgivingItem.HARVEST_BUNDLE, bundles)
		.add(ThanksgivingItem.WICKER_BASKET, baskets)
		.add(ThanksgivingItem.BOUNTIFUL_CORNUCOPIA, cornucopias);
}

function underLimit(content: string, limit = DISCORD_CONTENT_LIMIT, buffer = DISCORD_LENGTH_BUFFER) {
	expect(content.length).toBeLessThanOrEqual(limit - buffer);
	expect(content.length).toBeLessThanOrEqual(limit);
}

function usesExactItemNames(text: string) {
	// Bare "cornucopia" is only allowed as part of "Bountiful cornucopia".
	const stripped = text.replaceAll(/Bountiful cornucopias?/g, '');
	expect(stripped.toLowerCase()).not.toContain('cornucopia');
}

describe('Bountiful cornucopia /create all QoL', () => {
	test('max makeable is limited by the scarcer part', () => {
		expect(cornucopiaMaxMakeable(23, 4)).toBe(4);
		expect(cornucopiaMaxMakeable(5, 1)).toBe(1);
		expect(cornucopiaMaxMakeable(4, 10)).toBe(0);
		expect(cornucopiaMaxMakeable(50, 0)).toBe(0);
		expect(cornucopiaMaxMakeable(0, 0)).toBe(0);
	});

	test('omitted quantity means all, and leftovers and missing parts are shown', () => {
		const preview = previewCornucopiaMake(parts(23, 4));
		expect(preview.ok).toBe(true);
		if (!preview.ok) return;
		expect(preview.quantity).toBe(4);
		expect(preview.makingAll).toBe(true);
		expect(preview.leftoverBundles).toBe(3);
		expect(preview.leftoverBaskets).toBe(0);
		expect(preview.missingBundles).toBe(2);
		expect(preview.missingBaskets).toBe(1);
		expect(preview.inItems.amount(ThanksgivingItem.HARVEST_BUNDLE)).toBe(20);
		expect(preview.inItems.amount(ThanksgivingItem.WICKER_BASKET)).toBe(4);
		expect(preview.outItems.amount(ThanksgivingItem.BOUNTIFUL_CORNUCOPIA)).toBe(4);

		const { content, confirmLabel } = formatCornucopiaMakeConfirm(preview);
		expect(content).toContain('23x Harvest bundle');
		expect(content).toContain('4x Wicker basket');
		expect(content).toContain('all = 4x Bountiful cornucopia, leftover 3x Harvest bundle');
		expect(content).toContain('Make 4x Bountiful cornucopia using 20x Harvest bundle and 4x Wicker basket?');
		expect(confirmLabel).toBe('Make all (4)');
		usesExactItemNames(content);
	});

	test('a specific quantity shows how many all would make and what would be left', () => {
		const preview = previewCornucopiaMake(parts(23, 4), 2);
		expect(preview.ok).toBe(true);
		if (!preview.ok) return;
		expect(preview.makingAll).toBe(false);
		expect(preview.leftoverBundles).toBe(13);
		expect(preview.leftoverBaskets).toBe(2);
		const { content, confirmLabel } = formatCornucopiaMakeConfirm(preview);
		expect(content).toContain('all = 4x Bountiful cornucopia, leftover 3x Harvest bundle');
		expect(content).toContain(
			"After that you'd have 13x Harvest bundle and 2x Wicker basket left (enough for 2 more)."
		);
		expect(confirmLabel).toBe('Make (2)');
		usesExactItemNames(content);
	});

	test('clear errors when short on parts or asking for too many', () => {
		const none = previewCornucopiaMake(parts(3, 0));
		expect(none.ok).toBe(false);
		if (none.ok) return;
		expect(none.error).toContain("You don't have enough parts to make a Bountiful cornucopia");
		expect(none.error).toContain('3x Harvest bundle');
		expect(none.error).toContain('0x Wicker basket');
		expect(none.error).toContain('2x Harvest bundle');
		expect(none.error).toContain('1x Wicker basket more to make one');
		expect(none.error).toContain('5 Harvest bundles + 1 Wicker basket');
		usesExactItemNames(none.error);

		const tooMany = previewCornucopiaMake(parts(23, 4), 10);
		expect(tooMany.ok).toBe(false);
		if (tooMany.ok) return;
		expect(tooMany.error).toContain('You asked for 10x Bountiful cornucopia');
		expect(tooMany.error).toContain('You only have enough parts to make 4x Bountiful cornucopia');
		expect(tooMany.error).toContain('Leave quantity blank to make all 4');
		usesExactItemNames(tooMany.error);
	});

	test('after confirm, all never spends more than confirmed or more than the current bank', () => {
		const stillSame = resolveCornucopiaMakeAfterConfirm(parts(23, 4), undefined, 4);
		expect(stillSame.ok).toBe(true);
		if (!stillSame.ok) return;
		expect(stillSame.quantity).toBe(4);
		expect(stillSame.reducedFromConfirm).toBe(false);

		const fewerParts = resolveCornucopiaMakeAfterConfirm(parts(12, 3), undefined, 4);
		expect(fewerParts.ok).toBe(true);
		if (!fewerParts.ok) return;
		expect(fewerParts.quantity).toBe(2);
		expect(fewerParts.reducedFromConfirm).toBe(true);
		expect(fewerParts.inItems.amount(ThanksgivingItem.HARVEST_BUNDLE)).toBe(10);
		expect(formatCornucopiaMakeSuccess(fewerParts, 4)).toContain(
			'You had fewer parts than when you confirmed, so 2 were made instead of 4.'
		);

		// More parts after confirm still cap at the confirmed amount.
		const moreParts = resolveCornucopiaMakeAfterConfirm(parts(100, 20), undefined, 4);
		expect(moreParts.ok).toBe(true);
		if (!moreParts.ok) return;
		expect(moreParts.quantity).toBe(4);

		const gone = resolveCornucopiaMakeAfterConfirm(parts(2, 0), undefined, 4);
		expect(gone.ok).toBe(false);
		if (gone.ok) return;
		expect(gone.error).toContain('Your parts changed, so this make was cancelled');
		expect(gone.error).toContain('can make 0');

		const specificShort = resolveCornucopiaMakeAfterConfirm(parts(12, 1), 4, 4);
		expect(specificShort.ok).toBe(false);
		if (specificShort.ok) return;
		expect(specificShort.error).toContain('Your parts changed, so this make was cancelled');
	});

	test('status, offer empty, autocomplete and button labels stay under Discord limits', () => {
		const huge = Number.MAX_SAFE_INTEGER;
		const hugeBank = parts(huge, huge);
		const preview = previewCornucopiaMake(hugeBank);
		expect(preview.ok).toBe(true);
		if (!preview.ok) return;
		expect(preview.quantity).toBe(Math.floor(huge / 5));

		const confirm = formatCornucopiaMakeConfirm(preview);
		underLimit(confirm.content);
		expect(confirm.confirmLabel).toBe(`Make all (${preview.quantity.toLocaleString()})`);
		// Button labels max out at 80; worst-case quantity still leaves comfortable room.
		expect(confirm.confirmLabel.length).toBeLessThanOrEqual(DISCORD_BUTTON_LABEL_LIMIT);
		expect(DISCORD_BUTTON_LABEL_LIMIT - confirm.confirmLabel.length).toBeGreaterThanOrEqual(40);

		const shortage = formatCornucopiaOfferEmpty(parts(huge, 0));
		underLimit(shortage);
		const offerEmpty = formatCornucopiaOfferEmpty(hugeBank);
		underLimit(offerEmpty);
		const cannot = previewCornucopiaMake(parts(huge, 0), huge);
		expect(cannot.ok).toBe(false);
		if (!cannot.ok) underLimit(cannot.error);

		const autoName = formatCornucopiaCreateAutocompleteName(hugeBank);
		expect(autoName.length).toBeLessThanOrEqual(DISCORD_AUTOCOMPLETE_NAME_LIMIT);
		expect(autoName.startsWith(CORNUCOPIA_CREATE_ITEM)).toBe(true);

		const choices = cornucopiaQuantityChoices(hugeBank, huge - 1);
		for (const choice of choices) {
			expect(choice.name.length).toBeLessThanOrEqual(DISCORD_AUTOCOMPLETE_NAME_LIMIT);
		}
		expect(
			choices.some(c => c.name === `All (${preview.quantity.toLocaleString()})` && c.value === preview.quantity)
		).toBe(true);

		const farEnd = Date.parse('9999-12-31T23:59:59Z');
		const windowLine = formatThanksgivingWindowLine(true, 0, farEnd, Date.parse('2026-11-22T20:00:00Z'));
		const canMake = formatCornucopiaCanMakeLine(hugeBank);
		const status = [
			windowLine,
			formatThanksgivingPartsLine(hugeBank),
			`-# ${canMake}`,
			`**Offers:** ${huge.toLocaleString()}`,
			formatGobbleStreakStatusLine(huge),
			`**Gobbles guarantee:** ${GOBBLES_PITY_OFFERS}/${GOBBLES_PITY_OFFERS} offers`,
			formatHarvestBlessingStatusLine(true),
			`**Harvest turkey:** ${huge.toLocaleString()}`,
			harvestFeastStatusLine('length-user', Date.parse('2026-11-22T20:00:00Z')),
			formatThanksgivingTripPartsRateLine(),
			formatThanksgivingBaseRatesLine(),
			formatLaboonFishingRateLine()
		].join('\n');
		underLimit(status);
		expect(status.startsWith('**The Straw Hat Harvest** is running (ends <t:')).toBe(true);
		expect(status).toContain('Laboon 1/750');
		expect(status).toContain('Trip drops');
		expect(status).toContain('Harvest bundles and Wicker baskets');
		expect(formatThanksgivingTripPartsRateLine()).toContain('70%');
		expect(formatThanksgivingTripPartsRateLine()).toContain('2 in 15');
		expect(formatThanksgivingTripPartsRateLine()).toContain('Bountiful cornucopia');
		expect(status).toContain('2 in 15');
		expect(status).toContain('Harvest Blessing');
		expect(formatLaboonFishingRateLine()).toContain('Laboon');
		expect(canMake).toContain('Can make: ');
		expect(GOBBLE_STREAK_OFFERS).toBeGreaterThan(0);
		expect(isBountifulCornucopiaName('bountiful cornucopia')).toBe(true);
		expect(isBountifulCornucopiaName('Cornucopia')).toBe(false);
		expect(DISCORD_CONTENT_SOFT_LIMIT).toBe(1850);
	});

	test('event window line only adds a time when one exists', () => {
		const start = Date.parse('2026-11-22T16:46:19.332Z');
		const end = Date.parse('2026-12-07T16:46:19.332Z');
		expect(formatThanksgivingWindowLine(true, start, end, start)).toBe(
			`**The Straw Hat Harvest** is running (ends <t:${Math.floor(end / 1000)}:R>).`
		);
		expect(formatThanksgivingWindowLine(true, null, null, start)).toBe('**The Straw Hat Harvest** is running.');
		expect(formatThanksgivingWindowLine(false, start, end, start - 1000)).toBe(
			`**The Straw Hat Harvest** is not running right now (starts <t:${Math.floor(start / 1000)}:R>).`
		);
		expect(formatThanksgivingWindowLine(false, start, end, end)).toBe(
			'**The Straw Hat Harvest** is not running right now.'
		);
	});
});

describe('Thanksgiving follow-up QoL', () => {
	test('short-on trip start line names the missing parts and stays under Discord limits', () => {
		expect(formatThanksgivingShortOnLine(parts(3, 0))).toBe(
			'You need 2x Harvest bundle and 1x Wicker basket more for your next Bountiful cornucopia.'
		);
		expect(formatThanksgivingShortOnLine(parts(23, 4))).toBe(
			'You have enough parts for 4x Bountiful cornucopia; need 2x Harvest bundle and 1x Wicker basket more for another.'
		);
		expect(formatThanksgivingShortOnLine(parts(20, 4))).toBe(
			'You have enough parts for 4x Bountiful cornucopia; that uses all your parts.'
		);
		const huge = Number.MAX_SAFE_INTEGER;
		underLimit(formatThanksgivingShortOnLine(parts(huge, huge)));
		underLimit(
			`🌾 ${'W'.repeat(32)}'s minion is now fishing, it'll take around 24 hours, 59 minutes to finish (back at 12:59 PM).\n${formatThanksgivingShortOnLine(parts(huge, 0))}`
		);
	});

	test('trip start hint is marked only for long enough trips during the event, and consumed once', () => {
		clearSeasonalEventOverrides();
		const start = Date.parse('2026-11-22T16:46:19.332Z');
		const end = Date.parse('2026-12-07T16:46:19.332Z');
		setSeasonalEventOverride('thanksgiving', { enabled: true, start, end });
		markThanksgivingTripStarted('hint-user', THANKSGIVING_MIN_TRIP_MS - 1, start);
		expect(takeThanksgivingTripStartLine(parts(3, 0), 'hint-user')).toBeNull();
		markThanksgivingTripStarted('hint-user', THANKSGIVING_MIN_TRIP_MS, start);
		const line = takeThanksgivingTripStartLine(parts(3, 0), 'hint-user');
		expect(line).toContain('You need 2x Harvest bundle');
		expect(takeThanksgivingTripStartLine(parts(3, 0), 'hint-user')).toBeNull();
		markThanksgivingTripStarted('hint-user', THANKSGIVING_MIN_TRIP_MS, start);
		const appended = appendThanksgivingTripStartLine('hint-user', parts(3, 0), 'Trip started.');
		expect(appended).toBe(`Trip started.\n${formatThanksgivingShortOnLine(parts(3, 0))}`);
		clearSeasonalEventOverrides();
	});

	test('make and offer confirm shows both steps and a Make & offer all button label', () => {
		const preview = previewCornucopiaMake(parts(23, 4));
		expect(preview.ok).toBe(true);
		if (!preview.ok) return;
		const confirm = formatMakeAndOfferConfirm(preview, 10);
		expect(confirm.confirmLabel).toBe('Make & offer all (4)');
		expect(confirm.confirmLabel.length).toBeLessThanOrEqual(DISCORD_BUTTON_LABEL_LIMIT);
		expect(confirm.content).toContain(
			'Then offer all 14x Bountiful cornucopia (4x Bountiful cornucopia new + 10x Bountiful cornucopia you already have)?'
		);
		underLimit(confirm.content);
		usesExactItemNames(confirm.content);
		const noneOwned = formatMakeAndOfferConfirm(preview, 0);
		expect(noneOwned.content).toContain('Then offer all 4x Bountiful cornucopia?');
		expect(isThanksgivingMakeButton(thanksgivingMakeButtonCustomId('123'))).toBe(true);
		expect(isThanksgivingMakeAndOfferButton(thanksgivingMakeAndOfferButtonCustomId('123'))).toBe(true);
		expect(isThanksgivingMakeButton(thanksgivingMakeAndOfferButtonCustomId('123'))).toBe(false);
		expect(thanksgivingButtonOwnerId(thanksgivingMakeButtonCustomId('123'))).toBe('123');
	});

	test('/create all button labels and unique-item rule', () => {
		expect(createAllConfirmLabel(true, 12)).toBe('Make all (12)');
		expect(createAllConfirmLabel(false, 2)).toBe('Make (2)');
		expect(createAllConfirmLabel(true, Number.MAX_SAFE_INTEGER).length).toBeLessThanOrEqual(80);
		expect(createQuantityStaysOne({ cantHaveItems: { 1: 1 } } as never)).toBe(true);
		expect(createQuantityStaysOne({ name: 'Bountiful cornucopia' } as never)).toBe(false);
	});
});
