import { Time } from '@oldschoolgg/toolkit';

/** Per-player daily purchase caps for selected /buy skilling supplies. Unlisted items have no cap. */
export const SKILLING_SUPPLY_DAILY_LIMITS: Record<string, number> = {
	// Elemental, Mind and Body runes and Eye of newt have no cap (Nov 16).
	'Arrow shaft': 5_000,
	'Astral rune': 10_000,
	'Chaos rune': 10_000,
	// 100 packs = 10,000 Chaos runes. Kept separate from loose Chaos runes on purpose (20,000/day total).
	'Chaos rune (pack)': 100,
	'Nature rune': 3_000,
	'Death rune': 3_000,
	'Law rune': 3_000,
	'Soul rune': 3_000,
	'Blood rune': 3_000,
	'Copper ore': 3_000,
	'Tin ore': 3_000,
	'Iron ore': 3_000,
	Coal: 3_000,
	'Silver ore': 3_000,
	'Gold ore': 3_000,
	'Mithril ore': 3_000,
	'Bucket of sand': 5_000,
	'Soda ash': 5_000,
	Pineapple: 5_000,
	Banana: 1_000,
	Orange: 1_000,
	Compost: 1_000,
	'Olive oil(4)': 250,
	'Limestone brick': 250,
	'Olive oil pack': 10
};

/** Per-player daily caps for /tokkulshop buy, per ore and gem. Separate allowance from /buy. */
export const TOKKUL_SHOP_DAILY_LIMITS: Record<string, number> = {
	'Tin ore': 3_000,
	'Copper ore': 3_000,
	'Iron ore': 3_000,
	'Silver ore': 3_000,
	Coal: 3_000,
	'Gold ore': 3_000,
	'Mithril ore': 3_000,
	'Adamantite ore': 3_000,
	'Runite ore': 3_000,
	// Gems (Nov 17), same cap as the ores now that gems buy in seconds instead of 1 minute each.
	'Uncut sapphire': 3_000,
	'Uncut emerald': 3_000,
	'Uncut ruby': 3_000,
	'Uncut diamond': 3_000,
	'Uncut onyx': 3_000
};

/** Name used for the Tokkul shop allowance, so it never shares a counter with /buy. */
export function tokkulShopLimitName(itemName: string): string {
	return `Tokkul shop ${itemName}`;
}

const tokkulLimitsByLowerName = new Map(
	Object.entries(TOKKUL_SHOP_DAILY_LIMITS).map(([name, cap]) => [name.toLowerCase(), cap] as const)
);

export function tokkulShopDailyLimitFor(itemName: string): number | undefined {
	return tokkulLimitsByLowerName.get(itemName.toLowerCase());
}
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
