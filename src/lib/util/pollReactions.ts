import { applicationEmojiId } from '@oldschoolgg/toolkit';

import { globalConfig } from '@/lib/constants.js';
import { ReactEmoji } from '@/lib/data/emojis.js';

export type PollVote = 'yes' | 'no';

export interface PollReactionEmoji {
	id?: string | null;
	name?: string | null;
}

export function pollVoteFromEmoji(emoji: PollReactionEmoji): PollVote | null {
	const id = emoji.id ?? null;
	const name = emoji.name ?? null;
	const yesId = applicationEmojiId('PollYesDog');
	const noId = applicationEmojiId('PollNoDog');
	if (name === 'PollYesDog' || (id !== null && yesId !== null && id === yesId)) return 'yes';
	if (name === 'PollNoDog' || (id !== null && noId !== null && id === noId)) return 'no';
	return null;
}

export function oppositePollVote(vote: PollVote): PollVote {
	return vote === 'yes' ? 'no' : 'yes';
}

export function pollReactionEmojiKey(vote: PollVote): keyof typeof ReactEmoji {
	return vote === 'yes' ? 'Yes' : 'No';
}

let loggedMissingPermissions = false;

export async function handlePollReactionAdd(payload: {
	user_id: string;
	channel_id: string;
	message_id: string;
	emoji: PollReactionEmoji;
}): Promise<void> {
	if (payload.user_id === globalConfig.clientID) return;

	const vote = pollVoteFromEmoji(payload.emoji);
	if (!vote) return;

	const poll = await Cache.getPoll(payload.message_id);
	if (poll && poll.status !== 'Open') {
		try {
			await globalClient.removeUserReaction({
				channelId: payload.channel_id,
				messageId: payload.message_id,
				emojiId: pollReactionEmojiKey(vote),
				userId: payload.user_id
			});
		} catch (err) {
			const status = typeof err === 'object' && err && 'status' in err ? Number((err as { status?: number }).status) : 0;
			if (status !== 404 && status !== 403) Logging.logError(err as Error);
		}
		return;
	}

	const other = pollReactionEmojiKey(oppositePollVote(vote));
	try {
		await globalClient.removeUserReaction({
			channelId: payload.channel_id,
			messageId: payload.message_id,
			emojiId: other,
			userId: payload.user_id
		});
	} catch (err) {
		const status = typeof err === 'object' && err && 'status' in err ? Number((err as { status?: number }).status) : 0;
		if (status === 404) return;
		if (status === 403) {
			if (!loggedMissingPermissions) {
				loggedMissingPermissions = true;
				Logging.logError(
					new Error(
						'Missing Manage Messages permission; cannot remove the other poll vote reaction. Users may still react Yes and No.'
					)
				);
			}
			return;
		}
		Logging.logError(err as Error);
	}
}