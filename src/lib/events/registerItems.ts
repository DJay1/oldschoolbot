import { registerChristmasItems } from './christmas/items.js';
import { registerEasterItems } from './easter/items.js';
import { registerHalloweenItems } from './halloween/items.js';
import { shouldRegisterSeasonalItemDefinitions } from './registry.js';
import { registerSummerItems } from './summer/items.js';

/**
 * Loads seasonal item definitions into the shared Items catalog.
 * Called from the custom item file so other item data is untouched.
 * This does not enable drops, shops, or commands. See the events registry.
 */
export function registerSeasonalEventItems() {
	if (!shouldRegisterSeasonalItemDefinitions()) return;
	registerHalloweenItems();
	registerChristmasItems();
	registerEasterItems();
	registerSummerItems();
}
