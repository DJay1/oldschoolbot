import { Bank, Items } from 'oldschooljs';

import { Slayer2026Item } from '@/lib/customItems/slayer2026.js';

export const HORN_OF_PLENTY_MAX_CHARGES = 20_000;
export const HORN_OF_PLENTY_CATCHES_PER_CHARGE = 25;

const ready = { done: false };

async function ensureStore() {
	if (ready.done) return;
	await prisma.$executeRawUnsafe(`
		CREATE TABLE IF NOT EXISTS bsc_horn_of_plenty (
			user_id text PRIMARY KEY,
			charges int NOT NULL DEFAULT 0
		)
	`);
	ready.done = true;
}

export async function getHornOfPlentyCharges(userId: string): Promise<number> {
	await ensureStore();
	const rows = await prisma.$queryRaw<{ charges: number }[]>`
		SELECT charges FROM bsc_horn_of_plenty WHERE user_id = ${userId} LIMIT 1
	`;
	return rows[0]?.charges ?? 0;
}

async function changeHornOfPlentyCharges(userId: string, delta: number): Promise<number> {
	await ensureStore();
	const rows = await prisma.$queryRaw<{ charges: number }[]>`
		INSERT INTO bsc_horn_of_plenty (user_id, charges) VALUES (${userId}, GREATEST(0, ${delta}))
		ON CONFLICT (user_id) DO UPDATE SET charges = GREATEST(0, bsc_horn_of_plenty.charges + ${delta})
		RETURNING charges
	`;
	return rows[0].charges;
}

async function addHornOfPlentyCharges(userId: string, amount: number): Promise<number | null> {
	await ensureStore();
	const rows = await prisma.$queryRaw<{ charges: number }[]>`
		INSERT INTO bsc_horn_of_plenty (user_id, charges) VALUES (${userId}, ${amount})
		ON CONFLICT (user_id) DO UPDATE SET charges = bsc_horn_of_plenty.charges + ${amount}
		WHERE bsc_horn_of_plenty.charges + ${amount} <= ${HORN_OF_PLENTY_MAX_CHARGES}
		RETURNING charges
	`;
	return rows[0]?.charges ?? null;
}

export function spendHornOfPlentyCharges(userId: string, amount: number) {
	if (amount <= 0) return getHornOfPlentyCharges(userId);
	return changeHornOfPlentyCharges(userId, -amount);
}

export async function chargeHornOfPlentyCommand(
	interaction: MInteraction,
	user: MUser,
	amount: number | undefined
): CommandResponse {
	const charges = await getHornOfPlentyCharges(user.id);
	if (!amount) {
		return `Your Horn of plenty has ${charges.toLocaleString()} charges. Use \`/minion charge item:Horn of plenty amount:[1-${HORN_OF_PLENTY_MAX_CHARGES.toLocaleString()}]\`, each Gryphon feather adds 1 charge.`;
	}
	if (!user.hasEquippedOrInBank(Slayer2026Item.HORN_OF_PLENTY)) {
		return "You don't own a Horn of plenty.";
	}
	const space = HORN_OF_PLENTY_MAX_CHARGES - charges;
	if (space <= 0)
		return `Your Horn of plenty is already full (${HORN_OF_PLENTY_MAX_CHARGES.toLocaleString()} charges).`;
	const toAdd = Math.min(amount, space);
	const cost = new Bank().add('Gryphon feather', toAdd);
	if (!user.owns(cost)) return `You don't own ${cost}.`;

	await interaction.confirmation(
		`Are you sure you want to use **${cost}** to add ${toAdd.toLocaleString()} charges to your ${
			Items.getOrThrow(Slayer2026Item.HORN_OF_PLENTY).name
		}?`
	);
	const newCharges = await addHornOfPlentyCharges(user.id, toAdd);
	if (newCharges === null) {
		return `That would take your Horn of plenty over ${HORN_OF_PLENTY_MAX_CHARGES.toLocaleString()} charges.`;
	}
	try {
		await user.transactItems({ itemsToRemove: cost });
	} catch (err) {
		await changeHornOfPlentyCharges(user.id, -toAdd);
		throw err;
	}
	return `You added **${cost}** to your Horn of plenty, it now has ${newCharges.toLocaleString()} charges.`;
}
