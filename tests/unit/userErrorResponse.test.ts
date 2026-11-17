import { SpecialResponse } from '@oldschoolgg/discord';
import { UserError } from '@oldschoolgg/toolkit';
import { describe, expect, test } from 'vitest';

import { userErrorResponse } from '../../src/discord/userErrorResponse.js';

function fakeInteraction(replied: boolean, followUpFails = false) {
	const sent: string[] = [];
	return {
		sent,
		replied,
		followUp: async (o: { content: string }) => {
			if (followUpFails) throw new Error('Unknown Webhook');
			sent.push(o.content);
		}
	};
}

describe('UserError replies instead of hanging on "thinking..."', () => {
	const err = new UserError("<@1> doesn't meet the skill requirements: 110 Magic");

	test('not replied yet: the reason is returned as the reply', async () => {
		const i = fakeInteraction(false);
		expect(await userErrorResponse(err, i)).toEqual({ content: err.message });
		expect(i.sent).toEqual([]);
	});

	test('already replied (mass message): sent as a follow-up, original not overwritten', async () => {
		const i = fakeInteraction(true);
		expect(await userErrorResponse(err, i)).toBe(SpecialResponse.RespondedManually);
		expect(i.sent).toEqual([err.message]);
	});

	test('a failed follow-up never throws', async () => {
		const i = fakeInteraction(true, true);
		expect(await userErrorResponse(err, i)).toBe(SpecialResponse.RespondedManually);
	});

	test('empty message still gives a reason', async () => {
		expect(await userErrorResponse(new UserError(''), fakeInteraction(false))).toEqual({
			content: 'That command could not be completed.'
		});
	});
});