import {
	type ResolvedSeasonalEvent,
	type SeasonalEventDefinition,
	type SeasonalEventId,
	type SeasonalEventOverride,
	seasonalEventIds
} from './types.js';

/**
 * Seasonal events are off unless an override says otherwise.
 *
 * Item definitions are a separate switch. They stay registered by default so
 * banks, collection logs, and icons keep resolving items people already own.
 * Set LOS_PERROS_REGISTER_EVENT_ITEMS=0 before boot to skip registration.
 * That flag is read once at startup. It is not the activity toggle, and turning
 * it off makes owned event items stop resolving.
 */
export const seasonalEvents: readonly SeasonalEventDefinition[] = [
	{
		id: 'summer',
		name: 'Summer',
		summary: 'Beach combing, trip crate spawns, shoreline fishing finds, and Sun Scream crafting.',
		enabled: false
	},
	{
		id: 'christmas',
		name: 'Christmas',
		summary: 'Festive present shop, seasonal crate keys, and Christmas crafting.',
		enabled: false
	},
	{
		id: 'halloween',
		name: 'Halloween',
		summary: 'Halloween item claims, seasonal crate keys, and pumpkin or mumpkin crafting.',
		enabled: false
	},
	{
		id: 'easter',
		name: 'Easter',
		summary: 'Easter crate keys and the egg use reactions.',
		enabled: false
	},
	{
		id: 'birthday',
		name: 'Birthday',
		summary: 'Birthday crate keys. The old birthday trips are already retired.',
		enabled: false
	}
];

const defaults = new Map(seasonalEvents.map(event => [event.id, event]));
const overrides = new Map<SeasonalEventId, SeasonalEventOverride>();

export function isSeasonalEventId(value: string): value is SeasonalEventId {
	return (seasonalEventIds as readonly string[]).includes(value);
}

export function shouldRegisterSeasonalItemDefinitions(): boolean {
	const flag = process.env.LOS_PERROS_REGISTER_EVENT_ITEMS;
	return flag !== '0' && flag !== 'false';
}

export function setSeasonalEventOverride(id: SeasonalEventId, override: SeasonalEventOverride) {
	overrides.set(id, override);
}

export function clearSeasonalEventOverride(id: SeasonalEventId) {
	overrides.delete(id);
}

export function clearSeasonalEventOverrides() {
	overrides.clear();
}

export function getSeasonalEventOverride(id: SeasonalEventId): SeasonalEventOverride | undefined {
	return overrides.get(id);
}

export function resolveSeasonalEvent(id: SeasonalEventId): ResolvedSeasonalEvent {
	const event = defaults.get(id);
	if (!event) {
		throw new Error(`Unknown seasonal event: ${id}`);
	}
	const override = overrides.get(id);
	return {
		...event,
		enabled: override?.enabled ?? event.enabled,
		start: override?.start ?? null,
		end: override?.end ?? null,
		overridden: override !== undefined
	};
}

export function seasonalEventName(id: SeasonalEventId): string {
	return defaults.get(id)?.name ?? id;
}

/**
 * Activity, drops, shops, and event commands.
 * Item definitions are not affected.
 */
export function isEventActive(id: SeasonalEventId, now = Date.now()): boolean {
	const event = resolveSeasonalEvent(id);
	if (!event.enabled) return false;
	if (event.start !== null && now < event.start) return false;
	if (event.end !== null && now >= event.end) return false;
	return true;
}

function formatInstant(value: number | null): string {
	if (value === null) return 'none';
	return new Date(value).toISOString();
}

export function formatSeasonalEventList(now = Date.now()): string {
	const definitions = shouldRegisterSeasonalItemDefinitions()
		? 'Item definitions: registered. Owned event items still resolve while an event is on hold.'
		: 'Item definitions: skipped (LOS_PERROS_REGISTER_EVENT_ITEMS=0). Owned event items will not resolve.';
	const lines = seasonalEventIds.map(id => {
		const event = resolveSeasonalEvent(id);
		const state = isEventActive(id, now) ? 'active' : 'on hold';
		const schedule = `start ${formatInstant(event.start)}, end ${formatInstant(event.end)}`;
		const source = event.overridden ? 'runtime override' : 'code default';
		return `${event.name} (\`${id}\`): ${state}. Enabled flag ${event.enabled ? 'on' : 'off'} (${source}). ${schedule}. ${event.summary}`;
	});
	return [definitions, ...lines].join('\n');
}
