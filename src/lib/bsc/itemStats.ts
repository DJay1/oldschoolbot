import { EItem } from 'oldschooljs';

/** Validates the item id, then builds the owned-count query for /staff item_stats. */
export function itemStatsOwnedSql(itemId: number): string {
	if (!Number.isInteger(itemId) || Number.isNaN(itemId) || itemId < 0) {
		throw new Error(`Invalid itemID passed to itemStatsOwnedSql: ${itemId}`);
	}
	// Coins are stored in the GP column, not as item 995 in the bank JSON.
	if (itemId === EItem.COINS) {
		return `SELECT (COALESCE(SUM("GP"), 0) + COALESCE(SUM((bank->>'995')::bigint), 0))::bigint AS qty FROM users`;
	}
	return `SELECT COALESCE(SUM((bank->>'${itemId}')::bigint), 0) AS qty FROM users WHERE bank->>'${itemId}' IS NOT NULL`;
}

/** SUM() is null when no rows match, which used to crash .toLocaleString(). */
export function ownedQtyFromSum(qty: bigint | number | string | null | undefined): bigint {
	if (qty === null || qty === undefined) return 0n;
	return BigInt(qty);
}

export function itemStatsMessage(itemName: string, owned: bigint, clUsers: number, ironmenOnly = false): string {
	const people = ironmenOnly ? 'ironmen' : 'people';
	return `There are ${owned.toLocaleString()} ${itemName} owned by everyone.
There are ${clUsers.toLocaleString()} ${people} with at least 1 ${itemName} in their collection log.`;
}
