import { Bank, Items } from 'oldschooljs';

import { ensurePatronRevampStore } from '@/lib/bsc/patronAccount.js';
import {
	type PatronDyeMode,
	type PatronItemDye,
	cachePatronDye,
	clearPatronDyeCache,
	isPatronDyeMode,
	parsePatronDyeMode,
	patronDyeById,
	patronDyeByKey,
	setPatronDyeCache,
	uncachePatronDye
} from '@/lib/bsc/patronDyes.js';
import { debitPatronPoints, refundPatronPoints } from '@/lib/bsc/patronPoints.js';

interface DyeRow {
	user_id: string;
	item_id: number;
	dye_key: string;
	mode: string;
}

function toDye(row: DyeRow): PatronItemDye {
	return {
		itemID: row.item_id,
		dyeKey: row.dye_key as PatronItemDye['dyeKey'],
		mode: row.mode as PatronDyeMode
	};
}

export async function loadPatronDyesForUser(userId: string): Promise<PatronItemDye[]> {
	await ensurePatronRevampStore();
	const rows = await prisma.$queryRaw<DyeRow[]>`
		SELECT user_id, item_id, dye_key, mode
		FROM bsc_patron_item_dyes
		WHERE user_id = ${userId}
	`;
	const dyes = rows.map(toDye);
	setPatronDyeCache(userId, dyes);
	return dyes;
}

const hydrated = new Set<string>();

export async function hydratePatronDyeCache(userId: string): Promise<void> {
	if (hydrated.has(userId)) return;
	await loadPatronDyesForUser(userId);
	hydrated.add(userId);
}

export function markPatronDyeCacheFresh(userId: string) {
	hydrated.add(userId);
}

export function invalidatePatronDyeHydration(userId?: string) {
	if (userId) {
		hydrated.delete(userId);
		clearPatronDyeCache(userId);
	} else {
		hydrated.clear();
		clearPatronDyeCache();
	}
}

export async function buyPatronDye(user: MUser, dyeInput: string): Promise<string> {
	const dye = patronDyeByKey(dyeInput);
	if (!dye) return 'Pick a dye: Biscuit, Fetch, Pawberry, Midnight Pup, or Golden Corgo.';

	const debit = await debitPatronPoints(user.id, dye.points, `buy_dye:${dye.key}`);
	if (!debit.ok) return debit.message;

	try {
		await user.addItemsToBank({ itemsToAdd: new Bank().add(dye.itemID, 1), collectionLog: true });
	} catch (err) {
		const balance = await refundPatronPoints(user.id, dye.points, `refund_dye:${dye.key}`);
		Logging.logError(err as Error, { user_id: user.id, source: 'buyPatronDye' });
		return `Could not add ${dye.itemName} to your bank. Your ${dye.points} points were refunded (balance: ${balance}).`;
	}

	return `You bought ${dye.itemName} for ${dye.points} patron points. Balance: ${debit.balance}. Use it with /patron dyes action:use.`;
}

export async function usePatronDye(
	user: MUser,
	dyeInput: string,
	itemInput: string,
	modeInput?: string
): Promise<string> {
	const dye = patronDyeByKey(dyeInput) ?? patronDyeById(Items.get(dyeInput)?.id ?? -1);
	if (!dye) return 'Pick a dye you own: Biscuit, Fetch, Pawberry, Midnight Pup, or Golden Corgo.';
	const mode = parsePatronDyeMode(modeInput) ?? 'recolour_glow';
	if (!isPatronDyeMode(mode)) return 'Mode must be recolour, glow, or recolour_glow.';

	const item = Items.get(itemInput);
	if (!item) return "That's not a valid item.";
	if (patronDyeById(item.id)) return 'You cannot dye a dye.';
	if (user.bank.amount(item.id) < 1) return `You do not have any ${item.name} in your bank.`;
	if (user.bank.amount(dye.itemID) < 1) return `You do not have any ${dye.itemName}. Buy one with /patron dyes action:buy.`;

	const removed = await user.transactItems({ itemsToRemove: new Bank().add(dye.itemID, 1) });
	if (!removed) return `Could not consume ${dye.itemName}.`;

	await ensurePatronRevampStore();
	await prisma.$executeRaw`
		INSERT INTO bsc_patron_item_dyes (user_id, item_id, dye_key, mode, applied_at)
		VALUES (${user.id}, ${item.id}, ${dye.key}, ${mode}, NOW())
		ON CONFLICT (user_id, item_id)
		DO UPDATE SET dye_key = EXCLUDED.dye_key, mode = EXCLUDED.mode, applied_at = NOW()
	`;
	cachePatronDye(user.id, { itemID: item.id, dyeKey: dye.key, mode });
	markPatronDyeCacheFresh(user.id);

	const sparkleNote = dye.sparkles ? ' This dye also adds a few sparkles to the glow.' : '';
	return `You used ${dye.itemName} on your ${item.name} (${mode.replaceAll('_', ' ')}). That item is untradeable while dyed. Undyeing consumes the dye with no refund.${sparkleNote}`;
}

export async function undyePatronItem(user: MUser, itemInput: string): Promise<string> {
	const item = Items.get(itemInput);
	if (!item) return "That's not a valid item.";
	await ensurePatronRevampStore();
	const rows = await prisma.$queryRaw<{ item_id: number }[]>`
		DELETE FROM bsc_patron_item_dyes
		WHERE user_id = ${user.id} AND item_id = ${item.id}
		RETURNING item_id
	`;
	if (!rows[0]) return `${item.name} does not have a patron dye.`;
	uncachePatronDye(user.id, item.id);
	return `You removed the patron dye from ${item.name}. The dye is consumed and is not refunded. That item is tradeable again.`;
}

export function formatPatronDyeShop(points: number, applied: PatronItemDye[]): string {
	const catalog = [
		'Patron dye shop. One dye applies to one item ID in your bank. Dyed items are untradeable until you undye (no refund).',
		`Your balance: ${points} patron points.`,
		'',
		'Biscuit dye — 5 points, cream/tan, soft glow.',
		'Fetch dye — 8 points, tennis-ball green, soft glow.',
		'Pawberry dye — 12 points, purple-pink, soft glow.',
		'Midnight Pup dye — 18 points, deep blue, glow with sparkles.',
		'Golden Corgo dye — 25 points, gold, glow with sparkles.',
		'',
		'Modes: recolour, glow, or recolour_glow (default).',
		'Commands: /patron dyes action:buy dye:Biscuit | action:use dye:Fetch item:Dragon scimitar mode:recolour_glow | action:undye item:Dragon scimitar'
	];
	if (applied.length > 0) {
		catalog.push('');
		catalog.push('Currently dyed:');
		for (const row of applied) {
			const name = Items.get(row.itemID)?.name ?? String(row.itemID);
			catalog.push(`- ${name}: ${row.dyeKey} (${row.mode.replaceAll('_', ' ')})`);
		}
	}
	return catalog.join('\n');
}
