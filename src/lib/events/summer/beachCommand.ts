import { Time } from '@oldschoolgg/toolkit';

import { canvasToBuffer, loadImage } from '@/lib/canvas/canvasUtil.js';
import { isEventActive } from '@/lib/events/registry.js';
import type { BeachCombingActivityTaskOptions, BeachCombingMethod } from '@/lib/types/minions.js';
import { formatTripDuration } from '@/lib/util/minionUtils.js';

async function beachClosedMessage() {
	return {
		content: 'This command is no longer available...',
		files: [
			{
				name: 'byebyebeach.png',
				buffer: await canvasToBuffer(await loadImage('src/lib/resources/images/byebyebeach.png'))
			}
		]
	};
}

export async function beachCombingCommand(
	user: MUser,
	channelId: string,
	method: BeachCombingMethod,
	minutes?: number
) {
	if (!isEventActive('summer')) {
		return beachClosedMessage();
	}

	const maxTripLength = await user.calcMaxTripLength('BeachCombing');
	const requested = minutes === undefined ? maxTripLength : minutes * Time.Minute;
	const duration = Math.min(Math.max(requested, Time.Minute * 10), maxTripLength);

	await ActivityManager.startTrip<BeachCombingActivityTaskOptions>({
		userID: user.id,
		channelId,
		duration,
		type: 'BeachCombing',
		method,
		minutes: Math.floor(duration / Time.Minute)
	});

	return `${user.minionName} is heading to the shoreline to focus on ${method}. They'll be out for ${formatTripDuration(user, duration)}.`;
}
