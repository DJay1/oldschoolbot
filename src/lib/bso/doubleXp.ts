import { time } from '@oldschoolgg/discord';
import { formatDuration } from '@oldschoolgg/toolkit';

import { DOUBLE_BONUS_CHANNEL_ID } from '@/lib/constants.js';

export let DOUBLE_XP_FINISH_TIME_CACHE = 0;

export function isDoubleXpActive(duration = 0) {
	return Date.now() - duration < DOUBLE_XP_FINISH_TIME_CACHE;
}

export async function addToDoubleXpTimer(amount: number, reason: string) {
	const clientSettings = await ClientSettings.fetch({
		double_xp_finish_time: true
	});
	let current = Number(clientSettings.double_xp_finish_time);
	if (current < Date.now()) {
		current = Date.now();
	}
	const newDoubleXpTimer = current + amount;
	await ClientSettings.update({
		double_xp_finish_time: newDoubleXpTimer
	});
	DOUBLE_XP_FINISH_TIME_CACHE = newDoubleXpTimer;

	const ends = new Date(newDoubleXpTimer);
	wasDoubleXpActive = true;
	await globalClient
		.sendMessage(DOUBLE_BONUS_CHANNEL_ID, {
			content: `🎉 **${formatDuration(amount)}** added to Double XP because: ${reason}\nDouble XP now ends ${time(ends)} (${time(ends, 'R')}).`
		})
		.catch(err => Logging.logError(err as Error));
}

export async function syncDoubleXp() {
	const clientSettings = await ClientSettings.fetch({
		double_xp_finish_time: true
	});
	DOUBLE_XP_FINISH_TIME_CACHE = Number(clientSettings.double_xp_finish_time);
}

let wasDoubleXpActive: boolean | null = null;

export async function announceDoubleXpEnd() {
	await syncDoubleXp();
	const active = isDoubleXpActive();
	if (wasDoubleXpActive === true && !active) {
		await globalClient
			.sendMessage(DOUBLE_BONUS_CHANNEL_ID, { content: 'Double XP has ended.' })
			.catch(err => Logging.logError(err as Error));
	}
	wasDoubleXpActive = active;
}
