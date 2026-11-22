/**
 * Other members of a group trip (raid, mass, dungeon party) besides the user
 * handleTripFinish runs for (the leader). Deduped, so nobody is credited twice.
 */
export function groupTripExtraMemberIDs(data: object, rollerID: string): string[] {
	const users = 'users' in data ? data.users : undefined;
	if (!Array.isArray(users)) return [];
	const ids = users.filter((id): id is string => typeof id === 'string' && id !== rollerID);
	return [...new Set(ids)];
}

/** Biggest party that stores a `users` list on the trip (Dungeoneering). */
export const GROUP_TRIP_MAX_MEMBERS = 20;
