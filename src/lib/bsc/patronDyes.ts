import { Bank } from 'oldschooljs';

export const PATRON_DYE_MODES = ['recolour', 'glow', 'recolour_glow'] as const;
export type PatronDyeMode = (typeof PATRON_DYE_MODES)[number];

export interface PatronDyeDefinition {
	key: 'biscuit' | 'fetch' | 'pawberry' | 'midnight' | 'golden';
	name: string;
	itemName: string;
	itemID: number;
	points: number;
	/** Tint applied to the item icon. */
	color: string;
	/** Soft glow drawn behind the icon. */
	glow: string;
	/** Tiny twinkle points in the glow, Midnight Pup and Golden Corgo only. */
	sparkles: boolean;
}

/** Custom IDs 74014-74018 were unused in this repo. */
export const PATRON_DYES: readonly PatronDyeDefinition[] = [
	{
		key: 'biscuit',
		name: 'Biscuit',
		itemName: 'Biscuit dye',
		itemID: 74_014,
		points: 5,
		color: '#E8C99A',
		glow: '#F0D7B0',
		sparkles: false
	},
	{
		key: 'fetch',
		name: 'Fetch',
		itemName: 'Fetch dye',
		itemID: 74_015,
		points: 8,
		color: '#9BCB3C',
		glow: '#C5E86A',
		sparkles: false
	},
	{
		key: 'pawberry',
		name: 'Pawberry',
		itemName: 'Pawberry dye',
		itemID: 74_016,
		points: 12,
		color: '#C84E9A',
		glow: '#E889C2',
		sparkles: false
	},
	{
		key: 'midnight',
		name: 'Midnight Pup',
		itemName: 'Midnight Pup dye',
		itemID: 74_017,
		points: 18,
		color: '#1C3F8A',
		glow: '#4F7FE8',
		sparkles: true
	},
	{
		key: 'golden',
		name: 'Golden Corgo',
		itemName: 'Golden Corgo dye',
		itemID: 74_018,
		points: 25,
		color: '#D4A017',
		glow: '#F5D76A',
		sparkles: true
	}
];

export const PATRON_DYE_ITEM_IDS = new Set(PATRON_DYES.map(dye => dye.itemID));

export interface PatronItemDye {
	itemID: number;
	dyeKey: PatronDyeDefinition['key'];
	mode: PatronDyeMode;
}

const dyeCache = new Map<string, Map<number, PatronItemDye>>();

export function patronDyeByKey(key: string): PatronDyeDefinition | null {
	const normalized = key.trim().toLowerCase().replace(/[\s_-]+/g, '');
	return (
		PATRON_DYES.find(
			dye =>
				dye.key === normalized ||
				dye.name.replace(/[\s_-]+/g, '').toLowerCase() === normalized ||
				dye.itemName.replace(/[\s_-]+/g, '').toLowerCase() === normalized
		) ?? null
	);
}

export function patronDyeById(itemID: number): PatronDyeDefinition | null {
	return PATRON_DYES.find(dye => dye.itemID === itemID) ?? null;
}

export function isPatronDyeMode(value: string): value is PatronDyeMode {
	return (PATRON_DYE_MODES as readonly string[]).includes(value);
}

export function setPatronDyeCache(userId: string, dyes: PatronItemDye[]) {
	const map = new Map<number, PatronItemDye>();
	for (const dye of dyes) map.set(dye.itemID, dye);
	dyeCache.set(userId, map);
}

export function clearPatronDyeCache(userId?: string) {
	if (userId) dyeCache.delete(userId);
	else dyeCache.clear();
}

export function getCachedPatronDye(userId: string, itemID: number): PatronItemDye | null {
	return dyeCache.get(userId)?.get(itemID) ?? null;
}

export function cachePatronDye(userId: string, dye: PatronItemDye) {
	const map = dyeCache.get(userId) ?? new Map();
	map.set(dye.itemID, dye);
	dyeCache.set(userId, map);
}

export function uncachePatronDye(userId: string, itemID: number) {
	dyeCache.get(userId)?.delete(itemID);
}

/** True when this player has a patron dye on this item ID, making it untradeable for them. */
export function userHasPatronDyeLock(userId: string | undefined, itemID: number): boolean {
	if (!userId) return false;
	return dyeCache.get(userId)?.has(itemID) ?? false;
}

export function parsePatronDyeMode(input: string | undefined): PatronDyeMode | null {
	if (!input) return null;
	const normalized = input.trim().toLowerCase().replace(/[\s-]+/g, '_');
	if (normalized === 'recolor') return 'recolour';
	if (normalized === 'recolor_glow' || normalized === 'recolour+glow' || normalized === 'recolor+glow' || normalized === 'both') return 'recolour_glow';
	return isPatronDyeMode(normalized) ? normalized : null;
}

export function patronDyeCostBank(dye: PatronDyeDefinition, quantity = 1): Bank {
	return new Bank().add(dye.itemID, quantity);
}

/** Fixed sparkle offsets around an item icon, used by the glow renderer. */
export const PATRON_DYE_SPARKLE_OFFSETS = [
	{ x: -10, y: -8, size: 2 },
	{ x: 9, y: -6, size: 1.5 },
	{ x: -6, y: 9, size: 1.5 },
	{ x: 11, y: 7, size: 2 },
	{ x: 0, y: -12, size: 1.25 },
	{ x: 7, y: 2, size: 1 }
] as const;
