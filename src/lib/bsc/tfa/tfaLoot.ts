import { MathRNG, type RNGProvider } from 'node-rng';
import { Bank, LootTable } from 'oldschooljs';

import { TfaItem, tfaFragmentIDs } from '@/lib/bsc/tfa/tfaItems.js';

/**
 * Team unique chance ("1 in X") by team size, from the OSRS wiki chest page
 * (flat rates since the 11 Nov 2026 update). Solo uses the duo rate.
 */
const TEAM_UNIQUE_ODDS: Record<number, number> = {
	1: 16,
	2: 16,
	3: 12.5,
	4: 10.5,
	5: 9.5,
	6: 8.5,
	7: 8,
	8: 7.5
};

export function tfaTeamUniqueOdds(teamSize: number): number {
	const size = Math.min(8, Math.max(1, Math.floor(teamSize)));
	return TEAM_UNIQUE_ODDS[size];
}

/** Weights out of 15: 1/3, 1/3.75, 1/5, 1/7.5, 1/15. */
export const TfaUniqueTable = new LootTable()
	.add(TfaItem.RONDACHE, 1, 5)
	.add(TfaItem.ZORYAS_TOME, 1, 4)
	.add(TfaItem.HORN_OF_BRAN, 1, 3)
	.add(TfaItem.ASCENSION_CROSSBOWS, 1, 2)
	.add(TfaItem.OBLIGATOR, 1, 1);

/**
 * Standard loot (one roll). Weights are out of 330 so 1/30 = 11, 1/47.14 = 7,
 * 1/55 = 6 and 1/6 = 55. The wiki's listed rates add up to slightly more than 1,
 * so every entry ends up a little under its wiki rate (about 2%).
 */
export const TfaStandardTable = new LootTable()
	// Weapons and armour
	.add('Battlestaff', [34, 37], 11)
	.add('Dragon platelegs', 1, 11)
	.add('Dragon plateskirt', 1, 11)
	.add('Rune kiteshield', [5, 7], 11)
	// Runes
	.add('Nature rune', [301, 385], 11)
	.add('Astral rune', [301, 385], 11)
	.add('Blood rune', [301, 385], 11)
	.add('Soul rune', [301, 380], 11)
	.add('Earth rune', [3009, 3662], 11)
	// Herbs
	.add('Grimy harralander', [60, 66], 7)
	.add('Grimy ranarr weed', [18, 20], 7)
	.add('Grimy toadflax', [24, 28], 7)
	// Seeds
	.add('Snapdragon seed', [3, 4], 7)
	.add('Kwuarm seed', [7, 8], 7)
	.add('Snape grass seed', [7, 8], 7)
	.add('Yew seed', [4, 5], 7)
	// Ores and gems
	.add('Sapphire', [24, 27], 11)
	.add('Emerald', [24, 26], 11)
	.add('Ruby', [23, 27], 11)
	.add('Diamond', [24, 26], 11)
	.add('Iron ore', [851, 915], 6)
	.add('Adamantite ore', [60, 72], 6)
	.add('Runite ore', [25, 26], 6)
	// Other
	.add(TfaItem.ASCENSION_SHARDS, [91, 93], 55)
	.add('Onyx bolt tips', [50, 58], 11)
	.add('Earth orb', [68, 75], 11)
	.add('Wine of zamorak', [32, 36], 7)
	.add('Desiccated page', [30, 36], 6)
	.add('Aether catalyst', [180, 191], 6)
	.add('Pure essence', [1404, 1632], 6)
	.add('Mahogany logs', [140, 152], 6)
	.add('Dragon arrowtips', [350, 369], 6)
	.add('Raw shark', [80, 92], 6);

export const TFA_STANDARD_ROLLS = 3;
/** Each standard roll has a 1/51 chance to be multiplied by 5. */
export const TFA_STANDARD_MULTIPLIER_ODDS = 51;
export const TFA_ELITE_CLUE_ODDS = 10;
export const TFA_FOLIO_ODDS = 15;
export const TFA_FRAGMENT_ODDS = 14;
export const TFA_ORION_ODDS = 750;

export function rollTfaStandardLoot(rng: RNGProvider = MathRNG): Bank {
	const loot = new Bank();
	for (let i = 0; i < TFA_STANDARD_ROLLS; i++) {
		const roll = TfaStandardTable.roll(1, { rng });
		if (rng.roll(TFA_STANDARD_MULTIPLIER_ODDS)) roll.multiply(5);
		loot.add(roll);
	}
	return loot;
}

export function rollTfaUniqueItem(rng: RNGProvider = MathRNG): number {
	const loot = TfaUniqueTable.roll(1, { rng });
	return loot.items()[0][0].id;
}

/**
 * Picks who gets the unique, weighted by contribution points.
 * If nobody has any points, everyone has an equal chance.
 */
export function pickTfaUniqueRecipient(
	contributions: { id: string; points: number }[],
	rng: RNGProvider = MathRNG
): string {
	const total = contributions.reduce((acc, c) => acc + Math.max(0, c.points), 0);
	if (total <= 0) return contributions[rng.randInt(0, contributions.length - 1)].id;
	let ticket = rng.rand() * total;
	for (const c of contributions) {
		ticket -= Math.max(0, c.points);
		if (ticket < 0) return c.id;
	}
	return contributions[contributions.length - 1].id;
}

/**
 * Tertiary rolls for one player on a completed raid.
 * - Folio only if the player doesn't already own one (bank/CL check done by caller via `ownsFolio`).
 * - Fragments avoid duplicates: the player gets one they haven't got yet; none once all 4 are logged.
 */
export function rollTfaTertiaries({
	ownsFolio,
	fragmentsObtained,
	petOdds = TFA_ORION_ODDS,
	rng = MathRNG
}: {
	ownsFolio: boolean;
	fragmentsObtained: number[];
	petOdds?: number;
	rng?: RNGProvider;
}): Bank {
	const loot = new Bank();
	if (rng.roll(TFA_ELITE_CLUE_ODDS)) loot.add('Clue scroll (elite)');
	if (!ownsFolio && rng.roll(TFA_FOLIO_ODDS)) loot.add(TfaItem.ARCHIVISTS_FOLIO);
	const missingFragments = tfaFragmentIDs.filter(id => !fragmentsObtained.includes(id));
	if (missingFragments.length > 0 && rng.roll(TFA_FRAGMENT_ODDS)) {
		loot.add(missingFragments[rng.randInt(0, missingFragments.length - 1)]);
	}
	if (rng.roll(petOdds)) loot.add(TfaItem.ORION);
	return loot;
}
