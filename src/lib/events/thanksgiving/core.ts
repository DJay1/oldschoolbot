import { Time } from '@oldschoolgg/toolkit';
import { Bank, type ItemBank } from 'oldschooljs';

import { isEventActive } from '@/lib/events/registry.js';
import { isProductionMode } from '@/lib/hosting/productionMode.js';
import { ThanksgivingItem } from './items.js';

/**
 * Master switch for every Straw Hat Harvest code path, including the year-round perks
 * (Harvest Blessing) and the Old crab cage removal.
 *
 * Test bot only for now: this returns false on the live bot, so merging this code
 * changes nothing in production. To go live later, change this one function.
 */
export function thanksgivingCodeEnabled(): boolean {
	return !isProductionMode();
}

/** Event window (drops, offers, Laboon fishing roll, blessing drop bonus). Off unless toggled on. */
export function isThanksgivingActive(now = Date.now()): boolean {
	return thanksgivingCodeEnabled() && isEventActive('thanksgiving', now);
}

/** Planned live window (CT). The active flag still decides; these are the defaults for the toggle. */
export const THANKSGIVING_DEFAULT_START = '2026-11-23T06:00:00Z'; // Mon Nov 23 00:00 CT
export const THANKSGIVING_DEFAULT_END = '2026-12-08T06:00:00Z'; // through Mon Dec 7 CT

export interface ThanksgivingRng {
	randInt(min: number, max: number): number;
}

/** Offer table. Every rate is 1 in N per offer. */
export const OFFER_RATES = {
	paintBox: 45,
	cornucopia: 60,
	pilgrimHat: 225,
	strawHat: 225,
	gobbles: 225,
	laboon: 750
} as const;

export const GOBBLES_PITY_OFFERS = 300;
export const LABOON_FISHING_RATE_PER_MINUTE = 3000;
export const LABOON_FISHING_MIN_TRIP_MS = 5 * Time.Minute;

/** Offers in one CT day before the streak kicks in (the 4th offer and later get the boost). */
export const GOBBLE_STREAK_OFFERS = 4;
export const GOBBLE_STREAK_RARE_MULTIPLIER = 1.15;

/** Harvest Blessing: own the 2021 Cornucopia. */
export const HARVEST_BLESSING_COOKING_YIELD_PERCENT = 3;
export const HARVEST_BLESSING_EVENT_MULTIPLIER = 1.15;

/**
 * Static pack given on every offer. Edit freely; quantities are per offer.
 * Harvest Blessing multiplies these by 1.15 (rounded down) during the event.
 */
export const THANKSGIVING_STATIC_PACK: readonly (readonly [string, number])[] = [
	['Oak logs', 50],
	['Willow logs', 50],
	['Iron ore', 40],
	['Coal', 40],
	['Lobster', 15],
	['Big bones', 15],
	['Small lamp', 1]
];

/** Trips shorter than this drop no parts. */
export const THANKSGIVING_MIN_TRIP_MS = 10 * Time.Minute;
/** Launch box curve (see launchBox.ts), times this pace multiplier. */
const LAUNCH_BASE_MINUTES = 20;
const LAUNCH_BASELINE_RATE_MINUTES = 112;
const LAUNCH_TRIP_EXPONENT = 1.08;
export const THANKSGIVING_PACE_MULTIPLIER = 3;
export const BUNDLES_PER_OFFER = 5;
export const BASKETS_PER_OFFER = 1;

const SCALE = 1_000_000;

function chance(rng: ThanksgivingRng, probability: number): boolean {
	if (probability <= 0) return false;
	if (probability >= 1) return true;
	return rng.randInt(1, SCALE) <= Math.round(probability * SCALE);
}

function rollExpected(rng: ThanksgivingRng, expected: number): number {
	if (expected <= 0) return 0;
	const whole = Math.floor(expected);
	return whole + (chance(rng, expected - whole) ? 1 : 0);
}

/** Expected offers worth of parts from one trip. */
export function thanksgivingExpectedOffersFromTrip(
	durationMs: number,
	{ doubleLoot, blessing }: { doubleLoot: boolean; blessing: boolean }
): number {
	if (durationMs < THANKSGIVING_MIN_TRIP_MS) return 0;
	const minutes = durationMs / Time.Minute;
	const base =
		(minutes / LAUNCH_BASE_MINUTES) ** LAUNCH_TRIP_EXPONENT * (LAUNCH_BASE_MINUTES / LAUNCH_BASELINE_RATE_MINUTES);
	let expected = base * THANKSGIVING_PACE_MULTIPLIER;
	if (doubleLoot) expected *= 2;
	if (blessing) expected *= HARVEST_BLESSING_EVENT_MULTIPLIER;
	return expected;
}

export function rollThanksgivingTripParts({
	durationMs,
	doubleLoot,
	blessing,
	rng
}: {
	durationMs: number;
	doubleLoot: boolean;
	blessing: boolean;
	rng: ThanksgivingRng;
}): Bank {
	const expected = thanksgivingExpectedOffersFromTrip(durationMs, { doubleLoot, blessing });
	const loot = new Bank();
	const bundles = rollExpected(rng, expected * BUNDLES_PER_OFFER);
	const baskets = rollExpected(rng, expected * BASKETS_PER_OFFER);
	if (bundles > 0) loot.add(ThanksgivingItem.HARVEST_BUNDLE, bundles);
	if (baskets > 0) loot.add(ThanksgivingItem.WICKER_BASKET, baskets);
	return loot;
}

export function thanksgivingStaticPack(blessing: boolean): Bank {
	const pack = new Bank();
	for (const [name, qty] of THANKSGIVING_STATIC_PACK) {
		pack.add(name, blessing ? Math.floor(qty * HARVEST_BLESSING_EVENT_MULTIPLIER) : qty);
	}
	return pack;
}

export function ctDayKey(now = Date.now()): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'America/Chicago',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(new Date(now));
}

export const GOBBLES_IDS: readonly number[] = [ThanksgivingItem.GOBBLES, ThanksgivingItem.GOBBLE_GOBBLE];
export const LABOON_IDS: readonly number[] = [ThanksgivingItem.LABOON, ThanksgivingItem.LABOON_STRAW_HAT];

export interface OfferRollResult {
	loot: Bank;
	gotPityGobbles: boolean;
	streakOffers: number;
}

/**
 * Pure offer roll. `hasHadGobbles` should be true if Gobbles or Gobble gobble is in the
 * player's collection log or bank, so the guarantee only ever fires once.
 */
export function rollThanksgivingOffers({
	quantity,
	offersBefore,
	offersTodayBefore,
	hasHadGobbles,
	blessing,
	rng
}: {
	quantity: number;
	offersBefore: number;
	offersTodayBefore: number;
	hasHadGobbles: boolean;
	blessing: boolean;
	rng: ThanksgivingRng;
}): OfferRollResult {
	const loot = new Bank();
	let hadGobbles = hasHadGobbles;
	let gotPityGobbles = false;
	let streakOffers = 0;
	const uncommonMult = blessing ? HARVEST_BLESSING_EVENT_MULTIPLIER : 1;

	for (let i = 0; i < quantity; i++) {
		const offerNumber = offersBefore + i + 1;
		const todayNumber = offersTodayBefore + i + 1;
		const streak = todayNumber >= GOBBLE_STREAK_OFFERS;
		if (streak) streakOffers++;
		const rareMult = streak ? GOBBLE_STREAK_RARE_MULTIPLIER : 1;

		loot.add(thanksgivingStaticPack(blessing));

		// Below rares: Harvest Blessing applies.
		if (chance(rng, uncommonMult / OFFER_RATES.paintBox)) loot.add('Paint box');
		if (chance(rng, uncommonMult / OFFER_RATES.cornucopia)) loot.add(ThanksgivingItem.CORNUCOPIA_2021);

		// Rares and above: Gobble Streak applies, Harvest Blessing does not.
		if (chance(rng, rareMult / OFFER_RATES.pilgrimHat)) loot.add(ThanksgivingItem.PILGRIM_HAT);
		if (chance(rng, rareMult / OFFER_RATES.strawHat)) loot.add(ThanksgivingItem.STRAW_HAT);
		if (chance(rng, rareMult / OFFER_RATES.gobbles)) {
			loot.add(ThanksgivingItem.GOBBLES);
			hadGobbles = true;
		} else if (!hadGobbles && offerNumber >= GOBBLES_PITY_OFFERS) {
			loot.add(ThanksgivingItem.GOBBLES);
			hadGobbles = true;
			gotPityGobbles = true;
		}
		if (chance(rng, rareMult / OFFER_RATES.laboon)) loot.add(ThanksgivingItem.LABOON);
	}

	return { loot, gotPityGobbles, streakOffers };
}

export function offersFromScores(scores: ItemBank | null | undefined): number {
	return new Bank((scores ?? {}) as ItemBank).amount(ThanksgivingItem.BOUNTIFUL_CORNUCOPIA);
}

/* ---------- Boost helpers (all inert unless thanksgivingCodeEnabled) ---------- */

interface PetAndGear {
	usingPet(pet: number, options?: { ignoreSimilar?: boolean }): boolean | number;
	hasEquipped(item: number): boolean;
}
interface HasBank {
	bank: Bank;
}

export function usingGobblesPet(g: PetAndGear): boolean {
	if (!thanksgivingCodeEnabled()) return false;
	return GOBBLES_IDS.some(id => Boolean(g.usingPet(id, { ignoreSimilar: true })));
}

export function usingLaboonPet(g: PetAndGear): boolean {
	if (!thanksgivingCodeEnabled()) return false;
	return LABOON_IDS.some(id => Boolean(g.usingPet(id, { ignoreSimilar: true })));
}

export function hasHarvestBlessing(g: HasBank): boolean {
	if (!thanksgivingCodeEnabled()) return false;
	return g.bank.has(ThanksgivingItem.CORNUCOPIA_2021);
}

/** How many Pilgrim hat effects apply: one for Gobble gobble, one for a worn spare. */
function pilgrimHatStacks(g: PetAndGear): number {
	if (!thanksgivingCodeEnabled()) return 0;
	let n = 0;
	if (g.usingPet(ThanksgivingItem.GOBBLE_GOBBLE, { ignoreSimilar: true })) n++;
	if (g.hasEquipped(ThanksgivingItem.PILGRIM_HAT)) n++;
	return n;
}

function strawHatStacks(g: PetAndGear): number {
	if (!thanksgivingCodeEnabled()) return 0;
	let n = 0;
	if (g.usingPet(ThanksgivingItem.LABOON_STRAW_HAT, { ignoreSimilar: true })) n++;
	if (g.hasEquipped(ThanksgivingItem.STRAW_HAT)) n++;
	return n;
}

export const GOBBLES_TRIP_LENGTH_MULTIPLIER = 1.4;
export const GOBBLES_SAVE_RAW_PERCENT = 15;
export const PILGRIM_HAT_SPEED_PERCENT = 10;
export const PILGRIM_HAT_YIELD_PERCENT = 3;
export const LABOON_SPEED_MULTIPLIER = 2.2;
export const LABOON_TRIP_LENGTH_MULTIPLIER = 1.3;
export const LABOON_EXTRA_FISH_MULTIPLIER = 2.2;
export const STRAW_HAT_SPEED_PERCENT = 10;
export const STRAW_HAT_YIELD_PERCENT = 3;

export interface CookingBoosts {
	/** Added to the cooking speed boost (0.1 = +10%). */
	speedBonus: number;
	yieldPercent: number;
	saveRawPercent: number;
	lines: string[];
}

export function thanksgivingCookingBoosts(g: PetAndGear & HasBank): CookingBoosts {
	const out: CookingBoosts = { speedBonus: 0, yieldPercent: 0, saveRawPercent: 0, lines: [] };
	if (!thanksgivingCodeEnabled()) return out;
	if (usingGobblesPet(g)) {
		out.saveRawPercent += GOBBLES_SAVE_RAW_PERCENT;
		out.lines.push(`${GOBBLES_SAVE_RAW_PERCENT}% chance each raw item is not used up (Gobbles)`);
	}
	const hats = pilgrimHatStacks(g);
	if (hats > 0) {
		out.speedBonus += (PILGRIM_HAT_SPEED_PERCENT / 100) * hats;
		out.yieldPercent += PILGRIM_HAT_YIELD_PERCENT * hats;
		out.lines.push(
			`+${PILGRIM_HAT_SPEED_PERCENT * hats}% cooking speed and +${PILGRIM_HAT_YIELD_PERCENT * hats}% cooking yield (Pilgrim hat)`
		);
	}
	if (hasHarvestBlessing(g)) {
		out.yieldPercent += HARVEST_BLESSING_COOKING_YIELD_PERCENT;
		out.lines.push(`+${HARVEST_BLESSING_COOKING_YIELD_PERCENT}% cooking yield (Harvest Blessing)`);
	}
	return out;
}

export interface FishingBoosts {
	speedMultiplier: number;
	yieldPercent: number;
	lines: string[];
	usingLaboon: boolean;
}

export function thanksgivingFishingBoosts(g: PetAndGear): FishingBoosts {
	const out: FishingBoosts = { speedMultiplier: 1, yieldPercent: 0, lines: [], usingLaboon: false };
	if (!thanksgivingCodeEnabled()) return out;
	if (usingLaboonPet(g)) {
		out.usingLaboon = true;
		out.speedMultiplier *= LABOON_SPEED_MULTIPLIER;
		out.lines.push(`${LABOON_SPEED_MULTIPLIER}x faster for Laboon`);
	}
	const hats = strawHatStacks(g);
	if (hats > 0) {
		out.speedMultiplier *= 1 + (STRAW_HAT_SPEED_PERCENT / 100) * hats;
		out.yieldPercent += STRAW_HAT_YIELD_PERCENT * hats;
		out.lines.push(
			`+${STRAW_HAT_SPEED_PERCENT * hats}% fishing speed and +${STRAW_HAT_YIELD_PERCENT * hats}% fishing yield (Straw hat)`
		);
	}
	return out;
}

/** Binomial: how many of `qty` items pass a `percent` chance. */
export function rollPercentOfQuantity(rng: ThanksgivingRng, qty: number, percent: number): number {
	if (qty <= 0 || percent <= 0) return 0;
	let n = 0;
	const p = Math.round((percent / 100) * SCALE);
	for (let i = 0; i < qty; i++) {
		if (rng.randInt(1, SCALE) <= p) n++;
	}
	return n;
}

export const thanksgivingCL: number[] = [
	ThanksgivingItem.HARVEST_BUNDLE,
	ThanksgivingItem.WICKER_BASKET,
	ThanksgivingItem.BOUNTIFUL_CORNUCOPIA,
	ThanksgivingItem.CORNUCOPIA_2021,
	ThanksgivingItem.PILGRIM_HAT,
	ThanksgivingItem.STRAW_HAT,
	ThanksgivingItem.GOBBLES,
	ThanksgivingItem.GOBBLE_GOBBLE,
	ThanksgivingItem.LABOON,
	ThanksgivingItem.LABOON_STRAW_HAT
];

/** Bank backgrounds need the full event log except the two Laboon items. */
export const thanksgivingBankBgCL: number[] = thanksgivingCL.filter(id => !LABOON_IDS.includes(id));

export const thanksgivingPetIDs: number[] = [...GOBBLES_IDS, ...LABOON_IDS];
