import { Bank, Items } from 'oldschooljs';

import { ensurePatronRevampStore } from '@/lib/bsc/patronAccount.js';
import {
	cachePatronDye,
	clearPatronDyeCache,
	isPatronDyeMode,
	type PatronDyeMode,
	type PatronItemDye,
	parseHexColor,
	resolveItemFromInput,
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
	glow_hex: string | null;
	recolour_hex: string | null;
	sparkle: boolean | null;
}

function toDye(row: DyeRow): PatronItemDye {
	return {
		itemID: row.item_id,
		dyeKey: row.dye_key as PatronItemDye['dyeKey'],
		mode: row.mode as PatronDyeMode,
		glowHex: row.glow_hex,
		recolourHex: row.recolour_hex,
		sparkle: row.sparkle
	};
}

export async function loadPatronDyesForUser(userId: string): Promise<PatronItemDye[]> {
	await ensurePatronRevampStore();
	const rows = await prisma.$queryRaw<DyeRow[]>`
		SELECT user_id, item_id, dye_key, mode, glow_hex, recolour_hex, sparkle
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

	return `You bought ${dye.itemName} for ${dye.points} patron points. Balance: ${debit.balance}. Use it with /patron dye.`;
}

export interface UsePatronDyeOptions {
	glowHex?: string;
	recolourHex?: string;
	sparkle?: boolean;
}

export async function usePatronDye(
	user: MUser,
	dyeInput: string,
	itemInput: string,
	modeInput?: string,
	options?: UsePatronDyeOptions
): Promise<string> {
	const dye = patronDyeByKey(dyeInput) ?? patronDyeById(resolveItemFromInput(dyeInput)?.id ?? -1);
	if (!dye) return 'Pick a dye you own: Biscuit, Fetch, Pawberry, Midnight Pup, or Golden Corgo.';
	const mode = parsePatronDyeMode(modeInput) ?? 'recolour_glow';
	if (!isPatronDyeMode(mode)) return 'Mode must be recolour, glow, or recolour_glow.';

	const item = resolveItemFromInput(itemInput);
	if (!item) return "That's not a valid item.";
	if (patronDyeById(item.id)) return 'You cannot dye a dye.';
	if (user.bank.amount(item.id) < 1) return `You do not have any ${item.name} in your bank.`;
	if (user.bank.amount(dye.itemID) < 1)
		return `You do not have any ${dye.itemName}. Buy one with /patron dyes buy:${dye.name}.`;

	const customRequested =
		Boolean(options?.glowHex) || Boolean(options?.recolourHex) || options?.sparkle !== undefined;
	if (customRequested && !dye.customizable) {
		return 'glow_hex, recolour_hex, and sparkle are only for Golden Corgo dye.';
	}

	let glowHex: string | null = null;
	let recolourHex: string | null = null;
	let sparkle: boolean | null = null;
	if (dye.customizable) {
		if (options?.glowHex) {
			glowHex = parseHexColor(options.glowHex);
			if (!glowHex) return 'glow_hex must be a 6-digit hex colour like #FF9A3C.';
		}
		if (options?.recolourHex) {
			recolourHex = parseHexColor(options.recolourHex);
			if (!recolourHex) return 'recolour_hex must be a 6-digit hex colour like #D4A017.';
		}
		sparkle = options?.sparkle ?? false;
	}

	const removed = await user.transactItems({ itemsToRemove: new Bank().add(dye.itemID, 1) });
	if (!removed) return `Could not consume ${dye.itemName}.`;

	await ensurePatronRevampStore();
	await prisma.$executeRaw`
		INSERT INTO bsc_patron_item_dyes (user_id, item_id, dye_key, mode, applied_at, glow_hex, recolour_hex, sparkle)
		VALUES (${user.id}, ${item.id}, ${dye.key}, ${mode}, NOW(), ${glowHex}, ${recolourHex}, ${sparkle})
		ON CONFLICT (user_id, item_id)
		DO UPDATE SET
			dye_key = EXCLUDED.dye_key,
			mode = EXCLUDED.mode,
			applied_at = NOW(),
			glow_hex = EXCLUDED.glow_hex,
			recolour_hex = EXCLUDED.recolour_hex,
			sparkle = EXCLUDED.sparkle
	`;
	cachePatronDye(user.id, {
		itemID: item.id,
		dyeKey: dye.key,
		mode,
		glowHex,
		recolourHex,
		sparkle
	});
	markPatronDyeCacheFresh(user.id);

	const sparkleNote = dye.customizable
		? sparkle
			? ' Sparkles are on.'
			: ' Sparkles are off.'
		: dye.sparkles
			? ' This dye also adds a few sparkles to the glow.'
			: '';
	const customNote =
		dye.customizable && (glowHex || recolourHex)
			? ` Custom colours: glow ${glowHex ?? dye.glow}, recolour ${recolourHex ?? dye.color}.`
			: '';
	return `You used ${dye.itemName} on your ${item.name} (${mode.replaceAll('_', ' ')}). That item is untradeable while dyed. Undyeing returns the dye to your bank.${sparkleNote}${customNote}`;
}

export async function undyePatronItem(user: MUser, itemInput: string): Promise<string> {
	const item = resolveItemFromInput(itemInput);
	if (!item) return "That's not a valid item.";
	await ensurePatronRevampStore();
	const existing = await prisma.$queryRaw<{ item_id: number; dye_key: string }[]>`
		SELECT item_id, dye_key
		FROM bsc_patron_item_dyes
		WHERE user_id = ${user.id} AND item_id = ${item.id}
	`;
	if (!existing[0]) return `${item.name} does not have a patron dye.`;
	const dye = patronDyeByKey(existing[0].dye_key);
	if (dye) {
		try {
			await user.addItemsToBank({ itemsToAdd: new Bank().add(dye.itemID, 1), collectionLog: false });
		} catch (err) {
			Logging.logError(err as Error, { user_id: user.id, source: 'undyePatronItem' });
			return `Could not return ${dye.itemName} to your bank. The dye was left on ${item.name}.`;
		}
	}
	await prisma.$executeRaw`
		DELETE FROM bsc_patron_item_dyes
		WHERE user_id = ${user.id} AND item_id = ${item.id}
	`;
	uncachePatronDye(user.id, item.id);
	const refundNote = dye ? ` ${dye.itemName} was returned to your bank.` : '';
	return `You removed the patron dye from ${item.name}.${refundNote} That item is tradeable again.`;
}

export function formatPatronDyeShop(points: number, applied: PatronItemDye[]): string {
	const catalog = [
		'Patron dye shop (Top Dog and above). Spend monthly patron points to dye one item ID in your bank. Glow uses the same seer-style effect as the Seer highlight, in that the dye colour. Dyed items are untradeable until you undye, which returns the dye to your bank.',
		`Your balance: ${points} patron points.`,
		'',
		'Biscuit dye — 5 points, burnt orange, seer-style glow.',
		'Fetch dye — 8 points, tennis-ball green, seer-style glow.',
		'Pawberry dye — 12 points, hot pink, seer-style glow.',
		'Midnight Pup dye — 18 points, indigo, seer-style glow with sparkles.',
		'Golden Corgo dye — 25 points, catch-all. Set glow_hex and recolour_hex (#RRGGBB) and toggle sparkle on or off. Defaults to gold with sparkles off.',
		'',
		'Modes: recolour, glow, or recolour_glow (default).',
		'Check points or buy: /patron dyes  or  /patron dyes buy:Biscuit',
		'Use a dye: /patron dye item:Bandos chestplate dye:Fetch mode:recolour_glow',
		'Golden Corgo: /patron dye item:Bandos chestplate dye:Golden Corgo glow_hex:#FF00AA recolour_hex:#00FFCC sparkle:True',
		'Undye (returns the dye): /patron undye item:Bandos chestplate'
	];
	if (applied.length > 0) {
		catalog.push('');
		catalog.push('Currently dyed:');
		for (const row of applied) {
			const name = Items.get(row.itemID)?.name ?? String(row.itemID);
			const extras = [
				row.glowHex ? `glow ${row.glowHex}` : null,
				row.recolourHex ? `recolour ${row.recolourHex}` : null,
				row.sparkle ? 'sparkles on' : null
			].filter(Boolean);
			const extraText = extras.length ? `, ${extras.join(', ')}` : '';
			catalog.push(`- ${name}: ${row.dyeKey} (${row.mode.replaceAll('_', ' ')}${extraText})`);
		}
	}
	return catalog.join('\n');
}
