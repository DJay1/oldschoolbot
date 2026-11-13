import { Monsters } from 'oldschooljs';

import { SlayerTaskUnlocksEnum } from '@/lib/slayer/slayerUnlocks.js';

const ready = { done: false };

async function ensureStore() {
	if (ready.done) return;
	await prisma.$executeRawUnsafe(`
		CREATE TABLE IF NOT EXISTS bsc_slayer_blocks (
			user_id text NOT NULL,
			master_id int NOT NULL,
			monster_id int NOT NULL,
			created_at timestamptz NOT NULL DEFAULT NOW(),
			PRIMARY KEY (user_id, master_id, monster_id)
		)
	`);
	ready.done = true;
}

export async function getSlayerBlocks(userId: string, masterId: number): Promise<number[]> {
	await ensureStore();
	const rows = await prisma.$queryRaw<{ monster_id: number }[]>`
		SELECT monster_id FROM bsc_slayer_blocks
		WHERE user_id = ${userId} AND master_id = ${masterId}
		ORDER BY created_at ASC
	`;
	return rows.map(row => row.monster_id);
}

export async function getAllSlayerBlocks(userId: string): Promise<Map<number, number[]>> {
	await ensureStore();
	const rows = await prisma.$queryRaw<{ master_id: number; monster_id: number }[]>`
		SELECT master_id, monster_id FROM bsc_slayer_blocks
		WHERE user_id = ${userId}
		ORDER BY master_id ASC, created_at ASC
	`;
	const byMaster = new Map<number, number[]>();
	for (const row of rows) {
		const list = byMaster.get(row.master_id) ?? [];
		list.push(row.monster_id);
		byMaster.set(row.master_id, list);
	}
	return byMaster;
}

export async function addSlayerBlock(userId: string, masterId: number, monsterId: number): Promise<void> {
	await ensureStore();
	await prisma.$executeRaw`
		INSERT INTO bsc_slayer_blocks (user_id, master_id, monster_id)
		VALUES (${userId}, ${masterId}, ${monsterId})
		ON CONFLICT DO NOTHING
	`;
}

export async function removeSlayerBlock(userId: string, masterId: number, monsterId: number): Promise<boolean> {
	await ensureStore();
	const removed = await prisma.$executeRaw`
		DELETE FROM bsc_slayer_blocks
		WHERE user_id = ${userId} AND master_id = ${masterId} AND monster_id = ${monsterId}
	`;
	return removed > 0;
}

const OLD_BLOCK_REFUND = 100;

export const SLAYER_UPDATE_UNLOCK_REFUNDS: readonly { id: SlayerTaskUnlocksEnum; refund: number; remove: boolean }[] = [
	{ id: SlayerTaskUnlocksEnum.PedalToTheMetals, refund: 100, remove: true },
	{ id: SlayerTaskUnlocksEnum.IReallyMithYou, refund: 120, remove: true },
	{ id: SlayerTaskUnlocksEnum.AdamindSomeMore, refund: 100, remove: true },
	{ id: SlayerTaskUnlocksEnum.RUUUUUNE, refund: 100, remove: true },
	{ id: SlayerTaskUnlocksEnum.IHopeYouMithMe, refund: 80, remove: true },
	{ id: SlayerTaskUnlocksEnum.RingBling, refund: 150, remove: false },
	{ id: SlayerTaskUnlocksEnum.BiggerAndBadder, refund: 100, remove: false }
];

const METAL_DRAGON_IDS = [
	Monsters.BronzeDragon.id,
	Monsters.IronDragon.id,
	Monsters.SteelDragon.id,
	Monsters.MithrilDragon.id,
	Monsters.AdamantDragon.id,
	Monsters.RuneDragon.id
];
const METAL_DRAGON_MASTERS = [5, 6, 7];

export async function runSlayerUpdateMigration(): Promise<void> {
	await ensureStore();
	await prisma.$executeRawUnsafe(`
		CREATE TABLE IF NOT EXISTS bsc_migrations (
			name text PRIMARY KEY,
			ran_at timestamptz NOT NULL DEFAULT NOW()
		)
	`);

	const refundSql = SLAYER_UPDATE_UNLOCK_REFUNDS.map(
		u => `(CASE WHEN ${u.id} = ANY("slayer.unlocks") THEN ${u.refund} ELSE 0 END)`
	).join(' + ');
	const removeIds = SLAYER_UPDATE_UNLOCK_REFUNDS.filter(u => u.remove).map(u => u.id);
	const allIds = SLAYER_UPDATE_UNLOCK_REFUNDS.map(u => u.id);
	const unlocksSql = removeIds.reduce((sql, id) => `array_remove(${sql}, ${id})`, '"slayer.unlocks"');

	await prisma.$transaction(async tx => {
		const marked = await tx.$queryRaw<{ name: string }[]>`
			INSERT INTO bsc_migrations (name) VALUES ('slayer_update_2025')
			ON CONFLICT DO NOTHING
			RETURNING name
		`;
		if (marked.length === 0) return;

		await tx.$executeRawUnsafe(`
			UPDATE users SET
				"slayer.points" = "slayer.points" + ${OLD_BLOCK_REFUND} * cardinality("slayer.blocked_ids") + ${refundSql},
				"slayer.blocked_ids" = '{}',
				"slayer.unlocks" = ${unlocksSql}
			WHERE cardinality("slayer.blocked_ids") > 0 OR "slayer.unlocks" && ARRAY[${allIds.join(',')}]::int[]
		`);

		await tx.$executeRawUnsafe(`
			UPDATE slayer_tasks SET monster_id = ${Monsters.BronzeDragon.id}
			WHERE quantity_remaining > 0
				AND skipped = false
				AND slayer_master_id IN (${METAL_DRAGON_MASTERS.join(',')})
				AND monster_id IN (${METAL_DRAGON_IDS.join(',')})
		`);
	});
}
