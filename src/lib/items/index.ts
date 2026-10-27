/**
 * EDIT HERE — items.
 *
 * This is the item hub. Import item lookups, names, and IDs from this module
 * (`Items`, `itemID`, `resolveItems`, `deepResolveItems`, `EItem`, `BSOItem`).
 *
 * Stock OSRS item IDs (one base catalog, do not fork):
 *   packages/oldschooljs/src/assets/item_data.json
 *   surfaced by ./baseItems.ts
 *
 * Custom / discontinued / bot-specific items:
 *   src/lib/customItems/   (see ./customItems.ts)
 *   named IDs: src/lib/bso/BSOItem.ts
 *
 * To change a stock item ID: edit item_data.json (oldschooljs generate scripts),
 * not a call site.
 * To change a custom item ID: edit the `setCustomItem` call and `BSOItem`, then
 * any boss drop that uses the raw number (names resolve through `Items`).
 *
 * Other oldschooljs helpers (`Bank`, `Monsters`, `LootTable`, …) stay imported
 * from `oldschooljs`. Call sites that still import `Items` from `oldschooljs`
 * see the same singleton after this module has been loaded (it is loaded at boot
 * from `src/lib/safeglobals.ts`). Prefer this hub for new code.
 */

export type { Item } from './baseItems.js';
export { deepResolveItems, EItem, Items, itemID, resolveItems } from './baseItems.js';
export {
	BSOItem,
	customItems,
	customPrices,
	discontinuedItems,
	isCustomItem,
	isDeletedItemName,
	removeDiscontinuedItems,
	setCustomItem
} from './customItems.js';
