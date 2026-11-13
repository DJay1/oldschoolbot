import {
	BUY_DAILY_LIMIT_WINDOW_SECONDS,
	buyDailyLimitFor,
	formatBuyDailyLimitMessage
} from '@/lib/data/buyables/skillingSupplyLimits.js';

export async function peekDailyBuyRemaining(
	userId: string,
	buyableName: string
): Promise<{ remaining: number; dailyLimit: number; resetAtSeconds: number | null } | null> {
	const dailyLimit = buyDailyLimitFor(buyableName);
	if (dailyLimit === undefined) return null;
	const peek = await Cache.peekBuyDailyLimit(userId, buyableName);
	return {
		dailyLimit,
		remaining: Math.max(0, dailyLimit - peek.used),
		resetAtSeconds: peek.resetAtSeconds
	};
}

export function dailyBuyLimitMessage(
	buyableName: string,
	requested: number,
	state: { remaining: number; dailyLimit: number; resetAtSeconds: number | null }
): string {
	return formatBuyDailyLimitMessage({
		name: buyableName,
		requested,
		dailyLimit: state.dailyLimit,
		remaining: state.remaining,
		resetAtSeconds: state.resetAtSeconds
	});
}

/**
 * Atomically reserves `quantity` against the per-player daily cap (if this item has one)
 * before `fn` runs. The reservation is released unless `commit()` is called after a
 * successful purchase, or if `fn` throws (including a cancelled confirm).
 */
export async function runWithBuyDailyLimit<T>(
	userId: string,
	buyableName: string,
	quantity: number,
	fn: (ctx: { commit: () => void }) => Promise<T>
): Promise<T | string> {
	const dailyLimit = buyDailyLimitFor(buyableName);
	if (dailyLimit === undefined) return fn({ commit() {} });

	const reserved = await Cache.tryReserveBuyDailyLimit(
		userId,
		buyableName,
		quantity,
		dailyLimit,
		BUY_DAILY_LIMIT_WINDOW_SECONDS
	);
	if (!reserved.ok) {
		return formatBuyDailyLimitMessage({
			name: buyableName,
			requested: quantity,
			dailyLimit,
			remaining: reserved.remaining,
			resetAtSeconds: reserved.resetAtSeconds
		});
	}

	let committed = false;
	try {
		return await fn({
			commit() {
				committed = true;
			}
		});
	} finally {
		if (!committed) {
			await Cache.releaseBuyDailyLimit(userId, buyableName, quantity);
		}
	}
}
