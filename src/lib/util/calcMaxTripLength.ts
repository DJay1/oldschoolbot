import { calcPercentOfNum, calcWhatPercent, Time } from '@oldschoolgg/toolkit';

import type { activity_type_enum } from '@/prisma/main.js';
import { bscPatronTripBonusMs, bscTripBonusForPerkTier } from '@/lib/bsc/patronTiers.js';
import { BitField, PerkTier } from '@/lib/constants.js';
import { isEventActive } from '@/lib/events/registry.js';
import {
	GOBBLES_TRIP_LENGTH_MULTIPLIER,
	LABOON_TRIP_LENGTH_MULTIPLIER,
	usingGobblesPet,
	usingLaboonPet
} from '@/lib/events/thanksgiving/core.js';
import { getCyrTripBonus, RobochimpBitfieldEnum } from '@/lib/perkTiers.js';
import { applyTripLengthMultiplier, finalizeTripLength } from '@/lib/util/tripLength.js';

export function patronMaxTripBonus(perkTier: PerkTier | 0) {
	return bscTripBonusForPerkTier(perkTier);
}

export function patronTripBonusFromSources(
	perkTier: PerkTier | 0,
	bitfield: readonly number[],
	roboBits: number[]
): number {
	return Math.max(bscPatronTripBonusMs(bitfield), patronMaxTripBonus(perkTier), getCyrTripBonus(roboBits));
}

export async function getPatronTripBonusMs(user: MUser): Promise<number> {
	const perkTier = await user.fetchPerkTier({ forceNoCache: true });
	const roboBits = (await Cache.getRoboChimpUser(user.id)).bits;
	return patronTripBonusFromSources(perkTier, user.bitfield, roboBits);
}

const HP_CAPE_20_PERCENT: readonly activity_type_enum[] = [
	'Nightmare',
	'GroupMonsterKilling',
	'MonsterKilling',
	'Wintertodt',
	'Zalcano',
	'BarbarianAssault',
	'AnimatedArmour',
	'Sepulchre',
	'Raids',
	'TheatreOfBlood',
	'TombsOfAmascut',
	'FracturedArchive',
	'Pickpocket',
	'SoulWars',
	'Cyclops'
];

const HP_CAPE_10_PERCENT: readonly activity_type_enum[] = [
	'KalphiteKing',
	'Nex',
	'VasaMagus',
	'Ignecarus',
	'KingGoldemar',
	'Moktang',
	'DepthsOfAtlantis',
	'Naxxus',
	'TuraelsTrials',
	'Dungeoneering'
];

/**
 * Extra max trip length (percent) from a Hitpoints master cape for this activity. These activities also get the
 * regular Hitpoints level boost. 0 means neither applies.
 */
export function masterHPCapeTripBoostPercent(activity?: activity_type_enum): number {
	if (!activity) return 0;
	if (HP_CAPE_20_PERCENT.includes(activity)) return 20;
	if (HP_CAPE_10_PERCENT.includes(activity)) return 10;
	return 0;
}

export async function calcMaxTripLength(user: MUser, activity?: activity_type_enum) {
	const perkTier = await user.fetchPerkTier({ forceNoCache: true });
	const roboBits = (await Cache.getRoboChimpUser(user.id)).bits;
	const patronBonusMs = patronTripBonusFromSources(perkTier, user.bitfield, roboBits);
	let max = Time.Minute * 30;
	max += patronBonusMs;

	if (roboBits.includes(RobochimpBitfieldEnum.BonusMinute)) {
		max += Time.Minute * 3;
	}

	const hasMasterHPCape = user.hasEquipped('Hitpoints master cape');
	const masterHPCapeBoost = masterHPCapeTripBoostPercent(activity);
	const regularHPBoost = masterHPCapeBoost > 0;

	switch (activity) {
		case 'Alching': {
			max = applyTripLengthMultiplier(max, 2, patronBonusMs);
			break;
		}
		case 'TinkeringWorkshop':
		case 'Disassembling':
		case 'Research': {
			if (user.hasEquippedOrInBank('Materials bag')) {
				max += Time.Minute * 7;
			}
			break;
		}
		case 'NightmareZone': {
			max = applyTripLengthMultiplier(max, 3, patronBonusMs);
			break;
		}
		case 'Fishing': {
			if (user.usingPet('Patricia')) {
				max *= 1.75;
			}
			if (user.usingPet('Partycrab')) {
				max *= 1.6;
			}
			if (user.usingPet('Shelldon')) {
				max *= 1.25;
			}
			if (usingLaboonPet(user)) {
				max = applyTripLengthMultiplier(max, LABOON_TRIP_LENGTH_MULTIPLIER, patronBonusMs);
			}
			break;
		}
		case 'AerialFishing': {
			// Straw Hat Harvest: Laboon helps with Aerial fishing the same way as normal fishing.
			if (usingLaboonPet(user)) {
				max = applyTripLengthMultiplier(max, LABOON_TRIP_LENGTH_MULTIPLIER, patronBonusMs);
			}
			break;
		}
		case 'BeachCombing': {
			if (!isEventActive('summer')) break;
			if (user.usingPet('Patricia')) {
				max *= 2;
			}
			if (user.usingPet('Partycrab')) {
				max += Time.Minute * 30;
			}
			if (user.usingPet('Shelldon')) {
				max += Time.Minute * 25;
			}
			break;
		}
		default: {
			break;
		}
	}

	if (regularHPBoost) {
		const hpLevel = user.skillsAsLevels.hitpoints;
		const hpPercent = calcWhatPercent(hpLevel - 10, 99 - 10);
		max += calcPercentOfNum(hpPercent, Time.Minute * 5);

		if (hasMasterHPCape) {
			max += calcPercentOfNum(masterHPCapeBoost, max);
		}
	}

	if (user.usingPet('Zak')) {
		max *= 1.4;
	}
	if (usingGobblesPet(user)) {
		max = applyTripLengthMultiplier(max, GOBBLES_TRIP_LENGTH_MULTIPLIER, patronBonusMs);
	}

	const sac = Number(user.user.sacrificedValue);
	const { isIronman } = user;
	const sacPercent = Math.min(100, calcWhatPercent(sac, isIronman ? 5_000_000_000 : 10_000_000_000));
	max += calcPercentOfNum(sacPercent, perkTier >= PerkTier.Four ? Time.Minute * 3 : Time.Minute);

	if (user.bitfield.includes(BitField.HasLeaguesOneMinuteLengthBoost)) {
		max += Time.Minute;
	}

	return finalizeTripLength(max);
}
