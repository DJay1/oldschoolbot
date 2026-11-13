import { describe, expect, test } from 'vitest';

import { oppositePollVote, pollReactionEmojiKey, pollVoteFromEmoji } from '@/lib/util/pollReactions.js';

describe('poll reaction single-choice', () => {
	test('recognizes the PollYesDog and PollNoDog emojis', () => {
		expect(pollVoteFromEmoji({ name: 'PollYesDog', id: '1' })).toBe('yes');
		expect(pollVoteFromEmoji({ name: 'PollNoDog', id: '2' })).toBe('no');
		expect(pollVoteFromEmoji({ name: '👍', id: null })).toBeNull();
		expect(pollVoteFromEmoji({ name: 'RSHappy', id: null })).toBeNull();
	});

	test('the other option is the one that should be removed', () => {
		expect(oppositePollVote('yes')).toBe('no');
		expect(oppositePollVote('no')).toBe('yes');
		expect(pollReactionEmojiKey('yes')).toBe('Yes');
		expect(pollReactionEmojiKey('no')).toBe('No');
	});
});