import { EItem } from 'oldschooljs';

/** Vanilla OSRS one-handed melee weapon. */
export const SOULFLAME_HORN_ID = EItem.SOULFLAME_HORN;

/** Trip-speed reduction for group raids (2 or more distinct players) only. */
export const SOULFLAME_HORN_GROUP_SPEED_PERCENT = 5;

export const SOULFLAME_HORN_BOOST_LINE = 'Soulflame horn (groups of 2+): 5% faster';

export const SOULFLAME_HORN_YOUR_BOOST = 'Soulflame horn (5%, groups of 2+)';

export function uniqueRaidTeamSize(users: { id: string }[]): number {
	return new Set(users.map(u => u.id)).size;
}

export function userHasSoulflameHornEquipped(user: {
	gear: { melee: { hasEquipped(item: string | number, ...args: unknown[]): boolean } };
}): boolean {
	return user.gear.melee.hasEquipped(SOULFLAME_HORN_ID);
}

/**
 * Per-user 5% speed boost when the horn is equipped in the melee setup
 * and the raid has at least 2 distinct players. Duplicate IDs (ToB trio
 * padding, a cloned solo team) count as one player and get no boost.
 */
export function soulflameHornSpeedBoost(
	team: { id: string }[],
	user: { gear: { melee: { hasEquipped(item: string | number, ...args: unknown[]): boolean } } }
): number {
	if (uniqueRaidTeamSize(team) < 2) return 0;
	return userHasSoulflameHornEquipped(user) ? SOULFLAME_HORN_GROUP_SPEED_PERCENT : 0;
}

export function applySoulflameHornToTfaTeam(
	team: { soulflameHorn?: boolean }[],
	users: { id: string; gear: { melee: { hasEquipped(item: string | number, ...args: unknown[]): boolean } } }[]
) {
	const group = uniqueRaidTeamSize(users) >= 2;
	for (let i = 0; i < team.length; i++) {
		team[i].soulflameHorn = group && userHasSoulflameHornEquipped(users[i]);
	}
}
