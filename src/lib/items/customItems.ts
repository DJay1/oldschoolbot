/**
 * Custom, discontinued, and bot-specific items.
 *
 * Edit definitions in `src/lib/customItems/` (`customItems.ts` loads the sibling
 * modules: base items, deleted items, invention, pets, and the rest).
 * Named numeric IDs for those items live in `src/lib/bso/BSOItem.ts` (`BSOItem`).
 *
 * Add an item with `setCustomItem(id, name, baseItem, data, price)` in the matching
 * file under `src/lib/customItems/`, then add a `BSOItem` entry if other code needs
 * a named constant. Do not put custom IDs into `item_data.json`.
 *
 * Re-exporting from `src/lib/customItems/customItems.ts` loads every `setCustomItem` call.
 */
export { BSOItem } from '@/lib/bso/BSOItem.js';

export { discontinuedItems, removeDiscontinuedItems } from '@/lib/customItems/customItems.js';
export {
	customItems,
	customPrices,
	isCustomItem,
	isDeletedItemName,
	setCustomItem
} from '@/lib/customItems/util.js';
