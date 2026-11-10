import { describe, expect, test } from 'vitest';

import {
	channelSendFailureReason,
	discordErrorCode,
	isPermanentDiscordSendError,
	tripFinishDmNotice
} from '../../src/lib/util/channelSendError.js';

describe('channelSendError', () => {
	test('treats Missing Access as a permanent failure with a View Channel reason', () => {
		const err = Object.assign(new Error('Missing Access'), { code: 50_001 });
		expect(discordErrorCode(err)).toBe(50_001);
		expect(isPermanentDiscordSendError(err)).toBe(true);
		expect(channelSendFailureReason(err)).toContain('View Channel');
	});

	test('treats Missing Permissions as a permanent send-permission failure', () => {
		const err = Object.assign(new Error('Missing Permissions'), { code: 50_013 });
		expect(isPermanentDiscordSendError(err)).toBe(true);
		expect(channelSendFailureReason(err)).toContain('Send Messages');
	});

	test('retries are still appropriate for errors without a permanent Discord code', () => {
		expect(isPermanentDiscordSendError(new Error('fetch failed'))).toBe(false);
		expect(isPermanentDiscordSendError({ code: 500 })).toBe(false);
	});

	test('the DM notice says the result was not also posted in the server channel', () => {
		const notice = tripFinishDmNotice(
			'missing View Channel access (the bot cannot see that channel, or a thread it is not in)'
		);
		expect(notice.startsWith("I couldn't post your trip return in the server channel")).toBe(true);
		expect(notice).toContain('The result is only here, not in that channel.');
	});
});
