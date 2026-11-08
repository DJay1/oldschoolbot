const ready = { done: false };

export interface BscPatronOverride {
	userId: string;
	tier: number;
	manual: boolean;
	cosmeticClaimedAt: number | null;
	roleMissingSince: number | null;
	lastGiftAt: number | null;
	giftTier: number | null;
	giftUntil: number | null;
	customBackground: boolean;
	customBackgroundId: number | null;
}

interface PatronRow {
	user_id: string;
	tier: number;
	manual: boolean;
	cosmetic_claimed_at: Date | null;
	role_missing_since: Date | null;
	last_gift_at: Date | null;
	gift_tier: number | null;
	gift_until: Date | null;
	custom_background: boolean;
	custom_background_id: number | null;
}

async function ensureStore() {
	if (ready.done) return;
	await prisma.$executeRawUnsafe(`
		CREATE TABLE IF NOT EXISTS bsc_patron_override (
			user_id text PRIMARY KEY,
			tier int NOT NULL,
			manual boolean NOT NULL,
			cosmetic_claimed_at timestamptz NULL,
			role_missing_since timestamptz NULL,
			last_gift_at timestamptz NULL,
			gift_tier int NULL,
			gift_until timestamptz NULL,
			custom_background boolean NOT NULL DEFAULT false,
			custom_background_id int NULL
		)
	`);
	await prisma.$executeRawUnsafe(
		`ALTER TABLE bsc_patron_override ADD COLUMN IF NOT EXISTS role_missing_since timestamptz NULL`
	);
	await prisma.$executeRawUnsafe(
		`ALTER TABLE bsc_patron_override ADD COLUMN IF NOT EXISTS last_gift_at timestamptz NULL`
	);
	await prisma.$executeRawUnsafe(`ALTER TABLE bsc_patron_override ADD COLUMN IF NOT EXISTS gift_tier int NULL`);
	await prisma.$executeRawUnsafe(
		`ALTER TABLE bsc_patron_override ADD COLUMN IF NOT EXISTS gift_until timestamptz NULL`
	);
	await prisma.$executeRawUnsafe(
		`ALTER TABLE bsc_patron_override ADD COLUMN IF NOT EXISTS custom_background boolean NOT NULL DEFAULT false`
	);
	await prisma.$executeRawUnsafe(
		`ALTER TABLE bsc_patron_override ADD COLUMN IF NOT EXISTS custom_background_id int NULL`
	);
	ready.done = true;
}

function millis(value: Date | null): number | null {
	return value ? value.getTime() : null;
}

function toRow(row: PatronRow): BscPatronOverride {
	return {
		userId: row.user_id,
		tier: row.tier,
		manual: row.manual,
		cosmeticClaimedAt: millis(row.cosmetic_claimed_at),
		roleMissingSince: millis(row.role_missing_since),
		lastGiftAt: millis(row.last_gift_at),
		giftTier: row.gift_tier,
		giftUntil: millis(row.gift_until),
		customBackground: row.custom_background,
		customBackgroundId: row.custom_background_id
	};
}

export async function getBscPatronOverride(userId: string): Promise<BscPatronOverride | null> {
	await ensureStore();
	const rows = await prisma.$queryRaw<PatronRow[]>`
		SELECT user_id, tier, manual, cosmetic_claimed_at, role_missing_since, last_gift_at,
			gift_tier, gift_until, custom_background, custom_background_id
		FROM bsc_patron_override
		WHERE user_id = ${userId}
		LIMIT 1
	`;
	const row = rows[0];
	return row ? toRow(row) : null;
}

function dateOrNull(value: number | null): Date | null {
	return value === null ? null : new Date(value);
}

export async function updateBscPatronOverride(
	userId: string,
	patch: Partial<Omit<BscPatronOverride, 'userId'>>
): Promise<BscPatronOverride> {
	const current = await getBscPatronOverride(userId);
	const next: BscPatronOverride = {
		userId,
		tier: current?.tier ?? 0,
		manual: current?.manual ?? false,
		cosmeticClaimedAt: current?.cosmeticClaimedAt ?? null,
		roleMissingSince: current?.roleMissingSince ?? null,
		lastGiftAt: current?.lastGiftAt ?? null,
		giftTier: current?.giftTier ?? null,
		giftUntil: current?.giftUntil ?? null,
		customBackground: current?.customBackground ?? false,
		customBackgroundId: current?.customBackgroundId ?? null,
		...patch
	};
	await prisma.$executeRaw`
		INSERT INTO bsc_patron_override (
			user_id, tier, manual, cosmetic_claimed_at, role_missing_since, last_gift_at,
			gift_tier, gift_until, custom_background, custom_background_id
		)
		VALUES (
			${next.userId},
			${next.tier},
			${next.manual},
			${dateOrNull(next.cosmeticClaimedAt)},
			${dateOrNull(next.roleMissingSince)},
			${dateOrNull(next.lastGiftAt)},
			${next.giftTier},
			${dateOrNull(next.giftUntil)},
			${next.customBackground},
			${next.customBackgroundId}
		)
		ON CONFLICT (user_id) DO UPDATE SET
			tier = EXCLUDED.tier,
			manual = EXCLUDED.manual,
			cosmetic_claimed_at = EXCLUDED.cosmetic_claimed_at,
			role_missing_since = EXCLUDED.role_missing_since,
			last_gift_at = EXCLUDED.last_gift_at,
			gift_tier = EXCLUDED.gift_tier,
			gift_until = EXCLUDED.gift_until,
			custom_background = EXCLUDED.custom_background,
			custom_background_id = EXCLUDED.custom_background_id
	`;
	return next;
}
