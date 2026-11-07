const ready = { done: false };

export interface BscPatronOverride {
	userId: string;
	tier: number;
	manual: boolean;
	cosmeticClaimedAt: number | null;
}

async function ensureStore() {
	if (ready.done) return;
	await prisma.$executeRawUnsafe(`
		CREATE TABLE IF NOT EXISTS bsc_patron_override (
			user_id text PRIMARY KEY,
			tier int NOT NULL,
			manual boolean NOT NULL,
			cosmetic_claimed_at timestamptz NULL
		)
	`);
	ready.done = true;
}

export async function getBscPatronOverride(userId: string): Promise<BscPatronOverride | null> {
	await ensureStore();
	const rows = await prisma.$queryRaw<
		{ user_id: string; tier: number; manual: boolean; cosmetic_claimed_at: Date | null }[]
	>`
		SELECT user_id, tier, manual, cosmetic_claimed_at
		FROM bsc_patron_override
		WHERE user_id = ${userId}
		LIMIT 1
	`;
	const row = rows[0];
	if (!row) return null;
	return {
		userId: row.user_id,
		tier: row.tier,
		manual: row.manual,
		cosmeticClaimedAt: row.cosmetic_claimed_at ? row.cosmetic_claimed_at.getTime() : null
	};
}

export async function saveBscPatronOverride(input: {
	userId: string;
	tier: number;
	manual: boolean;
	cosmeticClaimedAt?: number | null;
}) {
	await ensureStore();
	const claimed =
		input.cosmeticClaimedAt === undefined
			? undefined
			: input.cosmeticClaimedAt === null
				? null
				: new Date(input.cosmeticClaimedAt);
	if (claimed === undefined) {
		await prisma.$executeRaw`
			INSERT INTO bsc_patron_override (user_id, tier, manual, cosmetic_claimed_at)
			VALUES (${input.userId}, ${input.tier}, ${input.manual}, NULL)
			ON CONFLICT (user_id) DO UPDATE SET
				tier = EXCLUDED.tier,
				manual = EXCLUDED.manual
		`;
		return;
	}
	await prisma.$executeRaw`
		INSERT INTO bsc_patron_override (user_id, tier, manual, cosmetic_claimed_at)
		VALUES (${input.userId}, ${input.tier}, ${input.manual}, ${claimed})
		ON CONFLICT (user_id) DO UPDATE SET
			tier = EXCLUDED.tier,
			manual = EXCLUDED.manual,
			cosmetic_claimed_at = EXCLUDED.cosmetic_claimed_at
	`;
}
