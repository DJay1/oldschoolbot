import { Time } from '@oldschoolgg/toolkit';

import type { MessageBuilderClass } from '@/discord/MessageBuilder.js';
import { deferTripFinishMessage } from '@/lib/util/activityTransaction.js';
import {
	channelSendFailureReason,
	discordErrorCode,
	isPermanentDiscordSendError,
	tripFinishDmNotice
} from '@/lib/util/channelSendError.js';

function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function pendingNoticeText(message: MessageBuilderClass, reason: string): string {
	const content = message.message.content?.trim();
	const header = `Your minion trip finished, but I couldn't post in the original channel (${reason}).`;
	if (content && content.length > 0) {
		return `${header}\n${content}`;
	}
	return `${header} Check your bank for the loot.`;
}

function logChannelSendFailure(err: Error, context: Record<string, string>) {
	const code = discordErrorCode(err);
	Logging.logError(err, {
		...context,
		discord_code: code !== null ? String(code) : 'none',
		reason: channelSendFailureReason(err)
	});
}

/**
 * Deliver a trip-finish message to the trip channel, retrying only for
 * transient failures. A successful channel post never sends a DM. A DM is
 * used only after the channel send permanently fails, and it includes why.
 * Never credits loot.
 */
export async function deliverTripFinishMessage(userId: string, channelId: string, message: MessageBuilderClass) {
	if (deferTripFinishMessage(userId, channelId, message)) {
		return;
	}

	const attempts = 3;
	let lastError: Error | null = null;

	for (let i = 0; i < attempts; i++) {
		if (i > 0) await sleep(Time.Second * 2);
		try {
			const sent = await globalClient.sendMessageOrWebhook(channelId, message);
			if (sent) return;
			lastError = lastError ?? new Error('Failed to deliver message to channel');
		} catch (err) {
			lastError = err as Error;
			logChannelSendFailure(lastError, {
				source: 'tripFinishDeliver',
				user_id: userId,
				channel_id: channelId,
				attempt: String(i + 1)
			});
			if (isPermanentDiscordSendError(lastError)) break;
			continue;
		}

		if (lastError && isPermanentDiscordSendError(lastError)) break;
	}

	const reason = channelSendFailureReason(lastError ?? new Error('Failed to deliver message to channel'));
	Logging.logError(lastError ?? new Error('Failed to deliver message to channel'), {
		source: 'tripFinishDeliverFallbackDM',
		user_id: userId,
		channel_id: channelId,
		reason
	});

	try {
		const built = await message.build();
		const originalContent = typeof built === 'string' ? built : 'content' in built ? (built.content ?? '') : '';
		const notice = tripFinishDmNotice(reason);
		const dmPayload =
			typeof built === 'string'
				? `${notice}\n\n${built}`
				: {
						...built,
						content: originalContent.trim().length > 0 ? `${notice}\n\n${originalContent}` : notice
					};
		await globalClient.sendDm(userId, dmPayload);
		return;
	} catch (err) {
		Logging.logError(err as Error, {
			source: 'tripFinishDeliverDM',
			user_id: userId,
			channel_id: channelId
		});
	}

	try {
		await Cache.addPendingTripNotice(userId, pendingNoticeText(message, reason));
	} catch (err) {
		Logging.logError(err as Error, {
			source: 'tripFinishPendingNotice',
			user_id: userId
		});
	}
}
