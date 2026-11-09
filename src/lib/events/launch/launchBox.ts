import { Time } from '@oldschoolgg/toolkit';
import { Bank, type ItemBank, Items, itemID } from 'oldschooljs';

import type { UnifiedOpenable } from '@/lib/openables.js';
import { launchBoxCL } from './collectionLog.js';
import { LaunchItem } from './items.js';

export interface LaunchBoxRng {
	randInt(min: number, max: number): number;
}

/** Non-patron mystery boxes. Royal, Beach, and the Launch box itself are excluded. */
export const LAUNCH_BOX_MYSTERY_BOXES = [
	'Tradeable Mystery Box',
	'Untradeable Mystery Box',
	'Equippable mystery box',
	'Clothing Mystery Box',
	'Holiday Mystery Box',
	'Pet Mystery Box'
] as const;

export const LAUNCH_BOX_POTIONS: readonly (readonly [string, number])[] = [
	['Prayer potion(4)', 40],
	['Super restore(4)', 20],
	['Saradomin brew(4)', 20],
	['Super combat potion(4)', 15],
	['Ranging potion(4)', 15],
	['Magic potion(4)', 15],
	['Stamina potion(4)', 10],
	['Antifire potion(4)', 10],
	['Anti-venom+(4)', 10],
	['Super energy(4)', 10]
];

/** Every box gives each of these, in a range big enough to actually level with. [name, min, max] */
export const LAUNCH_BOX_MATERIALS: readonly (readonly [string, number, number])[] = [
	['Yew logs', 250, 1000],
	['Teak logs', 250, 1000],
	['Mahogany logs', 250, 1000],
	['Coal', 250, 1000],
	['Iron ore', 250, 1000],
	['Mithril ore', 250, 1000],
	['Uncut sapphire', 50, 200],
	['Uncut ruby', 50, 200],
	['Raw shark', 100, 300],
	['Big bones', 100, 400]
];

const SPOOKY_GRACEFUL = [
	'Spooky graceful hood',
	'Spooky graceful top',
	'Spooky graceful legs',
	'Spooky graceful gloves',
	'Spooky graceful boots',
	'Spooky graceful cape'
] as const;

const CLUE_SCROLLS: readonly (readonly [string, number, number, number])[] = [
	['Clue scroll (beginner)', 50, 1, 4],
	['Clue scroll (easy)', 40, 1, 3],
	['Clue scroll (medium)', 30, 1, 2],
	['Clue scroll (hard)', 20, 1, 1],
	['Clue scroll (elite)', 10, 1, 1],
	['Clue scroll (master)', 5, 1, 1]
];

const RARE_SCALE = 1_000_000;
export const CORGO_PARTY_HAT_PITY = 200;

export interface Closeness {
	got: boolean;
	/** Shown roll out of the denominator; hitting the denominator wins. */
	roll: number;
	denominator: number;
}

/** A 1/denominator roll. A raw roll of 1 wins and shows as denominator/denominator; others show lower. */
export function rareRoll(denominator: number, rawRoll: number): Closeness {
	const roll = denominator - rawRoll + 1;
	return { got: roll === denominator, roll, denominator };
}

function oneIn(rng: LaunchBoxRng, denominator: number): Closeness {
	return rareRoll(denominator, rng.randInt(1, denominator));
}

function note(track: Closeness, next: Closeness) {
	if (next.got) {
		track.got = true;
		track.roll = track.denominator;
		return;
	}
	if (!track.got && next.roll > track.roll) track.roll = next.roll;
}

function addMaterials(loot: Bank, rng: LaunchBoxRng) {
	for (const [name, min, max] of LAUNCH_BOX_MATERIALS) loot.add(name, rng.randInt(min, max));
}

/** Trips shorter than this can't roll a Launch box. */
export const LAUNCH_BOX_MIN_TRIP_MS = 20 * Time.Minute;

export const LAUNCH_BOX_BASE_MINUTES = 20;
export const LAUNCH_BOX_BASELINE_RATE_MINUTES = 112;
export const LAUNCH_BOX_TRIP_EXPONENT = 1.08;

export function launchBoxTripChance(durationMs: number, doubleLoot: boolean): number {
	if (durationMs < LAUNCH_BOX_MIN_TRIP_MS) return 0;
	const minutes = Math.max(0, durationMs) / Time.Minute;
	const baseExpected = LAUNCH_BOX_BASE_MINUTES / LAUNCH_BOX_BASELINE_RATE_MINUTES;
	const expected = (minutes / LAUNCH_BOX_BASE_MINUTES) ** LAUNCH_BOX_TRIP_EXPONENT * baseExpected;
	return expected * (doubleLoot ? 2 : 1);
}

export function rollLaunchBoxFromTrip({
	durationMs,
	doubleLoot,
	rng
}: {
	durationMs: number;
	doubleLoot: boolean;
	rng: LaunchBoxRng;
}): { amount: number } {
	const expected = launchBoxTripChance(durationMs, doubleLoot);
	if (expected <= 0) return { amount: 0 };
	const guaranteed = Math.floor(expected);
	const remainder = expected - guaranteed;
	const roll = rng.randInt(1, RARE_SCALE);
	return { amount: guaranteed + (roll <= Math.round(remainder * RARE_SCALE) ? 1 : 0) };
}

export function buildFounderLaunchExtras(rng: LaunchBoxRng): Bank {
	const loot = new Bank();
	for (const box of LAUNCH_BOX_MYSTERY_BOXES) {
		loot.add(box, rng.randInt(5, 10));
	}
	loot.add('Potato with cheese', 2000);
	for (const [name, qty] of LAUNCH_BOX_POTIONS) {
		loot.add(name, qty * 2);
	}
	// Founder claim gets double materials.
	addMaterials(loot, rng);
	addMaterials(loot, rng);
	loot.add(LaunchItem.LAUNCH_BOX);
	return loot;
}

const CLOSENESS_NAMES = ['Corgo party hat', 'Spooky piece', 'Gregoyle', 'Kuro', 'Flappy'] as const;

function closenessLine(name: string, track: Closeness): string {
	return track.got ? `${name}: ✅ Got it!` : `${name}: best roll ${track.roll}/${track.denominator}`;
}

export function openLaunchBoxes({
	quantity,
	boxesOpenedBefore,
	ownsPartyHat,
	rng
}: {
	quantity: number;
	boxesOpenedBefore: number;
	ownsPartyHat: boolean;
	rng: LaunchBoxRng;
}): { bank: Bank; message: string } {
	const loot = new Bank();
	const tracks: Record<(typeof CLOSENESS_NAMES)[number], Closeness> = {
		'Corgo party hat': { got: false, roll: 0, denominator: 75 },
		'Spooky piece': { got: false, roll: 0, denominator: 5 },
		Gregoyle: { got: false, roll: 0, denominator: 125 },
		Kuro: { got: false, roll: 0, denominator: 250 },
		Flappy: { got: false, roll: 0, denominator: 1000 }
	};
	let hasHat = ownsPartyHat;

	for (let i = 0; i < quantity; i++) {
		for (const box of LAUNCH_BOX_MYSTERY_BOXES) loot.add(box, rng.randInt(1, 3));
		loot.add('Potato with cheese', 2000);
		for (const [name, qty] of LAUNCH_BOX_POTIONS) loot.add(name, qty);
		loot.add('Air rune', 1000).add('Fire rune', 1000).add('Nature rune', 1000).add('Law rune', 500);
		addMaterials(loot, rng);
		if (rng.randInt(1, 3) === 1) loot.add('Cannonball', rng.randInt(1000, 3000));
		loot.add('Small lamp');
		if (rng.randInt(1, 4) === 1) loot.add('Average lamp');
		if (rng.randInt(1, 12) === 1) loot.add('Large lamp');
		for (const [name, percent, min, max] of CLUE_SCROLLS) {
			loot.add(name);
			if (rng.randInt(1, 100) <= percent) loot.add(name, rng.randInt(min, max));
		}
		if (rng.randInt(1, 5) === 1) loot.add('Coins', 1_000_000);
		if (rng.randInt(1, 15) === 1) loot.add('Coins', 3_000_000);
		if (rng.randInt(1, 40) === 1) loot.add('Coins', 5_000_000);

		const spooky = oneIn(rng, 5);
		note(tracks['Spooky piece'], spooky);
		if (spooky.got) loot.add(SPOOKY_GRACEFUL[rng.randInt(0, SPOOKY_GRACEFUL.length - 1)]);

		const openNumber = boxesOpenedBefore + i + 1;
		const hat = oneIn(rng, 75);
		const pity = !hasHat && openNumber >= CORGO_PARTY_HAT_PITY;
		const hatHit = hat.got || pity;
		note(tracks['Corgo party hat'], hatHit ? { got: true, roll: 75, denominator: 75 } : hat);
		if (hatHit) {
			loot.add(LaunchItem.CORGO_PARTY_HAT);
			hasHat = true;
		}

		const greg = oneIn(rng, 125);
		note(tracks.Gregoyle, greg);
		if (greg.got) loot.add('Gregoyle');
		const kuro = oneIn(rng, 250);
		note(tracks.Kuro, kuro);
		if (kuro.got) loot.add('Kuro');
		const flappy = oneIn(rng, 1000);
		note(tracks.Flappy, flappy);
		if (flappy.got) loot.add('Flappy');
		if (rng.randInt(1, 50) === 1) loot.add(LaunchItem.DOUBLE_XP_TOKEN);
		if (rng.randInt(1, 50) === 1) loot.add('Double loot token');
	}

	const closeness = CLOSENESS_NAMES.map(name => closenessLine(name, tracks[name])).join('\n');
	return {
		bank: loot,
		message: `${loot}\nYour best rolls (hit the top number to win):\n${closeness}`
	};
}

export async function openLaunchBoxForUser(user: MUser, quantity: number, rng: LaunchBoxRng) {
	const scores = await user.fetchUserStat('openable_scores');
	const opened = new Bank((scores ?? {}) as ItemBank).amount(LaunchItem.LAUNCH_BOX);
	return openLaunchBoxes({
		quantity,
		boxesOpenedBefore: opened,
		ownsPartyHat: user.allItemsOwned.has(LaunchItem.CORGO_PARTY_HAT),
		rng
	});
}

const launchBoxOpenableItems = [
	...launchBoxCL,
	...LAUNCH_BOX_MYSTERY_BOXES.map(name => itemID(name)),
	itemID('Small lamp'),
	itemID('Average lamp'),
	itemID('Large lamp'),
	itemID('Cannonball'),
	...CLUE_SCROLLS.map(([name]) => itemID(name))
];

export const launchBoxOpenable: UnifiedOpenable = {
	name: 'Launch box',
	id: LaunchItem.LAUNCH_BOX,
	openedItem: Items.getOrThrow(LaunchItem.LAUNCH_BOX),
	aliases: ['launch box', 'launchbox'],
	allItems: launchBoxOpenableItems,
	smokeyApplies: false,
	output: async ({ user, quantity, rng }) => openLaunchBoxForUser(user, quantity, rng)
};
