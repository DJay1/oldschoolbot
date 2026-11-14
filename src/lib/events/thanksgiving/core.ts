import { formatOrdinal, Time } from '@oldschoolgg/toolkit';
import { Bank, type ItemBank, Items } from 'oldschooljs';

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
	laboon: 750,
	/** Harvest turkey: offer it with `/thanksgiving offer item:turkey` for a Harvest feast (2x loot or XP). */
	turkey: 50
} as const;

/** Lowered from 300 with the halved trip drops (round 3), so a steady player still reaches it. */
export const GOBBLES_PITY_OFFERS = 150;
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
	['Raw karambwan', 6],
	['Big bones', 15],
	['Small lamp', 1]
];

/** Trips shorter than this drop no parts. */
export const THANKSGIVING_MIN_TRIP_MS = 10 * Time.Minute;
/** Launch box curve (see launchBox.ts), times this pace multiplier. */
const LAUNCH_BASE_MINUTES = 20;
const LAUNCH_BASELINE_RATE_MINUTES = 112;
const LAUNCH_TRIP_EXPONENT = 1.08;
/** Round 3: halved from 3 (Bountiful cornucopia recipe stays 5 bundles + 1 basket). */
export const THANKSGIVING_PACE_MULTIPLIER = 1.5;
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

/* ---------- Focused harvest trip (/thanksgiving harvest) ---------- */

export type ThanksgivingHarvestFocus = 'bundles' | 'baskets';
export const THANKSGIVING_HARVEST_FOCUSES: readonly ThanksgivingHarvestFocus[] = ['bundles', 'baskets'];
/** A focused trip pays this share of a normal trip's offer-worth, all in the chosen part. */
export const THANKSGIVING_HARVEST_DISCOUNT = 0.7;
/**
 * The trip reuses the retired TrickOrTreat activity type (no task used it any more), so no
 * database enum change is needed. Trips are also tagged with `thanksgivingHarvest: true`.
 */
export const THANKSGIVING_HARVEST_ACTIVITY = 'TrickOrTreat' as const;

export function thanksgivingHarvestPartName(focus: ThanksgivingHarvestFocus, plural = true): string {
	if (focus === 'bundles') return plural ? 'Harvest bundles' : 'Harvest bundle';
	return plural ? 'Wicker baskets' : 'Wicker basket';
}

/** Expected parts of the chosen kind from a focused trip (same curve, double loot and blessing as normal trips). */
export function thanksgivingHarvestExpectedParts(
	durationMs: number,
	focus: ThanksgivingHarvestFocus,
	{ doubleLoot, blessing }: { doubleLoot: boolean; blessing: boolean }
): number {
	const offers =
		thanksgivingExpectedOffersFromTrip(durationMs, { doubleLoot, blessing }) * THANKSGIVING_HARVEST_DISCOUNT;
	return focus === 'bundles' ? offers * BUNDLES_PER_OFFER : offers * BASKETS_PER_OFFER;
}

export function rollThanksgivingHarvestParts({
	durationMs,
	focus,
	doubleLoot,
	blessing,
	rng
}: {
	durationMs: number;
	focus: ThanksgivingHarvestFocus;
	doubleLoot: boolean;
	blessing: boolean;
	rng: ThanksgivingRng;
}): Bank {
	const amount = rollExpected(rng, thanksgivingHarvestExpectedParts(durationMs, focus, { doubleLoot, blessing }));
	const loot = new Bank();
	if (amount > 0) {
		loot.add(focus === 'bundles' ? ThanksgivingItem.HARVEST_BUNDLE : ThanksgivingItem.WICKER_BASKET, amount);
	}
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

export const OFFER_RARE_ORDER = [
	'pilgrimHat',
	'strawHat',
	'gobbles',
	'laboon',
	'paintBox',
	'cornucopia',
	'turkey'
] as const;
export type OfferRareKey = (typeof OFFER_RARE_ORDER)[number];

export const OFFER_RARE_NAMES: Record<OfferRareKey, string> = {
	pilgrimHat: 'Pilgrim hat',
	strawHat: 'Straw hat',
	gobbles: 'Gobbles',
	laboon: 'Laboon',
	paintBox: 'Paint box',
	cornucopia: 'Cornucopia',
	turkey: 'Harvest turkey'
};

/** Best near-miss for one drop across a batch of offers, Launch box style (hit the top number to win). */
export interface OfferRareTrack {
	got: number;
	/** Best non-winning roll, shown as bestRoll/bestDenominator. 0 when nothing was rolled. */
	bestRoll: number;
	bestDenominator: number;
}

export interface OfferRollResult {
	loot: Bank;
	gotPityGobbles: boolean;
	streakOffers: number;
	rares: Record<OfferRareKey, OfferRareTrack>;
}

/**
 * Same RNG use as chance(): one randInt(1, SCALE) per roll, so results do not change.
 * Also records the closest miss on the 1/denominator scale that applied to that roll.
 */
function trackedChance(rng: ThanksgivingRng, probability: number, track: OfferRareTrack): boolean {
	if (probability <= 0) return false;
	if (probability >= 1) {
		track.got++;
		return true;
	}
	const raw = rng.randInt(1, SCALE);
	if (raw <= Math.round(probability * SCALE)) {
		track.got++;
		return true;
	}
	const denominator = Math.max(2, Math.round(1 / probability));
	const roll = Math.max(1, Math.min(denominator - 1, denominator - Math.ceil((raw / SCALE) * denominator) + 1));
	if (track.bestDenominator === 0 || roll / denominator > track.bestRoll / track.bestDenominator) {
		track.bestRoll = roll;
		track.bestDenominator = denominator;
	}
	return false;
}

function emptyTracks(): Record<OfferRareKey, OfferRareTrack> {
	const tracks = {} as Record<OfferRareKey, OfferRareTrack>;
	for (const key of OFFER_RARE_ORDER) tracks[key] = { got: 0, bestRoll: 0, bestDenominator: 0 };
	return tracks;
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
	const rares = emptyTracks();

	// The supply pack is the same every offer, so add it once for the whole batch (fast for big offers).
	if (quantity > 0) loot.add(thanksgivingStaticPack(blessing).multiply(quantity));

	for (let i = 0; i < quantity; i++) {
		const offerNumber = offersBefore + i + 1;
		const todayNumber = offersTodayBefore + i + 1;
		const streak = todayNumber >= GOBBLE_STREAK_OFFERS;
		if (streak) streakOffers++;
		const rareMult = streak ? GOBBLE_STREAK_RARE_MULTIPLIER : 1;

		// Below rares: Harvest Blessing applies.
		if (trackedChance(rng, uncommonMult / OFFER_RATES.paintBox, rares.paintBox)) loot.add('Paint box');
		if (trackedChance(rng, uncommonMult / OFFER_RATES.cornucopia, rares.cornucopia)) {
			loot.add(ThanksgivingItem.CORNUCOPIA_2021);
		}

		// Rares and above: Gobble Streak applies, Harvest Blessing does not.
		if (trackedChance(rng, rareMult / OFFER_RATES.pilgrimHat, rares.pilgrimHat))
			loot.add(ThanksgivingItem.PILGRIM_HAT);
		if (trackedChance(rng, rareMult / OFFER_RATES.strawHat, rares.strawHat)) loot.add(ThanksgivingItem.STRAW_HAT);
		if (trackedChance(rng, rareMult / OFFER_RATES.gobbles, rares.gobbles)) {
			loot.add(ThanksgivingItem.GOBBLES);
			hadGobbles = true;
		} else if (!hadGobbles && offerNumber >= GOBBLES_PITY_OFFERS) {
			loot.add(ThanksgivingItem.GOBBLES);
			rares.gobbles.got++;
			hadGobbles = true;
			gotPityGobbles = true;
		}
		if (trackedChance(rng, rareMult / OFFER_RATES.laboon, rares.laboon)) loot.add(ThanksgivingItem.LABOON);

		// Harvest turkey: rolled last (same RNG slot as the old supply roll, so earlier rolls do not change).
		// Gobble Streak and Harvest Blessing both apply.
		if (trackedChance(rng, (rareMult * uncommonMult) / OFFER_RATES.turkey, rares.turkey)) {
			loot.add(ThanksgivingItem.HARVEST_TURKEY);
		}
	}

	return { loot, gotPityGobbles, streakOffers, rares };
}

const STREAK_KEYS: readonly OfferRareKey[] = ['pilgrimHat', 'strawHat', 'gobbles', 'laboon'];
const BLESSING_KEYS: readonly OfferRareKey[] = ['paintBox', 'cornucopia'];

/** 1/N odds for a drop, after the Gobble Streak or Harvest Blessing boost if it applies. */
export function offerOddsDenominator(key: OfferRareKey, { streak, blessing }: { streak: boolean; blessing: boolean }) {
	const base = OFFER_RATES[key];
	if (key === 'turkey') {
		const mult = (streak ? GOBBLE_STREAK_RARE_MULTIPLIER : 1) * (blessing ? HARVEST_BLESSING_EVENT_MULTIPLIER : 1);
		return Math.round(base / mult);
	}
	if (streak && STREAK_KEYS.includes(key)) return Math.round(base / GOBBLE_STREAK_RARE_MULTIPLIER);
	if (blessing && BLESSING_KEYS.includes(key)) return Math.round(base / HARVEST_BLESSING_EVENT_MULTIPLIER);
	return base;
}

/**
 * Offer reply text (the loot itself is shown as a bank image). Launch box style best rolls,
 * then the short status lines.
 */
export function formatOfferReply({
	result,
	quantity,
	blessing,
	hadGobblesBefore,
	offersAfter,
	offersTodayAfter
}: {
	result: OfferRollResult;
	quantity: number;
	blessing: boolean;
	hadGobblesBefore: boolean;
	offersAfter: number;
	offersTodayAfter: number;
}): string {
	const rareLines = OFFER_RARE_ORDER.map(key => {
		const track = result.rares[key];
		const name = OFFER_RARE_NAMES[key];
		if (track.got > 0) {
			const pity = key === 'gobbles' && result.gotPityGobbles ? ` (${GOBBLES_PITY_OFFERS}-offer guarantee)` : '';
			return `**${name}: ✅ Got it!${track.got > 1 ? ` x${track.got}` : ''}${pity}**`;
		}
		return `${name}: best roll ${track.bestRoll}/${track.bestDenominator}`;
	});

	const lines: string[] = [`Your best rolls (hit the top number to win):`, ...rareLines];
	const streakOdds = STREAK_KEYS.map(k => offerOddsDenominator(k, { streak: true, blessing }));
	if (result.streakOffers > 0) {
		lines.push(
			`🦃 Gobble Streak: ${result.streakOffers}/${quantity} offers had +15% rare chances (hats and Gobbles 1/${streakOdds[0]}, Laboon 1/${streakOdds[3]}).`
		);
	} else if (offersTodayAfter < GOBBLE_STREAK_OFFERS) {
		lines.push(`Gobble Streak: ${offersTodayAfter}/${GOBBLE_STREAK_OFFERS} offers today (CT).`);
	}
	if (blessing) {
		lines.push(
			`Harvest Blessing: +15% supplies, Paint box 1/${offerOddsDenominator('paintBox', { streak: false, blessing })}, Cornucopia 1/${offerOddsDenominator('cornucopia', { streak: false, blessing })}, Harvest turkey 1/${offerOddsDenominator('turkey', { streak: false, blessing })}.`
		);
	}
	if (result.gotPityGobbles) {
		lines.push(`You reached ${GOBBLES_PITY_OFFERS} offers and Gobbles joined you!`);
	} else if (!hadGobblesBefore && result.rares.gobbles.got === 0) {
		lines.push(`Gobbles guarantee: ${Math.min(offersAfter, GOBBLES_PITY_OFFERS)}/${GOBBLES_PITY_OFFERS} offers.`);
	}
	lines.push(`Total offers: ${offersAfter.toLocaleString()}.`);
	return lines.join('\n');
}

/**
 * Quantity text from the command: blank or 'all' means every cornucopia owned, otherwise a whole number
 * (commas allowed). Returns null for anything else.
 */
export function parseOfferQuantity(input: string | number | null | undefined): number | 'all' | null {
	if (input === null || input === undefined) return 'all';
	if (typeof input === 'number') return Number.isSafeInteger(input) && input >= 1 ? input : null;
	const text = input.trim().toLowerCase().replace(/,/g, '');
	if (text === '' || text === 'all') return 'all';
	if (!/^\d+$/.test(text)) return null;
	const n = Number(text);
	return Number.isSafeInteger(n) && n >= 1 ? n : null;
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
/**
 * Extra fishing yield from Captain Laboon on top of its Straw hat stack (3% -> 10% total).
 * Tuned from tester trips: about +100 Rocktail on a 49 minute trip, matching Shelldon + Old crab cage.
 */
export const CAPTAIN_LABOON_YIELD_PERCENT = 7;

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
	/** Who gets credit for the extra fish in the trip message. */
	yieldLabel: string;
}

export function thanksgivingFishingBoosts(g: PetAndGear): FishingBoosts {
	const out: FishingBoosts = {
		speedMultiplier: 1,
		yieldPercent: 0,
		lines: [],
		usingLaboon: false,
		yieldLabel: 'the Straw hat'
	};
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
	if (g.usingPet(ThanksgivingItem.LABOON_STRAW_HAT, { ignoreSimilar: true })) {
		out.yieldPercent += CAPTAIN_LABOON_YIELD_PERCENT;
		out.yieldLabel = 'Captain Laboon and the Straw hat';
		out.lines.push(`+${CAPTAIN_LABOON_YIELD_PERCENT}% fishing yield (Captain Laboon)`);
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

/**
 * Announcement text for event pets gained in one action (offer, trip, /use). One line for all of them.
 * `clAfter` is the collection log after the pets were added, so the count says which one this is
 * (collection logs count every copy ever obtained). Returns null when no event pet was gained.
 */
export function thanksgivingPetAnnouncement({
	name,
	gained,
	clAfter,
	source
}: {
	name: string;
	gained: Bank;
	clAfter: Bank;
	source: string;
}): string | null {
	const parts: string[] = [];
	for (const id of thanksgivingPetIDs) {
		const qty = gained.amount(id);
		if (qty <= 0) continue;
		const petName = Items.itemNameFromId(id) ?? 'pet';
		const total = Math.max(qty, clAfter.amount(id));
		parts.push(
			qty === 1
				? `**${petName}** (their ${formatOrdinal(total)})`
				: `**${qty}x ${petName}** (${total.toLocaleString()} total)`
		);
	}
	if (parts.length === 0) return null;
	const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
	return `🦃 ${name} just got ${list} ${source}!`;
}
