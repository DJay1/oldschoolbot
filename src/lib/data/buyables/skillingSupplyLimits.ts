import { Time } from '@oldschoolgg/toolkit';

/** Per-player daily purchase caps for selected /buy skilling supplies. Unlisted items have no cap. */
export const SKILLING_SUPPLY_DAILY_LIMITS: Record<string, number> = {
	'Arrow shaft': 5_000,
	Feather: 2_000,
	'Air rune': 5_000,
	'Earth rune': 5_000,
	'Water rune': 5_000,
	'Fire rune': 5_000,
	'Mind rune': 5_000,
	'Body rune': 5_000,
	'Astral rune': 1_000,
	'Chaos rune': 1_000,
	'Chaos rune (pack)': 10,
	'Nature rune': 1_000,
	'Death rune': 1_000,
	'Law rune': 1_000,
	'Soul rune': 1_000,
	'Blood rune': 1_000,
	'Copper ore': 1_000,
	'Tin ore': 1_000,
	'Iron ore': 1_000,
	Coal: 1_000,
	'Silver ore': 1_000,
	'Gold ore': 1_000,
	'Mithril ore': 1_000,
	'Bucket of sand': 1_000,
	'Soda ash': 1_000,
	Pineapple: 1_000,
	Banana: 1_000,
	Orange: 1_000,
	'Eye of newt': 500,
	Compost: 250,
	'Olive oil(4)': 250,
	'Limestone brick': 250,
	'Olive oil pack': 10
};

export const BUY_DAILY_LIMIT_WINDOW_SECONDS = Time.Day / Time.Second;

const limitsByLowerName = new Map(
	Object.entries(SKILLING_SUPPLY_DAILY_LIMITS).map(([name, cap]) => [name.toLowerCase(), cap] as const)
);

export function buyDailyLimitFor(name: string): number | undefined {
	return limitsByLowerName.get(name.toLowerCase());
}

export function buyDailyLimitKeyType(buyableName: string): string {
	const slug = buyableName
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_|_$/g, '');
	return `buy_daily_${slug}`;
}

export function formatBuyDailyLimitMessage(opts: {
	name: string;
	requested: number;
	dailyLimit: number;
	remaining: number;
	resetAtSeconds: number | null;
}): string {
	const { name, requested, dailyLimit, remaining, resetAtSeconds } = opts;
	const limitFmt = dailyLimit.toLocaleString();
	const remainingFmt = remaining.toLocaleString();
	const requestedFmt = requested.toLocaleString();
	const when =
		resetAtSeconds && resetAtSeconds > 0
			? `You can buy more <t:${resetAtSeconds}:R>.`
			: 'You can buy more in 24 hours.';

	if (remaining <= 0) {
		return `You can only buy ${limitFmt}x ${name} per day. You have none left today. ${when}`;
	}

	return `You can only buy ${limitFmt}x ${name} per day. You tried to buy ${requestedFmt}, but you have ${remainingFmt} left today. ${when}`;
}

export type BuyDailyReserveResult =
	| { ok: true; used: number; resetAtSeconds: number }
	| { ok: false; used: number; remaining: number; resetAtSeconds: number | null };

/** Pure reserve check used by Redis and tests so overlapping buys cannot pass the cap. */
export function applyBuyDailyReserve(used: number, quantity: number, cap: number): { ok: boolean; used: number } {
	if (!Number.isSafeInteger(used) || used < 0 || !Number.isSafeInteger(quantity) || quantity < 1) {
		return { ok: false, used: Math.max(0, Number.isFinite(used) ? used : 0) };
	}
	if (!Number.isSafeInteger(used + quantity) || used + quantity > cap) {
		return { ok: false, used };
	}
	return { ok: true, used: used + quantity };
}
