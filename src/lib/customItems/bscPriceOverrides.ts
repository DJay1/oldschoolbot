import { Items } from 'oldschooljs';

/**
 * BSC price changes for normal OSRS items. Every price path (/sell, GE guide prices, bank value,
 * the /buy sell floor) reads item.price, so changing it here covers all of them.
 */
export const BSC_ITEM_PRICE_OVERRIDES: Record<string, number> = {
	// Farmed from the Pumpkin seed allotment. Priced like the other level 47+ allotment crops (Nov 16).
	Pumpkin: 100
};

for (const [name, price] of Object.entries(BSC_ITEM_PRICE_OVERRIDES)) {
	Items.getOrThrow(name).price = price;
}
