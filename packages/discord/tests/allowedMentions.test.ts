import { describe, expect, it } from 'vitest';

import {
	messageAllowsUserPings,
	resolveAllowedMentions,
	userIdsMentionedInContent
} from '../src/client/allowedMentions.js';

describe('userIdsMentionedInContent', () => {
	it('extracts unique user mention IDs', () => {
		expect(
			userIdsMentionedInContent(
				'Trade from <@111111111111111111> to <@!222222222222222222> and <@111111111111111111>'
			)
		).toEqual(['111111111111111111', '222222222222222222']);
	});

	it('ignores everyone, here, and roles', () => {
		expect(userIdsMentionedInContent('Hello @everyone @here <@&333333333333333333>')).toEqual([]);
	});
});

describe('resolveAllowedMentions', () => {
	it('allows only users mentioned in content when allowedMentions is omitted', () => {
		expect(resolveAllowedMentions('Hey <@111111111111111111> @everyone <@&333333333333333333>', undefined)).toEqual(
			{
				parse: [],
				roles: [],
				users: ['111111111111111111']
			}
		);
	});

	it('honors an explicit empty users list so silent mentions stay silent', () => {
		expect(resolveAllowedMentions('Hey <@111111111111111111>', { users: [] })).toEqual({
			parse: [],
			roles: [],
			users: []
		});
	});

	it('honors an explicit users list and never enables parse for everyone or roles', () => {
		expect(
			resolveAllowedMentions('unused', { parse: ['everyone', 'roles', 'users'], roles: ['9'], users: ['1', '2'] })
		).toEqual({
			parse: [],
			roles: ['9'],
			users: ['1', '2']
		});
	});

	it('does not infer users from content when allowedMentions is provided without users', () => {
		expect(resolveAllowedMentions('Hey <@111111111111111111>', { roles: [] })).toEqual({
			parse: [],
			roles: [],
			users: []
		});
	});
});

describe('messageAllowsUserPings', () => {
	it('is true only when at least one user is allowed', () => {
		expect(messageAllowsUserPings({ users: ['1'] })).toBe(true);
		expect(messageAllowsUserPings({ users: [] })).toBe(false);
		expect(messageAllowsUserPings(undefined)).toBe(false);
	});
});
