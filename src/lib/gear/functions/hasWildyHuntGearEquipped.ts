import { allEquipmentSlots, type GearSetup } from '@oldschoolgg/gear';
import { Items } from 'oldschooljs';

export function hasWildyHuntGearEquipped(setup: GearSetup): [boolean, string, number] {
	const minimumStatRequirements = {
		DefenceMage: 68,
		DefenceRanged: 76,
		DefenceStab: 48,
		DefenceSlash: 58,
		DefenceCrush: 71
	};

	// Masori body (f) + Masori chaps (f). Score still caps at 100% against this maximum.
	const maximumStatsBodyLegs = {
		DefenceMage: 120,
		DefenceRanged: 97,
		DefenceStab: 94,
		DefenceSlash: 82,
		DefenceCrush: 103
	};

	const userStats = {
		userDefenceMage: 0,
		userDefenceRanged: 0,
		userDefenceStab: 0,
		userDefenceSlash: 0,
		userDefenceCrush: 0
	};

	let equippedWithStats = 0;
	for (const slot of allEquipmentSlots) {
		const equipped = setup[slot];
		if (!equipped?.item) continue;
		const item = Items.getOrThrow(equipped.item);
		if (!item.equipment) continue;
		equippedWithStats += 1;
		userStats.userDefenceMage += item.equipment.defence_magic;
		userStats.userDefenceRanged += item.equipment.defence_ranged;
		userStats.userDefenceStab += item.equipment.defence_stab;
		userStats.userDefenceSlash += item.equipment.defence_slash;
		userStats.userDefenceCrush += item.equipment.defence_crush;
	}

	if (equippedWithStats === 0) {
		return [false, 'Armour equipped in the wildy setup.', 0];
	}

	if (
		userStats.userDefenceMage < minimumStatRequirements.DefenceMage ||
		userStats.userDefenceRanged < minimumStatRequirements.DefenceRanged ||
		userStats.userDefenceCrush < minimumStatRequirements.DefenceCrush ||
		userStats.userDefenceSlash < minimumStatRequirements.DefenceSlash ||
		userStats.userDefenceStab < minimumStatRequirements.DefenceStab
	) {
		return [
			false,
			`The combined defensive stats for the gear equipped in wildy setup doesn't meet the minimum required stats: ${minimumStatRequirements.DefenceMage} Magic Defence, ${minimumStatRequirements.DefenceRanged} Ranged Defence, ${minimumStatRequirements.DefenceStab} Stab Defence, ${minimumStatRequirements.DefenceSlash} Slash Defence, ${minimumStatRequirements.DefenceCrush} Crush Defence.`,
			0
		];
	}

	let score =
		Math.min(userStats.userDefenceMage / maximumStatsBodyLegs.DefenceMage, 1) +
		Math.min(userStats.userDefenceRanged / maximumStatsBodyLegs.DefenceRanged, 1) +
		Math.min(userStats.userDefenceCrush / maximumStatsBodyLegs.DefenceCrush, 1) +
		Math.min(userStats.userDefenceSlash / maximumStatsBodyLegs.DefenceSlash, 1) +
		Math.min(userStats.userDefenceStab / maximumStatsBodyLegs.DefenceStab, 1);

	score /= 5;
	score *= 100;
	score = Math.round(score);

	return [
		true,
		`The combined defensive stats for the gear equipped in wildy setup is ${score}% of maximum possible stats in each defensive stats.`,
		score
	];
}
