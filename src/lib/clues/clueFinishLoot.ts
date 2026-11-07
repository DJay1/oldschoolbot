import { BSOEmoji } from '@/lib/bso/bsoEmoji.js';

import { Bank } from 'oldschooljs';

/** Short note that Zippy added items. The quantities live in the trip loot image. */
export const ZIPPY_FOUND_LOOT_LINE = `${BSOEmoji.Zippy} Zippy found extra loot.`;

/**
 * Bonus lines for a clue trip. Item quantities are not listed here; the trip finish
 * image shows the combined pile (caskets, Zippy's finds, and any doubles).
 */
export function zippyClueFinishLines(input: { bonusLoot: Bank; doubled: boolean }): string {
	let lines = '';
	if (input.doubled) lines += '\nZippy has **doubled** your loot.';
	if (input.bonusLoot.length > 0) lines += `\n${ZIPPY_FOUND_LOOT_LINE}`;
	return lines;
}

/**
 * One bank for the clue-trip loot image: the trip's own loot (caskets, Zippy's finds,
 * Zippy's double, First Age casket double) plus anything trip finish added on top
 * (loot doubling, pet bonuses, and similar extras).
 *
 * Returns null when that pile is only the clue caskets the trip always produces, so a
 * clue finish with no Zippy and no other bonus stays a text message.
 */
export function clueFinishLootImage(input: {
	loot: Bank | null | undefined;
	extras: Bank | null | undefined;
	base: Bank | null;
}): Bank | null {
	const combined = new Bank();
	if (input.loot?.length) combined.add(input.loot);
	if (input.extras?.length) combined.add(input.extras);
	if (combined.length === 0) return null;
	if (input.base && combined.equals(input.base)) return null;
	return combined;
}
