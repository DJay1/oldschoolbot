/**
 * Server firsts and bad luck: pure helpers (text and maths). No DB or Discord here so they are easy to test.
 * The scanning, claiming and sending lives in ./serverFirsts.ts.
 */

/** A bad luck drop is announced when the first one came at this many times the 1/N rate, or more. */
export const BAD_LUCK_MULTIPLIER = 3;

/** Only tertiary drops this rare (1/N with N at least this) count as "rare" for bad luck. Skips common tertiaries. */
export const BAD_LUCK_MIN_RATE = 200;

/**
 * More than this many players getting the same "first" in one scan means a data change (new tracking, a migration),
 * not a real race, so it is claimed quietly.
 */
export const MAX_SHARED_FIRST_NAMES = 3;

export function joinNames(names: string[]): string {
	if (names.length <= 1) return names[0] ?? '';
	if (names.length === 2) return `${names[0]} and ${names[1]}`;
	return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function serverFirstBossText(names: string[], monsterName: string): string {
	const who = joinNames(names);
	return names.length > 1
		? `🏆 **Server first!** ${who} are the first players to kill **${monsterName}**!`
		: `🏆 **Server first!** ${who} is the first player to kill **${monsterName}**!`;
}

export function serverFirstItemText(names: string[], itemName: string): string {
	const who = joinNames(names);
	return names.length > 1
		? `🏆 **Server first!** ${who} are the first players to get **${itemName}**!`
		: `🏆 **Server first!** ${who} is the first player to get **${itemName}**!`;
}

export function serverFirstLogText(names: string[], logName: string): string {
	const who = joinNames(names);
	// "complete **The Straw Hat Harvest** collection log", not "the **The ...**".
	const log = /^the\s/i.test(logName) ? `**${logName}**` : `the **${logName}**`;
	return names.length > 1
		? `🏆 **Server first!** ${who} are the first players to complete ${log} collection log!`
		: `🏆 **Server first!** ${who} is the first player to complete ${log} collection log!`;
}

export interface BadLuckInput {
	/** Item IDs and quantities added by the trip. */
	added: [number, number][];
	/** How many of each item the player had in their collection log before the trip. */
	amountBefore: (itemID: number) => number;
	/** Known 1/N rates (per kill) for this monster. */
	rates: ReadonlyMap<number, number>;
	/** KC after the trip, and kills in the trip. */
	kcAfter: number;
	quantity: number;
}

export interface BadLuckDrop {
	itemID: number;
	rate: number;
	kc: number;
	multiple: number;
}

/**
 * First-ever drops of a known-rate item that came at 3x the rate or later. The KC used is the earliest kill in the
 * trip the drop could have come from (KC before the trip + 1), so it never overstates the dry streak.
 */
export function findBadLuckDrops({ added, amountBefore, rates, kcAfter, quantity }: BadLuckInput): BadLuckDrop[] {
	const out: BadLuckDrop[] = [];
	if (!Number.isFinite(kcAfter) || !Number.isFinite(quantity) || quantity < 1) return out;
	const kc = Math.max(1, Math.floor(kcAfter) - Math.floor(quantity) + 1);
	for (const [itemID, qty] of added) {
		if (qty < 1) continue;
		const rate = rates.get(itemID);
		if (!rate || rate < BAD_LUCK_MIN_RATE) continue;
		if (amountBefore(itemID) > 0) continue;
		if (kc < rate * BAD_LUCK_MULTIPLIER) continue;
		out.push({ itemID, rate, kc, multiple: kc / rate });
	}
	return out;
}

export function badLuckText(name: string, itemName: string, monsterName: string, drop: BadLuckDrop): string {
	const multiple = Math.floor(drop.multiple * 10) / 10;
	return `😬 **Bad luck!** ${name} got their first **${itemName}** at **${drop.kc.toLocaleString('en-US')}** ${monsterName} KC, ${multiple}x the 1/${drop.rate.toLocaleString('en-US')} drop rate.`;
}

export interface ScanRow {
	key: string;
	userIDs: string[];
}

export type ScanAction =
	| { type: 'seed'; keys: string[] }
	| { type: 'claim'; key: string; userIDs: string[]; announce: boolean };

/**
 * What to do with the "firsts" found in a scan. Before a scope is seeded, everything found is claimed quietly (it
 * happened before this feature). After that, each new key is claimed and announced, unless too many players share it
 * or the caller can't name it.
 */
export function planScan({
	seeded,
	rows,
	canAnnounce
}: {
	seeded: boolean;
	rows: ScanRow[];
	canAnnounce: (key: string) => boolean;
}): ScanAction[] {
	if (!seeded) return [{ type: 'seed', keys: rows.map(r => r.key) }];
	return rows.map(r => ({
		type: 'claim' as const,
		key: r.key,
		userIDs: r.userIDs,
		announce: r.userIDs.length > 0 && r.userIDs.length <= MAX_SHARED_FIRST_NAMES && canAnnounce(r.key)
	}));
}
