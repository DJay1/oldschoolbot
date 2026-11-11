import { isEventActive } from '@/lib/events/registry.js';
import { removeFromArr } from '@oldschoolgg/toolkit';
import { convertXPtoLVL, type ItemBank, Items } from 'oldschooljs';

import type { Prisma } from '@/prisma/main.js';
import { type BitField, BitFieldData, MAX_LEVEL, MAX_XP } from '@/lib/constants.js';
import { allPetIDs } from '@/lib/data/CollectionsExport.js';
import type { SkillNameType } from '@/lib/skilling/types.js';
import type { GearBank } from '@/lib/structures/GearBank.js';

// @ts-expect-error ignore
BigInt.prototype.toJSON = function () {
	return this.toString();
};

/** Halve a 1/n pet-chance denominator during the launch event (twice as likely). */
export function launchPetRate(n: number): number {
	if (!isEventActive('launch')) return n;
	return Math.max(1, Math.floor(n / 2));
}

/** Double a percent-based pet chance during the launch event, capped at 100. */
export function launchPetPercent(chancePercent: number): number {
	if (!isEventActive('launch')) return chancePercent;
	return Math.min(100, chancePercent * 2);
}

/**
 * 50% tertiary boost (halves the 1/n chance) for boss/PvM pets during launch.
 * Used by loot tables via tertiaryItemPercentageChanges. Skips Smokey (mystery box).
 */
export function launchPetTertiaryChanges(): Map<string, number> | undefined {
	if (!isEventActive('launch')) return undefined;
	const changes = new Map<string, number>();
	for (const id of allPetIDs) {
		const item = Items.get(id);
		if (!item?.name || item.name === 'Smokey') continue;
		changes.set(item.name, 50);
	}
	return changes;
}

export function skillingPetDropRate(
	user: MUser | GearBank | number,
	skill: SkillNameType,
	baseDropRate: number
): { petDropRate: number } {
	const xp = typeof user === 'number' ? user : user.skillsAsXP[skill];
	const twoHundredMillXP = xp >= MAX_XP;
	const skillLevel = convertXPtoLVL(xp, MAX_LEVEL);
	const petRateDivisor = twoHundredMillXP ? 15 : 1;
	const dropRate = launchPetRate(Math.floor((baseDropRate - skillLevel * 25) / petRateDivisor));
	return { petDropRate: dropRate };
}

export async function toggleBitfield(user: MUser, bit: BitField, toggleName?: string) {
	const includedNow = user.bitfield.includes(bit);
	const nextArr = includedNow ? removeFromArr(user.bitfield, bit) : [...user.bitfield, bit];
	await user.update({
		bitfield: nextArr
	});
	const name = toggleName ?? BitFieldData[bit].name;
	return `Toggled '${name}' ${includedNow ? 'Off' : 'On'}`;
}

export function getIdFromMention(mention: string) {
	const id = mention.replace(/[<@#&/!>]/g, '');
	const parts = id.split(':');
	return parts[0];
}

export async function runTimedLoggedFn<T>(name: string, fn: () => Promise<T>): Promise<T> {
	const start = performance.now();
	const result = await fn();
	const end = performance.now();
	Logging.logPerf({
		text: name,
		duration: end - start
	});
	return result;
}

export type JsonKeys<T> = {
	[K in keyof T]: T[K] extends Prisma.JsonValue ? K : never;
}[keyof T];

export function ISODateString(date?: Date) {
	return (date ?? new Date()).toISOString().slice(0, 10);
}

// Safe version for masks etc
export function addItemBanks(banks: ItemBank[]): ItemBank {
	const bank: ItemBank = {};
	for (const _bank of banks) {
		for (const [item, qty] of Object.entries(_bank)) {
			bank[item] = (bank[item] ?? 0) + qty;
		}
	}
	return bank;
}
