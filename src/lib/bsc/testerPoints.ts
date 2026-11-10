const ready = { done: false };

export interface TesterPointsBalance {
	balance: number;
	earnedTotal: number;
}

export interface TesterPointsLogEntry {
	amount: number;
	reason: string;
	givenBy: string | null;
	createdAt: number;
}

async function ensureStore() {
	if (ready.done) return;
	await prisma.$executeRawUnsafe(`
		CREATE TABLE IF NOT EXISTS bsc_tester_points (
			user_id text PRIMARY KEY,
			balance int NOT NULL DEFAULT 0,
			earned_total int NOT NULL DEFAULT 0
		)
	`);
	await prisma.$executeRawUnsafe(`
		CREATE TABLE IF NOT EXISTS bsc_tester_points_log (
			id serial PRIMARY KEY,
			user_id text NOT NULL,
			amount int NOT NULL,
			reason text NOT NULL,
			given_by text NULL,
			created_at timestamptz NOT NULL DEFAULT NOW()
		)
	`);
	await prisma.$executeRawUnsafe(
		`CREATE INDEX IF NOT EXISTS bsc_tester_points_log_user_idx ON bsc_tester_points_log (user_id, created_at DESC)`
	);
	ready.done = true;
}

export async function getTesterPoints(userId: string): Promise<TesterPointsBalance> {
	await ensureStore();
	const rows = await prisma.$queryRaw<{ balance: number; earned_total: number }[]>`
		SELECT balance, earned_total FROM bsc_tester_points WHERE user_id = ${userId} LIMIT 1
	`;
	const row = rows[0];
	return { balance: row?.balance ?? 0, earnedTotal: row?.earned_total ?? 0 };
}

async function writeLog(userId: string, amount: number, reason: string, givenBy: string | null) {
	await prisma.$executeRaw`
		INSERT INTO bsc_tester_points_log (user_id, amount, reason, given_by)
		VALUES (${userId}, ${amount}, ${reason}, ${givenBy})
	`;
}

export async function giveTesterPoints(
	userId: string,
	amount: number,
	reason: string,
	givenBy: string | null
): Promise<TesterPointsBalance> {
	await ensureStore();
	const rows = await prisma.$queryRaw<{ balance: number; earned_total: number }[]>`
		INSERT INTO bsc_tester_points (user_id, balance, earned_total)
		VALUES (${userId}, ${amount}, ${amount})
		ON CONFLICT (user_id) DO UPDATE SET
			balance = bsc_tester_points.balance + EXCLUDED.balance,
			earned_total = bsc_tester_points.earned_total + EXCLUDED.earned_total
		RETURNING balance, earned_total
	`;
	await writeLog(userId, amount, reason, givenBy);
	return { balance: rows[0].balance, earnedTotal: rows[0].earned_total };
}

export async function removeTesterPoints(
	userId: string,
	amount: number,
	reason: string,
	givenBy: string | null
): Promise<TesterPointsBalance | null> {
	await ensureStore();
	const rows = await prisma.$queryRaw<{ balance: number; earned_total: number }[]>`
		UPDATE bsc_tester_points SET balance = balance - ${amount}
		WHERE user_id = ${userId} AND balance >= ${amount}
		RETURNING balance, earned_total
	`;
	if (rows.length === 0) return null;
	await writeLog(userId, -amount, reason, givenBy);
	return { balance: rows[0].balance, earnedTotal: rows[0].earned_total };
}

export async function refundTesterPoints(userId: string, amount: number, reason: string): Promise<void> {
	await ensureStore();
	await prisma.$executeRaw`
		UPDATE bsc_tester_points SET balance = balance + ${amount} WHERE user_id = ${userId}
	`;
	await writeLog(userId, amount, reason, null);
}

export async function recentTesterPointsLog(userId: string, limit = 5): Promise<TesterPointsLogEntry[]> {
	await ensureStore();
	const rows = await prisma.$queryRaw<
		{ amount: number; reason: string; given_by: string | null; created_at: Date }[]
	>`
		SELECT amount, reason, given_by, created_at FROM bsc_tester_points_log
		WHERE user_id = ${userId}
		ORDER BY created_at DESC, id DESC
		LIMIT ${limit}
	`;
	return rows.map(row => ({
		amount: row.amount,
		reason: row.reason,
		givenBy: row.given_by,
		createdAt: row.created_at.getTime()
	}));
}
