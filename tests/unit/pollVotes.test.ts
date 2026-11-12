import { describe, expect, test } from 'vitest';

import { applyPollVote, buildPollEmbed, countPollVotes, parsePollEmbed } from '@/lib/util/pollVotes.js';

describe('poll single-choice votes', () => {
	test('a first vote is counted and later clicks on the same option do nothing', () => {
		const first = applyPollVote({}, '1', 'yes');
		expect(first.changed).toBe(true);
		expect(first.previous).toBeNull();
		expect(first.yes).toBe(1);
		expect(first.no).toBe(0);

		const same = applyPollVote(first.votes, '1', 'yes');
		expect(same.changed).toBe(false);
		expect(same.previous).toBe('yes');
		expect(same.yes).toBe(1);
		expect(same.no).toBe(0);
		expect(same.votes).toEqual(first.votes);
	});

	test('clicking the other option switches a user to a single vote', () => {
		const afterYes = applyPollVote({}, '1', 'yes');
		const switched = applyPollVote(afterYes.votes, '1', 'no');
		expect(switched.changed).toBe(true);
		expect(switched.previous).toBe('yes');
		expect(switched.yes).toBe(0);
		expect(switched.no).toBe(1);
		expect(switched.votes).toEqual({ '1': 'no' });
	});

	test('votes from different users are counted separately', () => {
		const first = applyPollVote({}, '1', 'yes');
		const second = applyPollVote(first.votes, '2', 'yes');
		const third = applyPollVote(second.votes, '3', 'no');
		expect(third.yes).toBe(2);
		expect(third.no).toBe(1);
		expect(countPollVotes(third.votes)).toEqual({ yes: 2, no: 1 });
	});

	test('poll embed round-trips the question, counts, and author', () => {
		const embed = buildPollEmbed({
			question: 'Is this a good idea?',
			yes: 4,
			no: 2,
			askedBy: 'DJ'
		});
		const json = embed.toJSON();
		expect(json.title).toBe('Poll');
		expect(json.fields).toEqual([
			{ name: 'Yes', value: '4', inline: true },
			{ name: 'No', value: '2', inline: true }
		]);
		expect(parsePollEmbed(json)).toEqual({
			question: 'Is this a good idea?',
			askedBy: 'DJ'
		});
	});
});