import { roleMention, time } from '@oldschoolgg/discord';
import { formatDuration, Time } from '@oldschoolgg/toolkit';

import { Channel } from '@/lib/constants.js';

/** Optional Los Perros role to ping when double loot starts. */
const DOUBLE_LOOT_ROLE_ID = process.env.DOUBLE_LOOT_ROLE_ID || null;

export let DOUBLE_LOOT_FINISH_TIME_CACHE = 0;

export function isDoubleLootActive(duration = 0) {
	return Date.now() - duration < DOUBLE_LOOT_FINISH_TIME_CACHE;
}

export async function addToDoubleLootTimer(amount: number, reason: string) {
	const clientSettings = await ClientSettings.fetch({
		double_loot_finish_time: true
	});
	let current = Number(clientSettings.double_loot_finish_time);
	if (current < Date.now()) {
		current = Date.now();
	}
	const newDoubleLootTimer = current + amount;
	await ClientSettings.update({
		double_loot_finish_time: newDoubleLootTimer
	});
	DOUBLE_LOOT_FINISH_TIME_CACHE = newDoubleLootTimer;

	const ends = new Date(newDoubleLootTimer);
	const ping = DOUBLE_LOOT_ROLE_ID ? `${roleMention(DOUBLE_LOOT_ROLE_ID)} ` : '';
	await globalClient.sendMessage(Channel.Notifications, {
		content: `${ping}🎉 **${formatDuration(amount)}** added to Double Loot because: ${reason}\nDouble Loot now ends ${time(ends)} (${time(ends, 'R')}).`,
		allowedMentions: { roles: DOUBLE_LOOT_ROLE_ID ? [DOUBLE_LOOT_ROLE_ID] : [] }
	});
	wasDoubleLootActive = true;

	await syncPrescence();
}

export async function addPatronLootTime(_tier: number, user: MUser | null) {
	const map: Record<number, number> = {
		1: 3,
		2: 6,
		3: 15,
		4: 25,
		5: 60
	};
	const tier = _tier - 1;
	if (!map[tier]) return;
	const minutes = map[tier];
	const timeAdded = Math.floor(Time.Minute * minutes);
	await addToDoubleLootTimer(timeAdded, `${user ?? 'Someone'} became a Tier ${tier} sponsor`);
}

export async function syncDoubleLoot() {
	const clientSettings = await ClientSettings.fetch({
		double_loot_finish_time: true
	});
	DOUBLE_LOOT_FINISH_TIME_CACHE = Number(clientSettings.double_loot_finish_time);
}

let wasDoubleLootActive: boolean | null = null;

/** Refreshes the bot status and posts once in the log channel when double loot runs out. */
export async function syncPrescence() {
	await syncDoubleLoot();
	const active = isDoubleLootActive();
	if (wasDoubleLootActive === true && !active) {
		await globalClient
			.sendMessage(Channel.Notifications, { content: 'Double Loot has ended.' })
			.catch(err => Logging.logError(err as Error));
	}
	wasDoubleLootActive = active;

	const str = isDoubleLootActive()
		? `${formatDuration(DOUBLE_LOOT_FINISH_TIME_CACHE - Date.now(), true)} Double Loot!`
		: '/help';
	await globalClient.setPresence({
		text: str
	});
}
