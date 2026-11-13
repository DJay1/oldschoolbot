export interface BscPatronAccount {
	userId: string;
	pointsBalance: number;
	monthsTotal: number;
	monthsStreak: number;
	lastCreditedMonth: string | null;
	title: string | null;
	flair: string | null;
	favoritePetId: number | null;
	updatedAt: number | null;
}

interface AccountRow {
	user_id: string;
	points_balance: number;
	months_total: number;
	months_streak: number;
	last_credited_month: string | null;
	title: string | null;
	flair: string | null;
	favorite_pet_id: number | null;
	updated_at: Date | null;
}

const ready = { done: false };

export async function ensurePatronRevampStore() {
	if (ready.done) return;
	await prisma.$executeRawUnsafe(`
		CREATE TABLE IF NOT EXISTS bsc_patron_account (
			user_id text PRIMARY KEY,
			points_balance int NOT NULL DEFAULT 0,
			months_total int NOT NULL DEFAULT 0,
			months_streak int NOT NULL DEFAULT 0,
			last_credited_month text NULL,
			title text NULL,
			flair text NULL,
			favorite_pet_id int NULL,
			updated_at timestamptz NOT NULL DEFAULT NOW()
		)
	`);
	await prisma.$executeRawUnsafe(`
		CREATE TABLE IF NOT EXISTS bsc_patron_points_log (
			id bigserial PRIMARY KEY,
			user_id text NOT NULL,
			delta int NOT NULL,
			balance int NOT NULL,
			reason text NOT NULL,
			month_key text NULL,
			created_at timestamptz NOT NULL DEFAULT NOW()
		)
	`);
	await prisma.$executeRawUnsafe(`
		CREATE UNIQUE INDEX IF NOT EXISTS bsc_patron_points_log_monthly_unique
			ON bsc_patron_points_log (user_id, month_key)
			WHERE month_key IS NOT NULL AND reason = 'monthly_grant'
	`);
	await prisma.$executeRawUnsafe(`
		CREATE INDEX IF NOT EXISTS bsc_patron_points_log_user_idx
			ON bsc_patron_points_log (user_id, created_at DESC)
	`);
	await prisma.$executeRawUnsafe(`
		CREATE TABLE IF NOT EXISTS bsc_patron_item_dyes (
			user_id text NOT NULL,
			item_id int NOT NULL,
			dye_key text NOT NULL,
			mode text NOT NULL,
			applied_at timestamptz NOT NULL DEFAULT NOW(),
			PRIMARY KEY (user_id, item_id)
		)
	`);
	await prisma.$executeRawUnsafe(`
		CREATE INDEX IF NOT EXISTS bsc_patron_item_dyes_user_idx
			ON bsc_patron_item_dyes (user_id)
	`);
	await prisma.$executeRawUnsafe(`
		ALTER TABLE bsc_patron_item_dyes
			ADD COLUMN IF NOT EXISTS glow_hex text,
			ADD COLUMN IF NOT EXISTS recolour_hex text,
			ADD COLUMN IF NOT EXISTS sparkle boolean
	`);
	ready.done = true;
}

function toAccount(row: AccountRow): BscPatronAccount {
	return {
		userId: row.user_id,
		pointsBalance: row.points_balance,
		monthsTotal: row.months_total,
		monthsStreak: row.months_streak,
		lastCreditedMonth: row.last_credited_month,
		title: row.title,
		flair: row.flair,
		favoritePetId: row.favorite_pet_id,
		updatedAt: row.updated_at ? row.updated_at.getTime() : null
	};
}

const emptyAccount = (userId: string): BscPatronAccount => ({
	userId,
	pointsBalance: 0,
	monthsTotal: 0,
	monthsStreak: 0,
	lastCreditedMonth: null,
	title: null,
	flair: null,
	favoritePetId: null,
	updatedAt: null
});

export async function getBscPatronAccount(userId: string): Promise<BscPatronAccount> {
	await ensurePatronRevampStore();
	const rows = await prisma.$queryRaw<AccountRow[]>`
		SELECT user_id, points_balance, months_total, months_streak, last_credited_month,
			title, flair, favorite_pet_id, updated_at
		FROM bsc_patron_account
		WHERE user_id = ${userId}
		LIMIT 1
	`;
	return rows[0] ? toAccount(rows[0]) : emptyAccount(userId);
}

export async function ensureBscPatronAccount(userId: string): Promise<BscPatronAccount> {
	await ensurePatronRevampStore();
	await prisma.$executeRaw`
		INSERT INTO bsc_patron_account (user_id)
		VALUES (${userId})
		ON CONFLICT (user_id) DO NOTHING
	`;
	return getBscPatronAccount(userId);
}

export async function updateBscPatronAccount(
	userId: string,
	patch: Partial<
		Pick<
			BscPatronAccount,
			'title' | 'flair' | 'favoritePetId' | 'pointsBalance' | 'monthsTotal' | 'monthsStreak' | 'lastCreditedMonth'
		>
	>
): Promise<BscPatronAccount> {
	await ensureBscPatronAccount(userId);
	if ('title' in patch) {
		await prisma.$executeRaw`UPDATE bsc_patron_account SET title = ${patch.title ?? null}, updated_at = NOW() WHERE user_id = ${userId}`;
	}
	if ('flair' in patch) {
		await prisma.$executeRaw`UPDATE bsc_patron_account SET flair = ${patch.flair ?? null}, updated_at = NOW() WHERE user_id = ${userId}`;
	}
	if ('favoritePetId' in patch) {
		await prisma.$executeRaw`UPDATE bsc_patron_account SET favorite_pet_id = ${patch.favoritePetId ?? null}, updated_at = NOW() WHERE user_id = ${userId}`;
	}
	if ('pointsBalance' in patch && patch.pointsBalance !== undefined) {
		await prisma.$executeRaw`UPDATE bsc_patron_account SET points_balance = ${patch.pointsBalance}, updated_at = NOW() WHERE user_id = ${userId}`;
	}
	if ('monthsTotal' in patch && patch.monthsTotal !== undefined) {
		await prisma.$executeRaw`UPDATE bsc_patron_account SET months_total = ${patch.monthsTotal}, updated_at = NOW() WHERE user_id = ${userId}`;
	}
	if ('monthsStreak' in patch && patch.monthsStreak !== undefined) {
		await prisma.$executeRaw`UPDATE bsc_patron_account SET months_streak = ${patch.monthsStreak}, updated_at = NOW() WHERE user_id = ${userId}`;
	}
	if ('lastCreditedMonth' in patch) {
		await prisma.$executeRaw`UPDATE bsc_patron_account SET last_credited_month = ${patch.lastCreditedMonth ?? null}, updated_at = NOW() WHERE user_id = ${userId}`;
	}
	return getBscPatronAccount(userId);
}
