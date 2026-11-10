import { describe, expect, test } from 'vitest';

import { BSC_PLAYER_ROLE_ID, playerRoleChange } from '../../src/lib/bsc/playerRole.js';

describe('playerRoleChange', () => {
	test('players without the role get it', () => {
		expect(playerRoleChange(true, ['other'])).toBe('add');
	});

	test('members without a minion lose it', () => {
		expect(playerRoleChange(false, [BSC_PLAYER_ROLE_ID])).toBe('remove');
	});

	test('nothing changes when the role already matches', () => {
		expect(playerRoleChange(true, [BSC_PLAYER_ROLE_ID])).toBeNull();
		expect(playerRoleChange(false, [])).toBeNull();
	});
});
