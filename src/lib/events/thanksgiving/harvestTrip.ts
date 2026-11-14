import { Time } from '@oldschoolgg/toolkit';

import type { ThanksgivingHarvestOptions } from '@/lib/types/minions.js';
import { formatTripDuration } from '@/lib/util/minionUtils.js';
import {
	hasHarvestBlessing,
	isThanksgivingActive,
	THANKSGIVING_HARVEST_ACTIVITY,
	THANKSGIVING_HARVEST_DISCOUNT,
	THANKSGIVING_MIN_TRIP_MS,
	type ThanksgivingHarvestFocus,
	thanksgivingHarvestExpectedParts,
	thanksgivingHarvestPartName
} from './core.js';

/**
 * `/thanksgiving harvest`: a trip that only gathers the chosen part, at 70% of a normal trip's
 * event value. Length uses the normal max trip length (patron bonus included, finalized by
 * calcMaxTripLength -> finalizeTripLength). Busy/double-start is blocked by startTrip.
 */
export async function thanksgivingHarvestCommand({
	user,
	channelId,
	focus,
	minutes
}: {
	user: MUser;
	channelId: string;
	focus: string | null | undefined;
	minutes: number | null | undefined;
}) {
	if (!isThanksgivingActive()) return 'The Straw Hat Harvest is not running right now.';
	if (focus !== 'bundles' && focus !== 'baskets') return 'Choose a focus: bundles or baskets.';
	if (await user.minionIsBusy()) return `${user.minionName} is busy.`;

	const maxTripLength = await user.calcMaxTripLength(THANKSGIVING_HARVEST_ACTIVITY);
	const minMinutes = THANKSGIVING_MIN_TRIP_MS / Time.Minute;
	let duration = maxTripLength;
	if (minutes !== null && minutes !== undefined) {
		if (!Number.isSafeInteger(minutes) || minutes < minMinutes) {
			return `Harvest trips must be at least ${minMinutes} minutes.`;
		}
		if (minutes * Time.Minute > maxTripLength) {
			return `${user.minionName} can go on harvest trips of up to ${formatTripDuration(user, maxTripLength)}.`;
		}
		duration = minutes * Time.Minute;
	}
	if (duration < THANKSGIVING_MIN_TRIP_MS) {
		return `Harvest trips must be at least ${minMinutes} minutes.`;
	}

	const chosen: ThanksgivingHarvestFocus = focus;
	await ActivityManager.startTrip<ThanksgivingHarvestOptions>({
		userID: user.id,
		channelId,
		duration,
		type: THANKSGIVING_HARVEST_ACTIVITY,
		thanksgivingHarvest: true,
		focus: chosen
	});

	const expected = thanksgivingHarvestExpectedParts(duration, chosen, {
		doubleLoot: false,
		blessing: hasHarvestBlessing(user)
	});
	return `🌾 ${user.minionName} is now gathering **${thanksgivingHarvestPartName(chosen)}** for The Straw Hat Harvest, it'll take around ${formatTripDuration(user, duration)} to finish.\nExpected: about **${expected.toFixed(1)}** ${thanksgivingHarvestPartName(chosen)} (${Math.round(THANKSGIVING_HARVEST_DISCOUNT * 100)}% of a normal trip's event value, all in this part; Double Loot doubles it). Focused trips don't also drop normal event parts.`;
}
