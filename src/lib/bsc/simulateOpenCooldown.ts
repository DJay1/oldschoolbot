/** /simulate open can be heavy at the cap; this keeps it from being spammed. */
export const SIMULATE_OPEN_COOLDOWN_MS = 10_000;
const lastUse = new Map<string, number>();

/** Ms left on this user's simulate-open cooldown. Starts a new cooldown when it returns 0. */
export function simulateOpenCooldownLeft(userId: string, now: number): number {
	const last = lastUse.get(userId);
	if (last !== undefined && now - last < SIMULATE_OPEN_COOLDOWN_MS) {
		return SIMULATE_OPEN_COOLDOWN_MS - (now - last);
	}
	lastUse.set(userId, now);
	if (lastUse.size > 5000) {
		for (const [id, t] of lastUse) {
			if (now - t >= SIMULATE_OPEN_COOLDOWN_MS) lastUse.delete(id);
		}
	}
	return 0;
}

/** Test-only: clear the in-memory cooldown map. */
export function resetSimulateOpenCooldowns() {
	lastUse.clear();
}
