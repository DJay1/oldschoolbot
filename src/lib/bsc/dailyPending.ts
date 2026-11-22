import {
	DAILY_SPEED_CLICK_BUTTON_PREFIX,
	DAILY_WORDLE_BUTTON_PREFIX,
	type HardGameState
} from '@/lib/bsc/dailyGames.js';

export interface DailyPendingRow {
	userId: string;
	claimedAt: number;
	difficulty: 'hard';
	game: HardGameState;
	expiresAt: number;
	paid: boolean;
}

const ready = { done: false };

async function ensureStore() {
	if (ready.done) return;
	await prisma.$executeRawUnsafe(`
		CREATE TABLE IF NOT EXISTS bsc_daily_pending (
			user_id text PRIMARY KEY,
			claimed_at bigint NOT NULL,
			difficulty text NOT NULL,
			game_type text,
			game_state jsonb NOT NULL,
			expires_at bigint NOT NULL,
			paid boolean NOT NULL DEFAULT FALSE
		)
	`);
	ready.done = true;
}

function asNumber(value: bigint | number | string): number {
	return Number(value);
}

function parseRow(row: {
	user_id: string;
	claimed_at: bigint | number | string;
	difficulty: string;
	game_state: HardGameState | string;
	expires_at: bigint | number | string;
	paid: boolean;
}): DailyPendingRow | null {
	if (row.difficulty !== 'hard') return null;
	const game = typeof row.game_state === 'string' ? (JSON.parse(row.game_state) as HardGameState) : row.game_state;
	if (!game || (game.type !== 'wordle' && game.type !== 'buttons')) return null;
	return {
		userId: row.user_id,
		claimedAt: asNumber(row.claimed_at),
		difficulty: 'hard',
		game,
		expiresAt: asNumber(row.expires_at),
		paid: Boolean(row.paid)
	};
}

export async function loadDailyPending(userId: string): Promise<DailyPendingRow | null> {
	await ensureStore();
	const rows = await prisma.$queryRaw<
		{
			user_id: string;
			claimed_at: bigint;
			difficulty: string;
			game_state: HardGameState;
			expires_at: bigint;
			paid: boolean;
		}[]
	>`SELECT user_id, claimed_at, difficulty, game_state, expires_at, paid FROM bsc_daily_pending WHERE user_id = ${userId} LIMIT 1`;
	const row = rows[0];
	return row ? parseRow(row) : null;
}

export async function saveDailyPending(row: Omit<DailyPendingRow, 'paid'> & { paid?: boolean }): Promise<void> {
	await ensureStore();
	const paid = row.paid ?? false;
	const state = JSON.stringify(row.game);
	await prisma.$executeRawUnsafe(
		`INSERT INTO bsc_daily_pending (user_id, claimed_at, difficulty, game_type, game_state, expires_at, paid)
		 VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
		 ON CONFLICT (user_id) DO UPDATE SET
			claimed_at = EXCLUDED.claimed_at,
			difficulty = EXCLUDED.difficulty,
			game_type = EXCLUDED.game_type,
			game_state = EXCLUDED.game_state,
			expires_at = EXCLUDED.expires_at,
			paid = EXCLUDED.paid
		 WHERE bsc_daily_pending.paid = TRUE OR bsc_daily_pending.expires_at <= $8`,
		row.userId,
		row.claimedAt,
		row.difficulty,
		row.game.type,
		state,
		row.expiresAt,
		paid,
		Date.now()
	);
}

export async function updateDailyPendingGame(userId: string, game: HardGameState, expiresAt: number): Promise<void> {
	await ensureStore();
	await prisma.$executeRawUnsafe(
		`UPDATE bsc_daily_pending
		 SET game_state = $2::jsonb, expires_at = $3
		 WHERE user_id = $1 AND paid = FALSE`,
		userId,
		JSON.stringify(game),
		expiresAt
	);
}

/** Returns true if this process won the right to pay the reward. */
export async function markDailyPendingPaid(userId: string): Promise<boolean> {
	await ensureStore();
	const updated = await prisma.$executeRawUnsafe(
		`UPDATE bsc_daily_pending SET paid = TRUE WHERE user_id = $1 AND paid = FALSE`,
		userId
	);
	return Number(updated) === 1;
}

export async function clearDailyPending(userId: string): Promise<void> {
	await ensureStore();
	await prisma.$executeRaw`DELETE FROM bsc_daily_pending WHERE user_id = ${userId}`;
}

export function remainingMs(expiresAt: number, now = Date.now()): number {
	return Math.max(0, expiresAt - now);
}

export function isDailyPendingExpired(expiresAt: number, now = Date.now()): boolean {
	return now >= expiresAt;
}

export function isDailyHardGameButtonId(customId: string): boolean {
	return customId.startsWith(DAILY_WORDLE_BUTTON_PREFIX) || customId.startsWith(DAILY_SPEED_CLICK_BUTTON_PREFIX);
}

/** Only the claim owner's clicks on an unpaid, unexpired, still-running Hard daily game skip the global button ratelimit. */
export function shouldExemptDailyGameButtonFromGlobalRatelimit(opts: {
	customId: string;
	userId: string;
	pending: DailyPendingRow | null;
	now?: number;
}): boolean {
	if (!isDailyHardGameButtonId(opts.customId)) return false;
	const pending = opts.pending;
	if (!pending) return false;
	if (pending.userId !== opts.userId) return false;
	if (pending.paid) return false;
	if (isDailyPendingExpired(pending.expiresAt, opts.now ?? Date.now())) return false;
	if (pending.game.status !== 'playing') return false;
	if (opts.customId.startsWith(DAILY_WORDLE_BUTTON_PREFIX) && pending.game.type !== 'wordle') return false;
	if (opts.customId.startsWith(DAILY_SPEED_CLICK_BUTTON_PREFIX) && pending.game.type !== 'buttons') return false;
	return true;
}

export async function shouldExemptUserDailyGameButton(
	userId: string,
	customId: string,
	now = Date.now()
): Promise<boolean> {
	if (!isDailyHardGameButtonId(customId)) return false;
	const pending = await loadDailyPending(userId);
	return shouldExemptDailyGameButtonFromGlobalRatelimit({ customId, userId, pending, now });
}
