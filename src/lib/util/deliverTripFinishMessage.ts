import { Time } from '@oldschoolgg/toolkit';

import type { MessageBuilderClass } from '@/discord/MessageBuilder.js';
import { deferTripFinishMessage } from '@/lib/util/activityTransaction.js';

function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function pendingNoticeText(message: MessageBuilderClass): string {
	const content = message.message.content?.trim();
	if (content && content.length > 0) {
		return `Your minion trip finished, but I couldn't post this in the original channel:\n${content}`;
	}
	return "Your minion trip finished, but I couldn't post the loot message in the original channel. Check your bank for the loot.";
}

/**
 * Deliver a trip-finish message to the trip channel, retrying if Discord
 * isn't ready. Falls back to a DM, then a pending notice shown on the
 * user's next command. Never credits loot.
 */
export async function deliverTripFinishMessage(userId: string, channelId: string, message: MessageBuilderClass) {
	if (deferTripFinishMessage(userId, channelId, message)) {
		return;
	}

	const attempts = 3;
	for (let i = 0; i < attempts; i++) {
		if (i > 0) await sleep(Time.Second * 2);
		try {
			const sent = await globalClient.sendMessageOrWebhook(channelId, message);
			if (sent) return;
		} catch (err) {
			Logging.logError(err as Error, {
				source: 'tripFinishDeliver',
				user_id: userId,
				channel_id: channelId,
				attempt: String(i + 1)
			});
		}
	}

	try {
		await globalClient.sendDm(userId, message);
		return;
	} catch (err) {
		Logging.logError(err as Error, {
			source: 'tripFinishDeliverDM',
			user_id: userId
		});
	}

	try {
		await Cache.addPendingTripNotice(userId, pendingNoticeText(message));
	} catch (err) {
		Logging.logError(err as Error, {
			source: 'tripFinishPendingNotice',
			user_id: userId
		});
	}
}
