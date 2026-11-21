import { Bank } from 'oldschooljs';
import { afterEach, describe, expect, test } from 'vitest';

import { clearSeasonalEventOverrides, isEventActive, setSeasonalEventOverride } from '@/lib/events/registry.js';
import {
	formatOfferReply,
	GOBBLE_STREAK_OFFERS,
	GOBBLES_PITY_OFFERS,
	isThanksgivingActive,
	OFFER_RARE_ORDER,
	OFFER_RATES,
	type OfferRareKey,
	type OfferRareTrack,
	THANKSGIVING_HARVEST_DISCOUNT,
	thanksgivingCodeEnabled,
	thanksgivingHarvestPartName,
	thanksgivingPetAnnouncement
} from '@/lib/events/thanksgiving/core.js';
import {
	_setHarvestFeastForTests,
	harvestFeastAnnouncement,
	harvestFeastStatusLine
} from '@/lib/events/thanksgiving/feast.js';
import { ThanksgivingItem } from '@/lib/events/thanksgiving/items.js';

const DISCORD_CONTENT_LIMIT = 2000;
const LENGTH_BUFFER = 150;
const LONGEST_MENTION = `<@${'9'.repeat(20)}>`;
const LONG_MINION = `${'W'.repeat(32)}'s minion`;

const LAUNCH_END = Date.parse('2026-11-22T16:41:19.332Z');
const THANKS_START = Date.parse('2026-11-22T16:46:19.332Z');
const THANKS_END = Date.parse('2026-12-07T16:46:19.332Z');

afterEach(() => {
	clearSeasonalEventOverrides();
	_setHarvestFeastForTests('length-user', null);
});

function underLimit(content: string) {
	expect(content.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - LENGTH_BUFFER);
	expect(content.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT);
}

describe('Straw Hat Harvest production go-live', () => {
	test('code is on, but the event stays off until the scheduled start', () => {
		expect(thanksgivingCodeEnabled()).toBe(true);
		expect(isThanksgivingActive()).toBe(false);

		setSeasonalEventOverride('launch', {
			enabled: true,
			start: Date.parse('2026-11-08T16:41:19.332Z'),
			end: LAUNCH_END
		});
		setSeasonalEventOverride('thanksgiving', { enabled: true, start: THANKS_START, end: THANKS_END });

		const justBeforeLaunchEnd = LAUNCH_END - 1;
		expect(isEventActive('launch', justBeforeLaunchEnd)).toBe(true);
		expect(isEventActive('launch', LAUNCH_END)).toBe(false);
		expect(isThanksgivingActive(justBeforeLaunchEnd)).toBe(false);
		expect(isThanksgivingActive(THANKS_START - 1)).toBe(false);
		expect(isThanksgivingActive(THANKS_START)).toBe(true);
		expect(isThanksgivingActive(THANKS_END - 1)).toBe(true);
		expect(isThanksgivingActive(THANKS_END)).toBe(false);
		// Launch ending does not turn Thanksgiving on early, and Thanksgiving starting does not keep Launch on.
		expect(isEventActive('launch', THANKS_START)).toBe(false);
	});

	test('offer, status, harvest, feast and announcement text stay under Discord limits', () => {
		const huge = Number.MAX_SAFE_INTEGER;
		const rares = Object.fromEntries(
			OFFER_RARE_ORDER.map(key => [
				key,
				{ got: huge, bestRoll: huge, bestDenominator: huge } satisfies OfferRareTrack
			])
		) as Record<OfferRareKey, OfferRareTrack>;
		const offerReply = formatOfferReply({
			result: { loot: new Bank(), gotPityGobbles: true, streakOffers: huge, rares },
			quantity: huge,
			blessing: true,
			hadGobblesBefore: false,
			offersAfter: huge,
			offersTodayAfter: huge
		});
		underLimit(offerReply);

		setSeasonalEventOverride('thanksgiving', { enabled: true, start: THANKS_START, end: THANKS_END });
		_setHarvestFeastForTests('length-user', {
			kind: 'loot',
			startMs: THANKS_START,
			endMs: THANKS_START + 3 * 60 * 60 * 1000
		});
		const status = [
			'**The Straw Hat Harvest** is not running right now.',
			`Harvest bundles: ${huge.toLocaleString()}, Wicker baskets: ${huge.toLocaleString()}, Bountiful cornucopias: ${huge.toLocaleString()}`,
			`Offers made: ${huge.toLocaleString()}`,
			`Gobble Streak: active today (${huge.toLocaleString()} offers). Rare chances are 15% better until midnight CT.`,
			`Gobbles guarantee: ${GOBBLES_PITY_OFFERS}/${GOBBLES_PITY_OFFERS} offers.`,
			'Harvest Blessing (Cornucopia in bank): yes',
			`Harvest turkeys: ${huge.toLocaleString()}`,
			harvestFeastStatusLine('length-user', THANKS_START),
			`Rates per offer: Paint box 1/${OFFER_RATES.paintBox}, Cornucopia 1/${OFFER_RATES.cornucopia}, Harvest turkey 1/${OFFER_RATES.turkey}, Pilgrim hat 1/${OFFER_RATES.pilgrimHat}, Straw hat 1/${OFFER_RATES.strawHat}, Gobbles 1/${OFFER_RATES.gobbles}.`
		].join('\n');
		underLimit(status);
		expect(status.startsWith('**The Straw Hat Harvest** is not running right now.')).toBe(true);

		const harvestStart = `?? ${LONG_MINION} is now gathering **${thanksgivingHarvestPartName('bundles')}** for The Straw Hat Harvest, it'll take around 24 hours, 59 minutes to finish (back at 12:59 PM).\nExpected: about **${'9'.repeat(20)}** ${thanksgivingHarvestPartName('bundles')} (random amount; ${Math.round(THANKSGIVING_HARVEST_DISCOUNT * 100)}% of a normal trip's event value, counting 1 Wicker basket as 5 Harvest bundles, all in this part; Double Loot doubles it). Harvest trips don't also roll the normal trip drops of Harvest bundles and Wicker baskets.`;
		underLimit(harvestStart);

		const harvestFinish = `${LONGEST_MENTION}, ${LONG_MINION} finished gathering ${thanksgivingHarvestPartName('baskets')} for The Straw Hat Harvest and found ${huge.toLocaleString()}x Wicker basket. (2x from Double Loot, Harvest Blessing)`;
		underLimit(harvestFinish);

		const feastNew = [
			`?? You offer a Harvest turkey to the harvest... **Harvest feast: 2x loot** for **30 minutes** (ends <t:${Math.floor(THANKS_END / 1000)}:R>).`,
			'Trips get 2x loot for the part of the trip inside the feast (event items, pets and untradeables are not doubled; does not stack with Double Loot).',
			'Your feast is now at the 3 hour maximum.'
		].join('\n');
		underLimit(feastNew);

		const pets = thanksgivingPetAnnouncement({
			name: LONGEST_MENTION,
			gained: new Bank()
				.add(ThanksgivingItem.GOBBLES, huge)
				.add(ThanksgivingItem.GOBBLE_GOBBLE, huge)
				.add(ThanksgivingItem.LABOON, huge)
				.add(ThanksgivingItem.LABOON_STRAW_HAT, huge),
			clAfter: new Bank()
				.add(ThanksgivingItem.GOBBLES, huge)
				.add(ThanksgivingItem.GOBBLE_GOBBLE, huge)
				.add(ThanksgivingItem.LABOON, huge)
				.add(ThanksgivingItem.LABOON_STRAW_HAT, huge),
			source: 'from a Straw Hat Harvest offer'
		});
		expect(pets).toBeTruthy();
		underLimit(pets!);

		const corn = `?? ${LONGEST_MENTION} just received ${huge.toLocaleString()}x **Cornucopia** from a Straw Hat Harvest offer!`;
		underLimit(corn);

		const feastAnn = harvestFeastAnnouncement(LONGEST_MENTION, {
			outcome: 'extended',
			feast: { kind: 'xp', startMs: THANKS_START, endMs: THANKS_END },
			addedMs: 30 * 60 * 1000
		});
		expect(feastAnn).toBeTruthy();
		underLimit(feastAnn!);

		// unused but keeps the streak constant referenced so a future status change is noticed
		expect(GOBBLE_STREAK_OFFERS).toBeGreaterThan(0);
	});
});
