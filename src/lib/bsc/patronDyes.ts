import { Bank, Items } from 'oldschooljs';

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
	/** Tiny twinkle points in the glow. Midnight Pup always sparkles; Golden Corgo can toggle this. */
	sparkles: boolean;
	/** Golden Corgo is a catch-all: players pick glow/recolour hex and a sparkle toggle. */
	customizable?: boolean;
}

/** Custom IDs 74014-74018 were unused in this repo. */
export const PATRON_DYES: readonly PatronDyeDefinition[] = [
	{
		key: 'biscuit',
		name: 'Biscuit',
		itemName: 'Biscuit dye',
		itemID: 74_014,
		points: 5,
		color: '#D36B1E',
		glow: '#FF9A3C',
		sparkles: false
	},
	{
		key: 'fetch',
		name: 'Fetch',
		itemName: 'Fetch dye',
		itemID: 74_015,
		points: 8,
		color: '#2EAF1A',
		glow: '#7DFF3D',
		sparkles: false
	},
	{
		key: 'pawberry',
		name: 'Pawberry',
		itemName: 'Pawberry dye',
		itemID: 74_016,
		points: 12,
		color: '#E2187A',
		glow: '#FF5CB3',
		sparkles: false
	},
	{
		key: 'midnight',
		name: 'Midnight Pup',
		itemName: 'Midnight Pup dye',
		itemID: 74_017,
		points: 18,
		color: '#1A1466',
		glow: '#4A3DFF',
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
		sparkles: false,
		customizable: true
	}
];

export const PATRON_DYE_ITEM_IDS = new Set(PATRON_DYES.map(dye => dye.itemID));

export const PATRON_DYE_PREVIEW_NOTE = 'Golden Corgo: any glow colour, any dye colour, sparkle on/off';

export interface PatronItemDye {
	itemID: number;
	dyeKey: PatronDyeDefinition['key'];
	mode: PatronDyeMode;
	glowHex?: string | null;
	recolourHex?: string | null;
	sparkle?: boolean | null;
}

const dyeCache = new Map<string, Map<number, PatronItemDye>>();


/** Resolve a bank item from a name or numeric id. Use this instead of Items.get for custom and vanilla names. */
export function resolveItemFromInput(input: string | undefined | null) {
	if (!input) return null;
	const trimmed = input.trim();
	if (!trimmed) return null;
	const asId = Number(trimmed);
	if (Number.isInteger(asId) && asId > 0) {
		return Items.get(asId) ?? Items.getItem(trimmed) ?? null;
	}
	return Items.getItem(trimmed) ?? null;
}

export function patronDyeByKey(key: string): PatronDyeDefinition | null {
	const normalized = key
		.trim()
		.toLowerCase()
		.replace(/[\s_-]+/g, '');
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

export function parsePatronDyeMode(input: string | undefined): PatronDyeMode | null {
	if (!input) return null;
	const normalized = input
		.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, '_');
	if (normalized === 'recolor') return 'recolour';
	if (
		normalized === 'recolor_glow' ||
		normalized === 'recolour+glow' ||
		normalized === 'recolor+glow' ||
		normalized === 'both'
	)
		return 'recolour_glow';
	return isPatronDyeMode(normalized) ? normalized : null;
}

/** Accept #RRGGBB or RRGGBB and return a normalized #RRGGBB, or null if invalid. */
export function parseHexColor(input: string | undefined | null): string | null {
	if (!input) return null;
	const match = /^#?([0-9a-fA-F]{6})$/.exec(input.trim());
	return match ? `#${match[1].toUpperCase()}` : null;
}

export interface PatronDyeAppearance {
	color: string;
	glow: string;
	sparkles: boolean;
}

/** Resolved tint, seer-style glow colour, and sparkle flag for a dyed item. */
export function resolvePatronDyeAppearance(dye: PatronItemDye | null | undefined): PatronDyeAppearance | null {
	if (!dye) return null;
	const def = patronDyeByKey(dye.dyeKey);
	if (!def) return null;
	if (def.customizable) {
		return {
			color: dye.recolourHex ?? def.color,
			glow: dye.glowHex ?? def.glow,
			sparkles: dye.sparkle ?? false
		};
	}
	return { color: def.color, glow: def.glow, sparkles: def.sparkles };
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
