import { isEventActive, seasonalEventName } from './registry.js';
import type { SeasonalEventId } from './types.js';

/** Shop entries that only exist to stock a seasonal event. */
const seasonalBuyables: Record<string, SeasonalEventId> = {
	'Festive present': 'christmas',
	'Birthday crate key (s2)': 'birthday',
	'Spooky crate key (s3)': 'halloween',
	'Festive crate key (s4)': 'christmas',
	'Easter crate key (s5)': 'easter',
	'Birthday crate key (s6)': 'birthday',
	'Sinister crate key (s7)': 'halloween',
	'Frozen crate key (s8)': 'christmas',
	'Summer crate key (s9)': 'summer'
};

export function seasonalBuyableHoldMessage(buyableName: string): string | null {
	const eventId = seasonalBuyables[buyableName];
	if (!eventId || isEventActive(eventId)) return null;
	return `The ${seasonalEventName(eventId)} event is on hold, so ${buyableName} is not for sale.`;
}
