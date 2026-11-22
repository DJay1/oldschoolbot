import { ensureBscPatronAccount, ensurePatronRevampStore, getBscPatronAccount } from '@/lib/bsc/patronAccount.js';
import { BSC_PATRON_TIERS } from '@/lib/bsc/patronTiers.js';

export const MONTHLY_GRANT_REASON = 'monthly_grant';
export const TIER_CHANGE_ADJUST_REASON = 'tier_change_adjust';

export function utcMonthKey(now: Date | number = new Date()): string {
	const date = now instanceof Date ? now : new Date(now);
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	return `${year}-${month}`;
}

export function previousUtcMonthKey(monthKey: string): string {
	const [yearStr, monthStr] = monthKey.split('-');
	let year = Number(yearStr);
	let month = Number(monthStr) - 1;
	if (month <= 0) {
		month = 12;
		year -= 1;
	}
	return `${year}-${String(month).padStart(2, '0')}`;
}

export function pointsForPaidLevel(paidLevel: number): number {
	return BSC_PATRON_TIERS.find(tier => tier.level === paidLevel)?.priceUsd ?? 0;
}

export function isMonthlyPointsReason(reason: string): boolean {
	return reason === MONTHLY_GRANT_REASON || reason === TIER_CHANGE_ADJUST_REASON;
}

export function monthNetGrantedPoints(
	entries: ReadonlyArray<{ delta: number; reason: string; monthKey?: string | null; month_key?: string | null }>,
	monthKey: string
): number {
	return entries
		.filter(
			entry => (entry.monthKey ?? entry.month_key ?? null) === monthKey && isMonthlyPointsReason(entry.reason)
		)
		.reduce((sum, entry) => sum + entry.delta, 0);
}

export interface MonthlyGrantPlan {
	shouldGrant: boolean;
	monthKey: string;
	points: number;
	nextMonthsTotal: number;
	nextMonthsStreak: number;
	reason: 'monthly_grant' | 'already_granted' | 'not_paying';
}

/** Pure planner used by sync and unit tests. Gift-only weeks pass paidLevel 0. */
export function planMonthlyPatronGrant(input: {
	paidLevel: number;
	lastCreditedMonth: string | null;
	monthsTotal: number;
	monthsStreak: number;
	now?: Date | number;
}): MonthlyGrantPlan {
	const monthKey = utcMonthKey(input.now ?? new Date());
	const points = pointsForPaidLevel(input.paidLevel);
	if (points <= 0 || input.paidLevel <= 0) {
		return {
			shouldGrant: false,
			monthKey,
			points: 0,
			nextMonthsTotal: input.monthsTotal,
			nextMonthsStreak: input.lastCreditedMonth === monthKey ? input.monthsStreak : 0,
			reason: 'not_paying'
		};
	}
	if (input.lastCreditedMonth === monthKey) {
		return {
			shouldGrant: false,
			monthKey,
			points: 0,
			nextMonthsTotal: input.monthsTotal,
			nextMonthsStreak: input.monthsStreak,
			reason: 'already_granted'
		};
	}
	const streakContinues = input.lastCreditedMonth === previousUtcMonthKey(monthKey);
	return {
		shouldGrant: true,
		monthKey,
		points,
		nextMonthsTotal: input.monthsTotal + 1,
		nextMonthsStreak: streakContinues ? input.monthsStreak + 1 : 1,
		reason: 'monthly_grant'
	};
}

export interface MonthlyAdjustPlan {
	shouldAdjust: boolean;
	monthKey: string;
	target: number;
	monthNetGranted: number;
	desiredDelta: number;
	delta: number;
	shortfall: number;
	reason: 'tier_change_adjust' | 'already_adjusted' | 'no_grant_this_month' | 'clamped_no_balance';
}

/**
 * After a month has already been granted, move that month's points to the new paid tier.
 * Upgrades add the difference. Downgrades subtract it, but never take the balance below 0;
 * any amount already spent is recorded as shortfall and can be clawed back later if points return.
 */
export function planMonthlyPatronTierAdjust(input: {
	paidLevel: number;
	lastCreditedMonth: string | null;
	monthNetGranted: number;
	currentBalance: number;
	now?: Date | number;
}): MonthlyAdjustPlan {
	const monthKey = utcMonthKey(input.now ?? new Date());
	const target = pointsForPaidLevel(input.paidLevel);
	const base = {
		monthKey,
		target,
		monthNetGranted: input.monthNetGranted,
		desiredDelta: 0,
		delta: 0,
		shortfall: 0
	};
	if (input.lastCreditedMonth !== monthKey) {
		return { ...base, shouldAdjust: false, reason: 'no_grant_this_month' };
	}
	const desiredDelta = target - input.monthNetGranted;
	if (desiredDelta === 0) {
		return { ...base, shouldAdjust: false, reason: 'already_adjusted' };
	}
	if (desiredDelta > 0) {
		return {
			...base,
			shouldAdjust: true,
			desiredDelta,
			delta: desiredDelta,
			shortfall: 0,
			reason: 'tier_change_adjust'
		};
	}
	const currentBalance = Math.max(0, input.currentBalance);
	const applied = -Math.min(-desiredDelta, currentBalance);
	if (applied === 0) {
		return {
			...base,
			shouldAdjust: false,
			desiredDelta,
			delta: 0,
			shortfall: -desiredDelta,
			reason: 'clamped_no_balance'
		};
	}
	return {
		...base,
		shouldAdjust: true,
		desiredDelta,
		delta: applied,
		shortfall: -desiredDelta - -applied,
		reason: 'tier_change_adjust'
	};
}

export interface MonthlyGrantResult {
	granted: boolean;
	adjusted: boolean;
	points: number;
	balance: number;
	monthKey: string;
	reason: MonthlyGrantPlan['reason'] | MonthlyAdjustPlan['reason'];
	shortfall?: number;
}

function noChangeResult(
	balance: number,
	monthKey: string,
	reason: MonthlyGrantResult['reason'],
	shortfall = 0
): MonthlyGrantResult {
	return {
		granted: false,
		adjusted: false,
		points: 0,
		balance,
		monthKey,
		reason,
		...(shortfall > 0 ? { shortfall } : {})
	};
}

async function applyMonthlyPatronTierAdjust(
	userId: string,
	paidLevel: number,
	monthKey: string,
	now: Date | number
): Promise<MonthlyGrantResult> {
	await ensurePatronRevampStore();
	return prisma.$transaction(async tx => {
		const locked = await tx.$queryRaw<{ points_balance: number; last_credited_month: string | null }[]>`
			SELECT points_balance, last_credited_month
			FROM bsc_patron_account
			WHERE user_id = ${userId}
			FOR UPDATE
		`;
		const account = locked[0];
		if (!account) {
			return noChangeResult(0, monthKey, 'no_grant_this_month');
		}
		const nets = await tx.$queryRaw<{ net: number }[]>`
			SELECT COALESCE(SUM(delta), 0)::int AS net
			FROM bsc_patron_points_log
			WHERE user_id = ${userId}
				AND month_key = ${monthKey}
				AND reason IN (${MONTHLY_GRANT_REASON}, ${TIER_CHANGE_ADJUST_REASON})
		`;
		const plan = planMonthlyPatronTierAdjust({
			paidLevel,
			lastCreditedMonth: account.last_credited_month,
			monthNetGranted: nets[0]?.net ?? 0,
			currentBalance: account.points_balance,
			now
		});
		if (!plan.shouldAdjust) {
			return noChangeResult(account.points_balance, monthKey, plan.reason, plan.shortfall);
		}
		const rows = await tx.$queryRaw<{ points_balance: number }[]>`
			UPDATE bsc_patron_account
			SET
				points_balance = points_balance + ${plan.delta},
				updated_at = NOW()
			WHERE user_id = ${userId}
				AND points_balance + ${plan.delta} >= 0
			RETURNING points_balance
		`;
		const row = rows[0];
		if (!row) {
			return noChangeResult(account.points_balance, monthKey, 'clamped_no_balance', -plan.desiredDelta);
		}
		await tx.$executeRaw`
			INSERT INTO bsc_patron_points_log (user_id, delta, balance, reason, month_key)
			VALUES (
				${userId},
				${plan.delta},
				${row.points_balance},
				${TIER_CHANGE_ADJUST_REASON},
				${monthKey}
			)
		`;
		return {
			granted: false,
			adjusted: true,
			points: plan.delta,
			balance: row.points_balance,
			monthKey,
			reason: 'tier_change_adjust',
			...(plan.shortfall > 0 ? { shortfall: plan.shortfall } : {})
		};
	});
}

export async function creditMonthlyPatronRewards(
	userId: string,
	paidLevel: number,
	now: Date | number = new Date()
): Promise<MonthlyGrantResult> {
	const account = await ensureBscPatronAccount(userId);
	const plan = planMonthlyPatronGrant({
		paidLevel,
		lastCreditedMonth: account.lastCreditedMonth,
		monthsTotal: account.monthsTotal,
		monthsStreak: account.monthsStreak,
		now
	});
	if (!plan.shouldGrant) {
		if (account.lastCreditedMonth === plan.monthKey) {
			return applyMonthlyPatronTierAdjust(userId, paidLevel, plan.monthKey, now);
		}
		return noChangeResult(account.pointsBalance, plan.monthKey, plan.reason);
	}

	await ensurePatronRevampStore();
	try {
		const inserted = await prisma.$queryRaw<{ id: bigint }[]>`
			INSERT INTO bsc_patron_points_log (user_id, delta, balance, reason, month_key)
			VALUES (
				${userId},
				${plan.points},
				${account.pointsBalance + plan.points},
				${MONTHLY_GRANT_REASON},
				${plan.monthKey}
			)
			ON CONFLICT DO NOTHING
			RETURNING id
		`;
		if (!inserted[0]) {
			return applyMonthlyPatronTierAdjust(userId, paidLevel, plan.monthKey, now);
		}
		await prisma.$executeRaw`
			UPDATE bsc_patron_account
			SET
				points_balance = points_balance + ${plan.points},
				months_total = ${plan.nextMonthsTotal},
				months_streak = ${plan.nextMonthsStreak},
				last_credited_month = ${plan.monthKey},
				updated_at = NOW()
			WHERE user_id = ${userId}
		`;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (message.includes('bsc_patron_points_log_monthly_unique') || message.toLowerCase().includes('unique')) {
			return applyMonthlyPatronTierAdjust(userId, paidLevel, plan.monthKey, now);
		}
		throw err;
	}

	const latest = await getBscPatronAccount(userId);
	return {
		granted: true,
		adjusted: false,
		points: plan.points,
		balance: latest.pointsBalance,
		monthKey: plan.monthKey,
		reason: 'monthly_grant'
	};
}

/**
 * Role and Patreon API sync call this.
 * While a paid patron is in the role-loss grace window, pass inPaidGrace true so we do not claw back this month's points.
 */
export async function creditMonthlyPatronRewardsForSync(
	userId: string,
	paidLevel: number,
	opts: { inPaidGrace?: boolean; now?: Date | number } = {}
): Promise<MonthlyGrantResult | null> {
	if (paidLevel > 0) {
		return creditMonthlyPatronRewards(userId, paidLevel, opts.now);
	}
	if (opts.inPaidGrace) return null;
	return creditMonthlyPatronRewards(userId, 0, opts.now);
}

export async function debitPatronPoints(
	userId: string,
	amount: number,
	reason: string
): Promise<{ ok: true; balance: number } | { ok: false; balance: number; message: string }> {
	if (!Number.isInteger(amount) || amount <= 0) {
		return { ok: false, balance: 0, message: 'Invalid point amount.' };
	}
	await ensureBscPatronAccount(userId);
	const rows = await prisma.$queryRaw<{ points_balance: number }[]>`
		UPDATE bsc_patron_account
		SET points_balance = points_balance - ${amount}, updated_at = NOW()
		WHERE user_id = ${userId} AND points_balance >= ${amount}
		RETURNING points_balance
	`;
	const row = rows[0];
	if (!row) {
		const account = await getBscPatronAccount(userId);
		return {
			ok: false,
			balance: account.pointsBalance,
			message: `You need ${amount} patron points, and you have ${account.pointsBalance}.`
		};
	}
	await prisma.$executeRaw`
		INSERT INTO bsc_patron_points_log (user_id, delta, balance, reason)
		VALUES (${userId}, ${-amount}, ${row.points_balance}, ${reason})
	`;
	return { ok: true, balance: row.points_balance };
}

export async function refundPatronPoints(userId: string, amount: number, reason: string): Promise<number> {
	if (!Number.isInteger(amount) || amount <= 0) return (await getBscPatronAccount(userId)).pointsBalance;
	await ensureBscPatronAccount(userId);
	const rows = await prisma.$queryRaw<{ points_balance: number }[]>`
		UPDATE bsc_patron_account
		SET points_balance = points_balance + ${amount}, updated_at = NOW()
		WHERE user_id = ${userId}
		RETURNING points_balance
	`;
	const balance = rows[0]?.points_balance ?? 0;
	await prisma.$executeRaw`
		INSERT INTO bsc_patron_points_log (user_id, delta, balance, reason)
		VALUES (${userId}, ${amount}, ${balance}, ${reason})
	`;
	return balance;
}
