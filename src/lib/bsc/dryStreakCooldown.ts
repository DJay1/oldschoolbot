/** /tools patron drystreak is open to everyone; this keeps its leaderboard queries from being spammed. */
export const DRYSTREAK_COOLDOWN_MS = 30_000;
const dryStreakLastUse = new Map<string, number>();

/** Ms left on this user's drystreak cooldown. Starts a new cooldown when it returns 0. */
export function dryStreakCooldownLeft(userId: string, now: number): number {
	const last = dryStreakLastUse.get(userId);
	if (last !== undefined && now - last < DRYSTREAK_COOLDOWN_MS) return DRYSTREAK_COOLDOWN_MS - (now - last);
	dryStreakLastUse.set(userId, now);
	if (dryStreakLastUse.size > 5000) {
		for (const [id, t] of dryStreakLastUse) if (now - t >= DRYSTREAK_COOLDOWN_MS) dryStreakLastUse.delete(id);
	}
	return 0;
}
