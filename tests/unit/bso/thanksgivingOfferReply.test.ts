import { describe, expect, test } from 'vitest';

import {
	formatHarvestBlessingBoostDetail,
	formatOfferReply,
	formatThanksgivingBaseRatesLine,
	GOBBLES_PITY_OFFERS,
	rollThanksgivingOffers
} from '@/lib/events/thanksgiving/core.js';
import { ThanksgivingItem } from '@/lib/events/thanksgiving/items.js';

const neverRng = { randInt: (_min: number, max: number) => max };
const alwaysRng = { randInt: (min: number) => min };
/** Just misses every roll: one above the 1/N threshold. */
const nearMissRng = { randInt: (_min: number, max: number) => Math.round(max / 225) + 1 };

describe('Thanksgiving offer reply', () => {
	test('no item list text; buff lines and totals shown, not best rolls', () => {
		const result = rollThanksgivingOffers({
			quantity: 5,
			offersBefore: 10,
			offersTodayBefore: 0,
			hasHadGobbles: false,
			blessing: false,
			rng: neverRng
		});
		const text = formatOfferReply({
			result,
			quantity: 5,
			blessing: false,
			hadGobblesBefore: false,
			offersAfter: 15,
			offersTodayAfter: 5
		});
		expect(text).not.toContain('received');
		expect(text).not.toContain('Your best rolls');
		expect(text).not.toContain('best roll');
		expect(text).not.toContain('Got it!');
		expect(text).toContain(
			'🦃 Gobble Streak: 2/5 offers had +15% rare chances (Pilgrim hat, Straw hat, and Gobbles 1/196, Laboon 1/652).'
		);
		expect(text).toContain(`Gobbles guarantee: 15/${GOBBLES_PITY_OFFERS} offers.`);
		expect(text).toContain('Total offers: 15.');
	});

	test('offer rolls still track closeness internally without changing odds', () => {
		const result = rollThanksgivingOffers({
			quantity: 1,
			offersBefore: 0,
			offersTodayBefore: 0,
			hasHadGobbles: true,
			blessing: false,
			rng: nearMissRng
		});
		expect(result.rares.pilgrimHat.got).toBe(0);
		expect(result.rares.pilgrimHat.bestDenominator).toBe(225);
		expect(result.rares.pilgrimHat.bestRoll).toBe(224);
		expect(result.rares.laboon.bestDenominator).toBe(750);
	});

	test('rares they got are highlighted, and pity Gobbles is labelled', () => {
		const lucky = rollThanksgivingOffers({
			quantity: 2,
			offersBefore: 0,
			offersTodayBefore: 0,
			hasHadGobbles: false,
			blessing: true,
			rng: alwaysRng
		});
		const text = formatOfferReply({
			result: lucky,
			quantity: 2,
			blessing: true,
			hadGobblesBefore: false,
			offersAfter: 2,
			offersTodayAfter: 2
		});
		expect(text).not.toContain('Got it!');
		expect(text).not.toContain('best roll');
		expect(lucky.loot.amount(ThanksgivingItem.LABOON)).toBe(2);
		expect(lucky.loot.amount(ThanksgivingItem.HARVEST_TURKEY)).toBe(2);
		expect(text).toContain(
			'Harvest Blessing: +15% supplies, Paint box 1/39, Cornucopia 1/52, Harvest turkey 1/43.'
		);
		expect(text).not.toContain('Gobbles guarantee');

		const pity = rollThanksgivingOffers({
			quantity: 1,
			offersBefore: GOBBLES_PITY_OFFERS - 1,
			offersTodayBefore: 0,
			hasHadGobbles: false,
			blessing: false,
			rng: neverRng
		});
		expect(pity.loot.amount(ThanksgivingItem.GOBBLES)).toBe(1);
		const pityText = formatOfferReply({
			result: pity,
			quantity: 1,
			blessing: false,
			hadGobblesBefore: false,
			offersAfter: GOBBLES_PITY_OFFERS,
			offersTodayAfter: 1
		});
		expect(pityText).not.toContain('Got it!');
		expect(pityText).toContain(`You reached ${GOBBLES_PITY_OFFERS} offers and Gobbles joined you!`);
	});

	test('Thanksgiving info lists every offer rate and how buffs change them', () => {
		const rates = formatThanksgivingBaseRatesLine();
		expect(rates).toContain('Paint box 1/45');
		expect(rates).toContain('Cornucopia 1/60');
		expect(rates).toContain('Harvest turkey 1/50');
		expect(rates).toContain('Pilgrim hat 1/225');
		expect(rates).toContain('Straw hat 1/225');
		expect(rates).toContain('Gobbles 1/225');
		expect(rates).toContain('Laboon 1/750');
		expect(formatHarvestBlessingBoostDetail()).toBe(
			'+15% supplies, Paint box 1/39, Cornucopia 1/52, Harvest turkey 1/43'
		);
	});
});
