import { describe, expect, test } from 'vitest';

import { formatOfferReply, GOBBLES_PITY_OFFERS, rollThanksgivingOffers } from '@/lib/events/thanksgiving/core.js';
import { ThanksgivingItem } from '@/lib/events/thanksgiving/items.js';

const neverRng = { randInt: (_min: number, max: number) => max };
const alwaysRng = { randInt: (min: number) => min };
/** Just misses every roll: one above the 1/N threshold. */
const nearMissRng = { randInt: (_min: number, max: number) => Math.round(max / 225) + 1 };

describe('Thanksgiving offer reply', () => {
	test('no item list text; best rolls and status lines shown', () => {
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
		expect(text).toContain('Your best rolls (hit the top number to win):');
		expect(text).toContain('Pilgrim hat: best roll 1/');
		expect(text).toContain(
			'🦃 Gobble Streak: 2/5 offers had +15% rare chances (hats and Gobbles 1/196, Laboon 1/652).'
		);
		expect(text).toContain(`Gobbles guarantee: 15/${GOBBLES_PITY_OFFERS} offers.`);
		expect(text).toContain('Total offers: 15.');
	});

	test('near misses show close rolls on the odds that applied', () => {
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
		expect(text).toContain('**Laboon: ✅ Got it! x2**');
		expect(text).toContain('**Harvest turkey: ✅ Got it! x2**');
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
		expect(pityText).toContain(`**Gobbles: ✅ Got it! (${GOBBLES_PITY_OFFERS}-offer guarantee)**`);
		expect(pityText).toContain(`You reached ${GOBBLES_PITY_OFFERS} offers and Gobbles joined you!`);
	});
});
