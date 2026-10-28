/**
 * Discord delivers gateway events at least once. A resumed session replays
 * dispatches, and two in-process listeners can both see the same snowflake.
 * Mention replies and bank adds are not idempotent, so the second delivery
 * posts a second reply and adds the spawned quantity again.
 *
 * Claim each message id and interaction id once, synchronously, before any
 * await. A second entry for that id must return before side effects.
 */

export const DISCORD_EVENT_CLAIM_LIMIT = 20_000;

const claimedEventIds = new Set<string>();

export function claimDiscordEvent(kind: 'message' | 'interaction', id: string | null | undefined): boolean {
	if (!id) return true;
	const key = `${kind}:${id}`;
	if (claimedEventIds.has(key)) return false;
	claimedEventIds.add(key);
	if (claimedEventIds.size > DISCORD_EVENT_CLAIM_LIMIT) {
		const oldest = claimedEventIds.values().next().value;
		if (oldest) claimedEventIds.delete(oldest);
	}
	return true;
}

export function resetDiscordEventClaimsForTests() {
	claimedEventIds.clear();
}
