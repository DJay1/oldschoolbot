/** /lb top_roles runs several ranking queries; this keeps it from being spammed. */
export const TOP_ROLES_COOLDOWN_MS = 15_000;
const lastUse = new Map<string, number>();

/** Ms left on this user's Top roles cooldown. Starts a new cooldown when it returns 0. */
export function topRolesCooldownLeft(userId: string, now: number): number {
	const last = lastUse.get(userId);
	if (last !== undefined && now - last < TOP_ROLES_COOLDOWN_MS) {
		return TOP_ROLES_COOLDOWN_MS - (now - last);
	}
	lastUse.set(userId, now);
	if (lastUse.size > 5000) {
		for (const [id, t] of lastUse) {
			if (now - t >= TOP_ROLES_COOLDOWN_MS) lastUse.delete(id);
		}
	}
	return 0;
}

/** Test-only: clear the in-memory cooldown map. */
export function resetTopRolesCooldowns() {
	lastUse.clear();
}
