/**
 * Stock Old School RuneScape item catalog.
 *
 * Source of truth for reserved game item IDs (do not copy this list elsewhere):
 *   packages/oldschooljs/src/assets/item_data.json
 * Loaded once by packages/oldschooljs/src/structures/Items.ts into the `Items` singleton.
 * Named stock IDs: `EItem` (packages/oldschooljs/src/EItem.ts).
 *
 * New code should import from `@/lib/items/index.js` so custom items are registered
 * on this same singleton. Importing this file alone does not load custom items.
 */

export type { Item } from 'oldschooljs';
export { deepResolveItems, EItem, Items, itemID, resolveItems } from 'oldschooljs';
