export const seasonalEventIds = ['summer', 'christmas', 'halloween', 'easter', 'birthday'] as const;

export type SeasonalEventId = (typeof seasonalEventIds)[number];

export interface SeasonalEventDefinition {
	id: SeasonalEventId;
	name: string;
	/** What this event turns on. Item definitions stay registered either way. */
	summary: string;
	/** Code default. Runtime overrides can change this without a redeploy. */
	enabled: boolean;
}

export interface SeasonalEventOverride {
	enabled: boolean;
	/** Epoch ms. Null means no start bound. */
	start: number | null;
	/** Epoch ms. Null means no end bound. The end instant is exclusive. */
	end: number | null;
}

export interface ResolvedSeasonalEvent extends SeasonalEventDefinition {
	start: number | null;
	end: number | null;
	/** True when an admin override is stored for this event. */
	overridden: boolean;
}
