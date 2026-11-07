import { BSOItem } from '@/lib/bso/BSOItem.js';

import { customEmoji, Time } from '@oldschoolgg/toolkit';
import type { RNGProvider } from 'node-rng';
import { type Bank, Items } from 'oldschooljs';

import { isEventActive } from '@/lib/events/registry.js';
import { convertMysteriousBottleToSeaWater, getEclipsePetName } from '@/lib/events/summer/summerDays.js';
import type { GearBank } from '@/lib/structures/GearBank.js';

function speedMultiplierFromPercentReduction(percent: number) {
	return 1 / (1 - percent / 100);
}

/**
 * Speed and trip-length bonuses from Patricia, Lydia, Partycrab, and an equipped
 * Old crab cage. These are effects of items the player already owns, so they
 * stay on while the summer event is disabled.
 */
export function summerFishingStartAdjustments(gearBank: GearBank, fishName: string) {
	const boosts: string[] = [];
	let speedMultiplier = 1;
	let extraMaxTripLength = 0;
	const hasOldCrabCageEquipped = gearBank.hasEquipped(BSOItem.OLD_CRAB_CAGE);
	const patriciaPetID = gearBank.usingPet('Patricia', { returnID: true });
	const hasPatriciaEquipped = Boolean(patriciaPetID);
	const eclipsePetName = patriciaPetID ? Items.getOrThrow(patriciaPetID).name : 'Patricia';
	const isPatriciaLobsterBoost = fishName === 'Lobster' && hasPatriciaEquipped && hasOldCrabCageEquipped;

	if (hasPatriciaEquipped) {
		if (isPatriciaLobsterBoost) {
			speedMultiplier *= 3;
			boosts.push(
				`${customEmoji('starfish')} 3x faster for ${eclipsePetName} and Old crab cage while fishing Lobster`
			);
		} else {
			speedMultiplier *= 2.15;
			boosts.push(
				`${customEmoji('starfish')} ${eclipsePetName} is your new best friend! You two become an expert fishing pair!`
			);
		}
	}

	if (hasOldCrabCageEquipped) {
		extraMaxTripLength += Time.Minute * 5;
		boosts.push('+5 minutes for Old crab cage');
		if (!isPatriciaLobsterBoost) {
			speedMultiplier *= speedMultiplierFromPercentReduction(20);
			boosts.push('20% faster for Old crab cage');
		}
	}

	return {
		speedMultiplier,
		extraMaxTripLength,
		boosts,
		suppressShelldon: hasPatriciaEquipped
	};
}

export async function applySummerFishingLoot({
	user,
	fish,
	duration,
	rng,
	result
}: {
	user: MUser;
	fish: { name: string; alias?: readonly string[] };
	duration: number;
	rng: RNGProvider;
	result: {
		updateBank: { itemLootBank: Bank };
		messages: string[];
	};
}) {
	if (isEventActive('summer')) {
		rollSummerFishingDrops({ user, fish, duration, rng, result });
	}
	await convertEquippedMysteriousBottle(user, duration, rng, result);
}

function rollSummerFishingDrops({
	user,
	fish,
	duration,
	rng,
	result
}: {
	user: MUser;
	fish: { name: string; alias?: readonly string[] };
	duration: number;
	rng: RNGProvider;
	result: {
		updateBank: { itemLootBank: Bank };
		messages: string[];
	};
}) {
	let bottleRate = 500;
	if (fish.name === 'Rocktail') bottleRate = 350;
	if (fish.name === 'Manta ray') bottleRate = 250;
	if (fish.name === 'Lobster') bottleRate = 150;
	if (fish.name === 'Mackerel') bottleRate = 100;
	if (fish.alias?.includes('herring')) bottleRate = 100;
	const hasPatriciaEquipped = user.usingPet('Patricia');
	const eclipsePetName = hasPatriciaEquipped ? getEclipsePetName(user) : 'Patricia';
	if (hasPatriciaEquipped) bottleRate = Math.floor(bottleRate * 0.5);
	if (user.usingPet('Partycrab')) bottleRate = Math.floor(bottleRate * 0.7);

	let crabCageRate = hasPatriciaEquipped ? 100 : 250;
	if (fish.name === 'Lobster') crabCageRate = Math.floor(crabCageRate * 0.5);
	const minutes = Math.floor(duration / Time.Minute);
	const userAlreadyHasCrabCage = user.allItemsOwned.has(BSOItem.OLD_CRAB_CAGE);

	let bottlesFound = 0;
	for (let i = 0; i < minutes; i++) {
		if (rng.roll(bottleRate)) {
			bottlesFound++;
		}
	}
	if (bottlesFound) {
		result.updateBank.itemLootBank.add(BSOItem.MYSTERIOUS_BOTTLE, bottlesFound);
		if (bottlesFound === 1) {
			result.messages.push('🏝🍹You gently tug something from the shallows: a **Mysterious bottle!**.');
		} else {
			result.messages.push(
				`🏝️🍹You got quite the haul! You drug ${bottlesFound}x **Mysterious bottles** out of the ocean!.`
			);
		}
	}

	if (!userAlreadyHasCrabCage) {
		for (let i = 0; i < minutes; i++) {
			if (rng.roll(crabCageRate)) {
				result.updateBank.itemLootBank.add(BSOItem.OLD_CRAB_CAGE);
				result.messages.push(
					hasPatriciaEquipped
						? `🦀 ${eclipsePetName} tugged something rusted from the shallows: an **Old crab cage**.`
						: '🦀 A strange force helped you draw something rusted from the briny deep: an **Old crab cage**.'
				);
				break;
			}
		}
	}
	if (hasPatriciaEquipped) {
		if (fish.name === 'Lobster' && user.hasEquipped(BSOItem.OLD_CRAB_CAGE) && !user.cl.has(BSOItem.PARTYCRAB)) {
			for (let i = 0; i < minutes; i++) {
				if (rng.roll(24 * 60)) {
					result.updateBank.itemLootBank.add(BSOItem.PARTYCRAB);
					result.messages.push(
						`${customEmoji('partycrab')} The old crab cage rattled, and a Partycrab climbed out like it had been waiting years for this moment.`
					);
					break;
				}
			}
		}
	}
}

async function convertEquippedMysteriousBottle(
	user: MUser,
	duration: number,
	rng: RNGProvider,
	result: { messages: string[] }
) {
	if (!user.hasEquipped(BSOItem.MYSTERIOUS_BOTTLE)) return;
	const mysteriousBottleChance = user.usingPet('Patricia')
		? 500
		: user.usingPet('Partycrab')
			? 650
			: user.usingPet('Shelldon')
				? 750
				: 1000;
	const minutes = Math.floor(duration / Time.Minute);
	for (let i = 0; i < minutes; i++) {
		if (!rng.roll(mysteriousBottleChance)) continue;
		if (await convertMysteriousBottleToSeaWater(user)) {
			result.messages.push(
				'🫙 A cold violet current swirled into your Mysterious bottle while fishing. It is now a **Bottle of sea water**'
			);
		}
		break;
	}
}
