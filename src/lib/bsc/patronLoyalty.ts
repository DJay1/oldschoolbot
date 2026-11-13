import { customEmoji } from '@oldschoolgg/toolkit';

import { utcMonthKey } from '@/lib/bsc/patronPoints.js';
import { parseAdminUserIds } from '@/lib/constants.js';

/** DJ's Discord user id (admin fallback). He can earn the higher loyalty badges from time. */
export const DJ_PATRON_USER_ID = '290167629966999552';

export const PATRON_LOYALTY_TIERS = [
	{ months: 1, key: 'patron_loyalty_1', label: '1 month' },
	{ months: 3, key: 'patron_loyalty_3', label: '3 months' },
	{ months: 6, key: 'patron_loyalty_6', label: '6 months' },
	{ months: 12, key: 'patron_loyalty_12', label: '12 months' }
] as const;

export type PatronLoyaltyTier = (typeof PATRON_LOYALTY_TIERS)[number];
export type PatronLoyaltySource = 'paid' | 'bitfield' | 'dj' | 'none';

export function isDjPatronUserId(userId: string): boolean {
	if (userId === DJ_PATRON_USER_ID) return true;
	return parseAdminUserIds(process.env.ADMIN_USER_IDS).includes(userId);
}

/**
 * Paid subscribers get higher badges from a continuous streak.
 * Bitfield-only patrons (staff, gifts, overrides) only get the 1-month badge.
 * DJ gets higher badges from total or streak months.
 */
export function patronLoyaltySource(opts: {
	userId: string;
	lastCreditedMonth: string | null;
	isPatron: boolean;
	now?: number;
}): PatronLoyaltySource {
	if (!opts.isPatron) return 'none';
	if (isDjPatronUserId(opts.userId)) return 'dj';
	const currentMonth = utcMonthKey(opts.now ?? Date.now());
	if (opts.lastCreditedMonth === currentMonth) return 'paid';
	return 'bitfield';
}

/** Highest single badge. Prefer earnedLoyaltyBadges for display. */
export function loyaltyTierForMonths(monthsTotal: number, monthsStreak = 0): PatronLoyaltyTier | null {
	const months = Math.max(monthsTotal, monthsStreak);
	let earned: PatronLoyaltyTier | null = null;
	for (const tier of PATRON_LOYALTY_TIERS) {
		if (months >= tier.months) earned = tier;
	}
	return earned;
}

export function earnedLoyaltyBadges(opts: {
	source: PatronLoyaltySource;
	monthsTotal: number;
	monthsStreak: number;
}): PatronLoyaltyTier[] {
	if (opts.source === 'none') return [];
	const badges: PatronLoyaltyTier[] = [PATRON_LOYALTY_TIERS[0]];
	if (opts.source === 'bitfield') return badges;
	const higherFrom = opts.source === 'dj' ? Math.max(opts.monthsTotal, opts.monthsStreak) : opts.monthsStreak;
	for (const tier of PATRON_LOYALTY_TIERS) {
		if (tier.months === 1) continue;
		if (higherFrom >= tier.months) badges.push(tier);
	}
	return badges;
}

export function loyaltyBadgeEmoji(monthsTotal: number, monthsStreak = 0): string | null {
	const tier = loyaltyTierForMonths(monthsTotal, monthsStreak);
	return tier ? customEmoji(tier.key) : null;
}

export function loyaltyBadgeLabel(monthsTotal: number, monthsStreak = 0): string | null {
	const badges = earnedLoyaltyBadges({ source: 'paid', monthsTotal, monthsStreak });
	if (badges.length === 0) return null;
	return badges.map(tier => tier.label).join(', ') + ' loyalty';
}
