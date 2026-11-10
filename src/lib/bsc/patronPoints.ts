import { BSC_PATRON_TIERS } from '@/lib/bsc/patronTiers.js';
import { ensureBscPatronAccount, ensurePatronRevampStore, getBscPatronAccount } from '@/lib/bsc/patronAccount.js';

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

export interface MonthlyGrantResult {
	granted: boolean;
	points: number;
	balance: number;
	monthKey: string;
	reason: MonthlyGrantPlan['reason'];
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
		return {
			granted: false,
			points: 0,
			balance: account.pointsBalance,
			monthKey: plan.monthKey,
			reason: plan.reason
		};
	}

	await ensurePatronRevampStore();
	try {
		const inserted = await prisma.$queryRaw<{ id: bigint }[]>`
			INSERT INTO bsc_patron_points_log (user_id, delta, balance, reason, month_key)
			VALUES (
				${userId},
				${plan.points},
				${account.pointsBalance + plan.points},
				${'monthly_grant'},
				${plan.monthKey}
			)
			ON CONFLICT DO NOTHING
			RETURNING id
		`;
		if (!inserted[0]) {
			const latest = await getBscPatronAccount(userId);
			return {
				granted: false,
				points: 0,
				balance: latest.pointsBalance,
				monthKey: plan.monthKey,
				reason: 'already_granted'
			};
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
			const latest = await getBscPatronAccount(userId);
			return {
				granted: false,
				points: 0,
				balance: latest.pointsBalance,
				monthKey: plan.monthKey,
				reason: 'already_granted'
			};
		}
		throw err;
	}

	const latest = await getBscPatronAccount(userId);
	return {
		granted: true,
		points: plan.points,
		balance: latest.pointsBalance,
		monthKey: plan.monthKey,
		reason: 'monthly_grant'
	};
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
