import { Bank } from 'oldschooljs';

import { isEventActive } from '@/lib/events/registry.js';
import { isThanksgivingActive } from '@/lib/events/thanksgiving/core.js';
import { ThanksgivingItem } from '@/lib/events/thanksgiving/items.js';
import type { SeasonalEventId } from '@/lib/events/types.js';
import { allOpenables, getOpenableLoot, type UnifiedOpenable } from '@/lib/openables.js';

/**
 * Cap for /simulate open. 1,000 matches /simulate cox, keeps mystery-box and
 * clue-casket loops in a safe runtime/memory range, and is plenty for a loot summary.
 */
export const SIMULATE_OPEN_MAX = 1000;

export const DISCORD_CONTENT_LIMIT = 2000;
export const DISCORD_CONTENT_SAFE = DISCORD_CONTENT_LIMIT - 150;

/**
 * New Straw Hat Harvest items stay hidden in simulations while the event is off.
 * The 2021 Cornucopia already exists in the game, so it is not hidden.
 */
export function unreleasedEventItemIDs(now = Date.now()): Set<number> {
	const hidden = new Set<number>();
	if (!isThanksgivingActive(now)) {
		for (const id of Object.values(ThanksgivingItem)) {
			if (id !== ThanksgivingItem.CORNUCOPIA_2021) hidden.add(id);
		}
	}
	return hidden;
}

export function isSimulatableOpenable(openable: UnifiedOpenable, now = Date.now()): boolean {
	if (unreleasedEventItemIDs(now).has(openable.id)) return false;
	const eventId = openable.seasonalEventId as SeasonalEventId | undefined;
	if (eventId && !isEventActive(eventId, now) && openable.availableWhenEventInactive !== true) {
		return false;
	}
	return true;
}

export function findSimulatableOpenable(name: string, now = Date.now()): UnifiedOpenable | null {
	const needle = name.toLowerCase().trim();
	if (!needle) return null;
	return (
		allOpenables.find(
			openable =>
				isSimulatableOpenable(openable, now) &&
				(openable.name.toLowerCase() === needle ||
					openable.aliases.some(alias => alias.toLowerCase() === needle))
		) ?? null
	);
}

export function autocompleteSimulatableOpenables(value: string, now = Date.now()): { name: string; value: string }[] {
	const query = value.toLowerCase().trim();
	return allOpenables
		.filter(
			openable =>
				isSimulatableOpenable(openable, now) &&
				(!query ||
					openable.name.toLowerCase().includes(query) ||
					openable.aliases.some(alias => alias.toLowerCase().includes(query)))
		)
		.slice(0, 25)
		.map(openable => ({ name: openable.name, value: openable.name }));
}

export function stripHiddenEventItems(bank: Bank, now = Date.now()): Bank {
	const hidden = unreleasedEventItemIDs(now);
	if (hidden.size === 0) return bank;
	const clean = new Bank();
	for (const [item, qty] of bank.items()) {
		if (!hidden.has(item.id)) clean.add(item.id, qty);
	}
	return clean;
}

export function formatSimulateOpenCaption(openableName: string, quantity: number): string {
	const qty = quantity.toLocaleString();
	return `Simulated opening ${qty}x ${openableName}. Nothing was given or taken.`;
}

export async function simulateOpenableLoot({
	openable,
	quantity,
	user,
	rng,
	totalLeaguesPoints = 0,
	now = Date.now()
}: {
	openable: UnifiedOpenable;
	quantity: number;
	user: MUser;
	rng: RNGProvider;
	totalLeaguesPoints?: number;
	now?: number;
}): Promise<{ bank: Bank; message: string | null }> {
	const result = await getOpenableLoot({
		openable,
		quantity,
		user,
		totalLeaguesPoints,
		rng,
		simulate: true
	});
	const bank = result.bank instanceof Bank ? result.bank : new Bank(result.bank);
	return {
		bank: stripHiddenEventItems(bank, now),
		message: result.message ?? null
	};
}
