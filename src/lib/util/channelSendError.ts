export function discordErrorCode(err: unknown): number | null {
	if (!err || typeof err !== 'object') return null;
	const code = (err as { code?: unknown }).code;
	if (typeof code === 'number') return code;
	if (typeof code === 'string' && /^\d+$/.test(code)) return Number(code);
	return null;
}

/** Discord errors that retrying will not fix. */
export const PERMANENT_DISCORD_SEND_CODES = new Set([
	10_003, // Unknown Channel
	10_004, // Unknown Guild
	50_001, // Missing Access
	50_013, // Missing Permissions
	50_083 // Thread is archived
]);

export function isPermanentDiscordSendError(err: unknown): boolean {
	const code = discordErrorCode(err);
	return code !== null && PERMANENT_DISCORD_SEND_CODES.has(code);
}

/**
 * Short, user-facing reason for why a trip-finish message was DMed
 * instead of posted in the starting channel.
 */
export function channelSendFailureReason(err: unknown): string {
	const code = discordErrorCode(err);
	switch (code) {
		case 50_001:
			return 'missing View Channel access (the bot cannot see that channel, or a thread it is not in)';
		case 50_013:
			return 'missing Send Messages, Attach Files, or Embed Links permission';
		case 10_003:
			return 'the channel no longer exists or is unknown to the bot';
		case 10_004:
			return 'the bot is no longer in that server';
		case 50_083:
			return 'that thread is archived';
		default: {
			const message = err instanceof Error ? err.message : 'unknown error';
			return message.replace(/\s+/g, ' ').trim().slice(0, 180) || 'the channel send failed';
		}
	}
}

export function tripFinishDmNotice(reason: string): string {
	return `I couldn't post your trip return in the server channel where you started it (${reason}). The result is only here, not in that channel.`;
}
