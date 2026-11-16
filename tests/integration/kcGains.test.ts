import { describe, expect, it } from 'vitest';

import { kcGains } from '../../src/mahoji/commands/tools.js';
import { mockInteraction } from '../test-utils/mockInteraction.js';
import { createTestUser } from './util.js';

describe('KC Gains leaderboard', () => {
	it('should not allow sql injection', async () => {
		const user = await createTestUser();
		expect(await kcGains(mockInteraction({ user }), ';DELETE FROM users;', 'man', false)).toEqual(
			'Invalid time interval.'
		);
	});
});
