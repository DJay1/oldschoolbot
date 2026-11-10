import { customEmoji } from '@oldschoolgg/toolkit';

export const PATRON_LOYALTY_TIERS = [
	{ months: 1, key: 'patron_loyalty_1', label: '1 month' },
	{ months: 3, key: 'patron_loyalty_3', label: '3 months' },
	{ months: 6, key: 'patron_loyalty_6', label: '6 months' },
	{ months: 12, key: 'patron_loyalty_12', label: '12 months' }
] as const;

export type PatronLoyaltyTier = (typeof PATRON_LOYALTY_TIERS)[number];

/** Highest badge earned from consecutive or total subscribed months. */
export function loyaltyTierForMonths(monthsTotal: number, monthsStreak = 0): PatronLoyaltyTier | null {
	const months = Math.max(monthsTotal, monthsStreak);
	let earned: PatronLoyaltyTier | null = null;
	for (const tier of PATRON_LOYALTY_TIERS) {
		if (months >= tier.months) earned = tier;
	}
	return earned;
}

export function loyaltyBadgeEmoji(monthsTotal: number, monthsStreak = 0): string | null {
	const tier = loyaltyTierForMonths(monthsTotal, monthsStreak);
	return tier ? customEmoji(tier.key) : null;
}

export function loyaltyBadgeLabel(monthsTotal: number, monthsStreak = 0): string | null {
	const tier = loyaltyTierForMonths(monthsTotal, monthsStreak);
	return tier ? `${tier.label} loyalty` : null;
}
